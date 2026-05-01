import type { VercelRequest, VercelResponse } from "@vercel/node";

const SYSTEM_PROMPT = `You are an experienced senior product manager. Read the user's raw meeting notes or transcript and produce a crisp, professional product breakdown. Be concrete, avoid filler, and infer reasonable specifics when the notes are vague. Respond ONLY with a valid JSON object matching the requested schema. No prose, no markdown fences.`;

const SCHEMA_HINT = `{
  "prd_summary": "4-8 sentence PRD summary covering problem, users, goals, proposed solution",
  "user_stories": [{"title": "string", "story": "As a <persona>, I want <capability>, so that <benefit>."}],
  "acceptance_criteria": ["Given/When/Then or clear bullet criteria", "..."],
  "jira_tickets": [{"key": "PM-101", "type": "Story|Task|Bug|Epic|Spike", "summary": "string", "description": "string", "priority": "Low|Medium|High|Critical", "labels": ["string"]}],
  "next_steps": ["string", "..."]
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "App configuration error. Please contact support." });
  }

  const { notes } = req.body as { notes?: string };
  if (!notes || notes.trim().length < 20) {
    return res.status(400).json({ error: "Please provide at least 20 characters of notes." });
  }
  if (notes.trim().length > 20000) {
    return res.status(400).json({ error: "Notes are too long (max 20,000 characters)." });
  }

  const trimmed = notes.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const geminiRes = await fetch(url, {
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

  if (geminiRes.status === 401 || geminiRes.status === 403) {
    return res.status(500).json({ error: "App configuration error. Please contact support." });
  }
  if (geminiRes.status === 429) {
    return res.status(429).json({ error: "Gemini rate limit reached. Try again in a moment." });
  }
  if (!geminiRes.ok) {
    const text = await geminiRes.text().catch(() => "");
    console.error("Gemini error", geminiRes.status, text);
    return res.status(502).json({ error: "Gemini request failed. Please try again." });
  }

  const json = await geminiRes.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
  if (!text) {
    return res.status(502).json({ error: "Gemini returned an empty response." });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  }

  return res.status(200).json(parsed);
}
