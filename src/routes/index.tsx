import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, FileText, Users, CheckCircle2, Ticket, ArrowRight, Loader2, Copy, Wand2, Heart, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import { generateBreakdown, type GenerateResult } from "@/server/generate.functions";
import { parseFile } from "@/lib/file-parse";
import { exportPdf } from "@/lib/pdf-export";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PinkPrint — AI PM Documentation Generator" },
      {
        name: "description",
        content:
          "Paste meeting notes or transcripts and instantly get a PRD summary, user stories, acceptance criteria, Jira tickets and next steps.",
      },
      { property: "og:title", content: "PinkPrint" },
      {
        property: "og:description",
        content: "Turn messy meeting notes into a clean product breakdown in seconds.",
      },
    ],
  }),
  component: Index,
});

const SAMPLE = `Sync about the new onboarding flow.
- Users drop off after signup, mostly on the workspace creation step
- Need to support invite teammates earlier
- Marketing wants a personalization quiz: role, team size, goals
- Engineering: must work on mobile, support SSO users
- Should send a welcome email after step 2
- Goal: lift activation by 15% in Q3`;

function Index() {
  const generate = useServerFn(generateBreakdown);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParsing(true);
    try {
      const text = await parseFile(file);
      if (!text || text.trim().length === 0) {
        toast.error("Couldn't extract any text from that file.");
      } else {
        setNotes(text);
        toast.success(`Loaded ${file.name}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file.");
    } finally {
      setParsing(false);
    }
  };

  const onGenerate = async () => {
    if (notes.trim().length < 20) {
      toast.error("Please paste at least 20 characters of notes.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await generate({ data: { notes } });
      setResult(r);
      toast.success("Your PM breakdown is ready ✨");
      setTimeout(() => {
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero">
      <Toaster position="top-center" richColors />
      <Header />

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:pt-16">
        <Hero />

        <Card className="mt-10 border-border/60 bg-card/80 shadow-glow backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wand2 className="h-5 w-5 text-primary" />
              Paste your meeting notes or transcript
            </CardTitle>
            <CardDescription>
              We'll turn it into a PRD summary, user stories, acceptance criteria, Jira tickets, and next steps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste your raw notes here…"
              className="min-h-56 resize-y bg-background/70 text-base leading-relaxed"
              maxLength={20000}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.log,.doc,.docx,.pdf,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={onFileChange}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{notes.length.toLocaleString()} / 20,000</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setNotes(SAMPLE)}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Try a sample
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onPickFile}
                  disabled={parsing || loading}
                  className="border-primary/30 bg-background/60 text-foreground hover:bg-accent"
                >
                  {parsing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reading…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload file
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  onClick={onGenerate}
                  disabled={loading || parsing}
                  className="bg-gradient-primary text-primary-foreground shadow-soft transition-transform hover:scale-[1.02]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate breakdown
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {!result && !loading && <Features />}

        {loading && <LoadingState />}

        {result && (
          <div id="results" className="mt-12 scroll-mt-24">
            <Results data={result} />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <Heart className="h-4 w-4 text-primary-foreground" fill="currentColor" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-lg font-semibold">PinkPrint</div>
          <div className="text-xs text-muted-foreground">AI PM Documentation Generator</div>
        </div>
      </div>
      <Badge variant="secondary" className="hidden bg-accent text-accent-foreground sm:inline-flex">
        <Sparkles className="mr-1 h-3 w-3" /> AI-powered
      </Badge>
    </header>
  );
}

function Hero() {
  return (
    <section className="text-center">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
        <span className="text-primary">Messy notes</span> in.{" "}
        <span className="text-primary">Polished product docs</span> out.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
        Paste any meeting transcript or notes. Get a PRD summary, user stories, acceptance criteria,
        Jira tickets and recommended next steps — instantly.
      </p>
    </section>
  );
}

function Features() {
  const items = [
    { icon: FileText, label: "PRD summary", color: "bg-blush" },
    { icon: Users, label: "User stories", color: "bg-lavender" },
    { icon: CheckCircle2, label: "Acceptance criteria", color: "bg-mint" },
    { icon: Ticket, label: "Jira tickets", color: "bg-peach" },
    { icon: ArrowRight, label: "Next steps", color: "bg-blush" },
  ];
  return (
    <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map(({ icon: Icon, label, color }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/70 p-4 text-center shadow-soft backdrop-blur"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-5 w-5 text-foreground/80" />
          </div>
          <span className="text-xs font-medium text-foreground/80">{label}</span>
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  const dots = ["bg-blush", "bg-lavender", "bg-mint", "bg-peach", "bg-primary/70"];
  return (
    <div className="mt-10 flex flex-col items-center gap-5 rounded-2xl border border-border/60 bg-card/70 p-10 text-center shadow-soft backdrop-blur">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="absolute inset-2 rounded-full bg-gradient-primary opacity-80 blur-md" />
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </span>
      </div>
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold">Crafting your PM breakdown…</p>
        <p className="text-sm text-muted-foreground">Sprinkling some pink magic ✨ — usually 5–15 seconds.</p>
      </div>
      <div className="flex items-center gap-2">
        {dots.map((c, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${c} animate-bounce`}
            style={{ animationDelay: `${i * 120}ms`, animationDuration: "900ms" }}
          />
        ))}
      </div>
    </div>
  );
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied to clipboard"),
    () => toast.error("Couldn't copy")
  );
}

