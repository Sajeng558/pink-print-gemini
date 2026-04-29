import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  notes: z.string().trim().min(20, "Please provide at least 20 characters of notes.").max(20000),
});

const ResultSchema = z.object({
  prd_summary: z.string(),
  user_stories: z.array(
    z.object({
      title: z.string(),
      story: z.string(),
    })
  ),
  acceptance_criteria: z.array(z.string()),
  jira_tickets: z.array(
    z.object({
      key: z.string(),
      type: z.enum(["Story", "Task", "Bug", "Epic", "Spike"]),
      summary: z.string(),
      description: z.string(),
      priority: z.enum(["Low", "Medium", "High", "Critical"]),
      labels: z.array(z.string()).optional().default([]),
    })
  ),
  next_steps: z.array(z.string()),
});

export type GenerateResult = z.infer<typeof ResultSchema>;

const SYSTEM_PROMPT = `You are an experienced senior product manager. Read the user's raw meeting notes or transcript and produce a crisp, professional product breakdown. Be concrete, avoid filler, and infer reasonable specifics when the notes are vague. Always respond by calling the provided tool with valid structured arguments. Use clear, business-friendly language.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "emit_pm_breakdown",
    description: "Emit the structured PM breakdown derived from the meeting notes.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        prd_summary: {
          type: "string",
          description: "A 4-8 sentence PRD summary covering problem, users, goals, and proposed solution.",
        },
        user_stories: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              story: {
                type: "string",
                description: "Format: As a <persona>, I want <capability>, so that <benefit>.",
              },
            },
            required: ["title", "story"],
          },
        },
        acceptance_criteria: {
          type: "array",
          minItems: 4,
          maxItems: 12,
          items: {
            type: "string",
            description: "Given/When/Then style or clear bullet criteria.",
          },
        },
        jira_tickets: {
          type: "array",
          minItems: 3,
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              key: { type: "string", description: "Short fake key like PM-101." },
              type: { type: "string", enum: ["Story", "Task", "Bug", "Epic", "Spike"] },
              summary: { type: "string" },
              description: { type: "string" },
              priority: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
              labels: { type: "array", items: { type: "string" } },
            },
            required: ["key", "type", "summary", "description", "priority"],
          },
        },
        next_steps: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: { type: "string" },
        },
      },
      required: ["prd_summary", "user_stories", "acceptance_criteria", "jira_tickets", "next_steps"],
    },
  },
};

export const generateBreakdown = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("AI service is not configured. Please contact support.");
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Here are the meeting notes / transcript:\n\n"""${data.notes}"""\n\nProduce the PM breakdown now.`,
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "emit_pm_breakdown" } },
      }),
    });

    if (res.status === 429) {
      throw new Error("We're getting a lot of requests right now. Please try again in a moment.");
    }
    if (res.status === 402) {
      throw new Error("AI usage limit reached. Please add credits in your Lovable workspace.");
    }
    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error", res.status, text);
      throw new Error("The AI service failed. Please try again.");
    }

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      throw new Error("AI returned an unexpected response. Please try again.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      throw new Error("AI returned malformed data. Please try again.");
    }

    const result = ResultSchema.safeParse(parsed);
    if (!result.success) {
      console.error("Schema parse failed", result.error);
      throw new Error("AI response did not match the expected format. Please try again.");
    }
    return result.data;
  });
