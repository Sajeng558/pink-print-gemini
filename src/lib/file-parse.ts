// Parse txt / doc / docx / pdf files in the browser into plain text.

export async function parseFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const ext = name.split(".").pop() || "";

  if (file.type.startsWith("text/") || ["txt", "md", "log", "csv"].includes(ext)) {
    return await file.text();
  }

  if (ext === "docx" || ext === "doc") {
    const mammoth = await import("mammoth/mammoth.browser");
    const arrayBuffer = await file.arrayBuffer();
    const result = await (mammoth as any).extractRawText({ arrayBuffer });
    return (result?.value || "").trim();
  }

  if (ext === "pdf" || file.type === "application/pdf") {
    const pdfjs: any = await import("pdfjs-dist");
    const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const out: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
      out.push(text);
    }
    return out.join("\n\n").trim();
  }

  throw new Error("Unsupported file type. Please upload TXT, DOC, DOCX or PDF.");
}
