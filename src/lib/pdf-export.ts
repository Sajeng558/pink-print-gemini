import { jsPDF } from "jspdf";

type Block = { heading?: string; lines: string[] };

export function exportPdf(title: string, blocks: Block[], filename: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(180, 80, 130);
  doc.text(title, margin, y);
  y += 28;

  doc.setDrawColor(240, 200, 220);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  for (const block of blocks) {
    if (block.heading) {
      ensureSpace(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(120, 60, 100);
      doc.text(block.heading, margin, y);
      y += 18;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 50);

    for (const line of block.lines) {
      const wrapped = doc.splitTextToSize(line, contentWidth);
      for (const w of wrapped) {
        ensureSpace(16);
        doc.text(w, margin, y);
        y += 15;
      }
      y += 4;
    }

    y += 10;
  }

  doc.save(filename);
}
