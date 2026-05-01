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

export async function generateBreakdown(notes: string): Promise<GenerateResult> {
  const trimmed = notes.trim();
  if (trimmed.length < 20) throw new Error("Please provide at least 20 characters of notes.");
  if (trimmed.length > 20000) throw new Error("Notes are too long (max 20,000 characters).");

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: trimmed }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.error || "Request failed. Please try again.");
  }

  const result = ResultSchema.safeParse(json);
  if (!result.success) {
    console.error("Schema parse failed", result.error);
    throw new Error("Gemini response did not match the expected format.");
  }
  return result.data;
}