function Results({ data }: { data: GenerateResult }) {
  const allText = formatAll(data);

  const exportAll = () => {
    exportPdf("PinkPrint — PM Breakdown", [
      { heading: "PRD Summary", lines: [data.prd_summary] },
      {
        heading: "User Stories",
        lines: data.user_stories.map((s) => `• ${s.title} — ${s.story}`),
      },
      {
        heading: "Acceptance Criteria",
        lines: data.acceptance_criteria.map((c) => `• ${c}`),
      },
      {
        heading: "Jira Tickets",
        lines: data.jira_tickets.flatMap((t) => [
          `[${t.key}] (${t.type}, ${t.priority}) ${t.summary}`,
          t.description,
          "",
        ]),
      },
      {
        heading: "Recommended Next Steps",
        lines: data.next_steps.map((s, i) => `${i + 1}. ${s}`),
      },
    ], "pinkprint-breakdown.pdf");
    toast.success("PDF exported");
  };

  const exportSection = (heading: string, lines: string[], filename: string) => {
    exportPdf(`PinkPrint — ${heading}`, [{ heading, lines }], filename);
    toast.success("PDF exported");
  };

  return (
    <Card className="border-border/60 bg-card/85 shadow-glow backdrop-blur">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="font-display text-2xl">Your PM breakdown</CardTitle>
          <CardDescription>Review, copy, or export to PDF.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => copy(allText)}>
            <Copy className="mr-2 h-4 w-4" /> Copy all
          </Button>
          <Button
            size="sm"
            onClick={exportAll}
            className="bg-gradient-primary text-primary-foreground shadow-soft"
          >
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="prd" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
            <TabsTrigger value="prd">PRD</TabsTrigger>
            <TabsTrigger value="stories">Stories</TabsTrigger>
            <TabsTrigger value="ac">Criteria</TabsTrigger>
            <TabsTrigger value="jira">Jira</TabsTrigger>
            <TabsTrigger value="next">Next</TabsTrigger>
          </TabsList>

          <TabsContent value="prd" className="mt-6">
            <Section
              title="PRD Summary"
              onCopy={() => copy(data.prd_summary)}
              onExport={() => exportSection("PRD Summary", [data.prd_summary], "pinkprint-prd.pdf")}
            >
              <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{data.prd_summary}</p>
            </Section>
          </TabsContent>

          <TabsContent value="stories" className="mt-6 space-y-3">
            {data.user_stories.map((s, i) => (
              <Section
                key={i}
                title={s.title}
                onCopy={() => copy(`${s.title}\n${s.story}`)}
                onExport={() =>
                  exportSection(s.title, [s.story], `pinkprint-story-${i + 1}.pdf`)
                }
              >
                <p className="leading-relaxed text-foreground/90">{s.story}</p>
              </Section>
            ))}
          </TabsContent>

          <TabsContent value="ac" className="mt-6">
            <Section
              title="Acceptance Criteria"
              onCopy={() => copy(data.acceptance_criteria.map((c) => `• ${c}`).join("\n"))}
              onExport={() =>
                exportSection(
                  "Acceptance Criteria",
                  data.acceptance_criteria.map((c) => `• ${c}`),
                  "pinkprint-acceptance-criteria.pdf"
                )
              }
            >
              <ul className="space-y-2">
                {data.acceptance_criteria.map((c, i) => (
                  <li key={i} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="leading-relaxed text-foreground/90">{c}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </TabsContent>

          <TabsContent value="jira" className="mt-6 space-y-3">
            {data.jira_tickets.map((t, i) => (
              <Section
                key={i}
                title={`${t.key} · ${t.summary}`}
                onCopy={() =>
                  copy(`[${t.key}] (${t.type}, ${t.priority}) ${t.summary}\n\n${t.description}`)
                }
                onExport={() =>
                  exportSection(
                    `${t.key} — ${t.summary}`,
                    [`Type: ${t.type}`, `Priority: ${t.priority}`, "", t.description],
                    `pinkprint-${t.key.toLowerCase()}.pdf`
                  )
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/20">{t.type}</Badge>
                  <Badge variant="outline">{t.priority}</Badge>
                  {t.labels?.map((l) => (
                    <Badge key={l} variant="secondary" className="bg-accent text-accent-foreground">
                      {l}
                    </Badge>
                  ))}
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{t.description}</p>
              </Section>
            ))}
          </TabsContent>

          <TabsContent value="next" className="mt-6">
            <Section
              title="Recommended Next Steps"
              onCopy={() => copy(data.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n"))}
              onExport={() =>
                exportSection(
                  "Recommended Next Steps",
                  data.next_steps.map((s, i) => `${i + 1}. ${s}`),
                  "pinkprint-next-steps.pdf"
                )
              }
            >
              <ol className="space-y-2">
                {data.next_steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed text-foreground/90">{s}</span>
                  </li>
                ))}
              </ol>
            </Section>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  children,
  onCopy,
  onExport,
}: {
  title: string;
  children: React.ReactNode;
  onCopy: () => void;
  onExport: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onCopy} className="text-muted-foreground hover:text-foreground" title="Copy">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onExport} className="text-muted-foreground hover:text-foreground" title="Export PDF">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

function formatAll(d: GenerateResult): string {
  const lines: string[] = [];
  lines.push("# PRD Summary", d.prd_summary, "");
  lines.push("# User Stories");
  d.user_stories.forEach((s) => lines.push(`- ${s.title}: ${s.story}`));
  lines.push("", "# Acceptance Criteria");
  d.acceptance_criteria.forEach((c) => lines.push(`- ${c}`));
  lines.push("", "# Jira Tickets");
  d.jira_tickets.forEach((t) =>
    lines.push(`- [${t.key}] (${t.type}, ${t.priority}) ${t.summary}\n  ${t.description}`)
  );
  lines.push("", "# Next Steps");
  d.next_steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  return lines.join("\n");
}

function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-5 pb-10 text-center text-xs text-muted-foreground">
      Made with <Heart className="inline h-3 w-3 text-primary" fill="currentColor" /> for product
      managers.
    </footer>
  );
}
