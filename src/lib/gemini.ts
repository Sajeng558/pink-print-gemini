// Browser-side Gemini client (production-safe version)
// Uses ONLY Vite environment variable injected at build time.

import { z } from "zod";

/**
 * Expected structured output schema
 */
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

/**
 * System prompt defines AI behavior
 */
const SYSTEM_PROMPT = `
You are an experienced senior product manager.
Convert raw meeting notes into structured product documentation.

Be concise, structured, and professional.
Return ONLY valid JSON. No markdown, no commentary.
`;

/**
 * JSON schema hint for Gemini
 */
const SCHEMA_HINT = `
{
  "prd_summary": "string",
  "user_stories": [{"title": "string", "story": "string"}],
  "acceptance_criteria": ["string"],
  "jira_tickets": [{
    "key": "PM-101",
    "type": "Story|Task|Bug|Epic|Spike",
    "summary": "string",
    "description": "string",
    "priority": "Low|Medium|High|Critical",
    "labels": ["string"]
  }],
  "next_steps": ["string"]
}
`;

/**
 * Get API key ONLY from environment variables
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  return apiKey || "";
}

/**
 * Main generation function
 */
export async function generateBreakdown(notes: string): Promise<GenerateResult> {
  const trimmed = notes.trim();

  if (trimmed.length < 20) {
    throw new Error("Please provide at least 20 characters of notes.");
  }

  if (trimmed.length > 20000) {
    throw new Error("Notes are too long (max 20,000 characters).");
  }

  const apiKey = getApiKey();

  // 🚨 HARD FAIL if missing (no UI key prompts anymore)
  if (!apiKey) {
    throw new Error(
      "Configuration error: Missing API key. Please set VITE_GEMINI_API_KEY in environment variables."
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
Meeting Notes:
"""
${trimmed}
"""

Return ONLY JSON in this format:
${SCHEMA_HINT}
              `,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.6,
      },
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid API key or unauthorized request.");
  }

  if (res.status === 429) {
    throw new Error("Rate limit exceeded. Please try again shortly.");
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("Gemini error:", res.status, errText);
    throw new Error("AI request failed. Please try again.");
  }

  const json = await res.json();

  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ||
    "";

  if (!text) {
    throw new Error("Empty response from AI.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    const cleaned = text.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  }

  const result = ResultSchema.safeParse(parsed);

  if (!result.success) {
    console.error(result.error);
    throw new Error("AI returned invalid format.");
  }

  return result.data;
}
