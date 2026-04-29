import { useState } from "react";
import { generateBreakdown, GenerateResult } from "@/lib/gemini";

export default function App() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await generateBreakdown(input);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>🩷 PinkPrint</h1>
      <p>Turn messy meeting notes into structured product docs.</p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste meeting notes here..."
        style={{ width: "100%", height: 200, marginTop: 16 }}
      />

      <button
        onClick={handleGenerate}
        disabled={loading || input.trim().length < 20}
        style={{ marginTop: 12 }}
      >
        {loading ? "Generating..." : "Generate PRD"}
      </button>

      {error && (
        <p style={{ color: "red", marginTop: 12 }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 24 }}>
          <h2>📄 PRD Summary</h2>
          <p>{result.prd_summary}</p>

          <h2>👤 User Stories</h2>
          <ul>
            {result.user_stories.map((s, i) => (
              <li key={i}>
                <strong>{s.title}</strong>: {s.story}
              </li>
            ))}
          </ul>

          <h2>✅ Acceptance Criteria</h2>
          <ul>
            {result.acceptance_criteria.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>

          <h2>🧩 Jira Tickets</h2>
          <ul>
            {result.jira_tickets.map((t, i) => (
              <li key={i}>
                <strong>{t.key}</strong> [{t.type}] - {t.summary}
              </li>
            ))}
          </ul>

          <h2>🚀 Next Steps</h2>
          <ul>
            {result.next_steps.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
