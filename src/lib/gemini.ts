// Browser-side Gemini client. The key comes from VITE_GEMINI_API_KEY (build-time)
// or from a value the user pastes into the UI (stored in localStorage).

import { z } from "zod";

const ResultSchema = z.object({
  prd_summary: z.string(),
  user_stories: z.array(z.object({ title: z.string(), story: z.string() })),
  acceptance_criteria: z.array(z.string()),
  jira_tickets: z.array(
    z.object({
      key: z.string(),
      type: z.enum(["Story", "Task", "Bug", "Epic", "Spike"]),
      summary: z.string(),
      description: z.string(),
      priority: z.enum(["Low", "Medium", "High", "Critical"]),
      labels: z.array(z.string()).optional().default([]),
    }),
  ),
  next_steps: z.array(z.string()),
});

export type GenerateResult = z.infer<typeof ResultSchema>;

const STORAGE_KEY = "pinkprint.gemini.apiKey";

export function getStoredKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setStoredKey(key: string) {
  if (typeof window === "undefined") return;
  if (key) localStorage.setItem(STORAGE_KEY, key);
  else localStorage.removeItem(STORAGE_KEY);
}

export function getApiKey(): string {
  const fromEnv = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || "";
  return fromEnv || getStoredKey();
}

const SYSTEM_PROMPT = `You are an experienced senior product manager. Read the user's raw meeting notes or transcript and produce a crisp, professional product breakdown. Be concrete, avoid filler, and infer reasonable specifics when the notes are vague. Respond ONLY with a valid JSON object matching the requested schema. No prose, no markdown fences.`;

const SCHEMA_HINT = `{
  "prd_summary": "4-8 sentence PRD summary covering problem, users, goals, proposed solution",
  "user_stories": [{"title": "string", "story": "As a <persona>, I want <capability>, so that <benefit>."}],
  "acceptance_criteria": ["Given/When/Then or clear bullet criteria", "..."],
  "jira_tickets": [{"key": "PM-101", "type": "Story|Task|Bug|Epic|Spike", "summary": "string", "description": "string", "priority": "Low|Medium|High|Critical", "labels": ["string"]}],
  "next_steps": ["string", "..."]
}`;

export async function generateBreakdown(notes: string): Promise<GenerateResult> {
  const trimmed = notes.trim();
  if (trimmed.length < 20) throw new Error("Please provide at least 20 characters of notes.");
  if (trimmed.length > 20000) throw new Error("Notes are too long (max 20,000 characters).");

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API key. Add it in Settings.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Here are the meeting notes / transcript:\n\n"""${trimmed}"""\n\nReturn ONLY a JSON object with this shape:\n${SCHEMA_HINT}`,
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
    throw new Error("Invalid Gemini API key. Please check it in Settings.");
  }
  if (res.status === 429) {
    throw new Error("Gemini rate limit reached. Try again in a moment.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Gemini error", res.status, text);
    throw new Error("Gemini request failed. Please try again.");
  }

  const json = await res.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
  if (!text) throw new Error("Gemini returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Try to recover from accidental markdown fences
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  }

  const result = ResultSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Schema parse failed", result.error);
    throw new Error("Gemini response did not match the expected format.");
  }
  return result.data;
}
