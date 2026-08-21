import { jsPDF } from "jspdf";

const T = {
  margin: 48,
  fontFamily: "helvetica",
  titleSize: 18,
  metaSize: 9,
  roleSize: 10,
  bodySize: 10,
  smallSize: 8,
  titleGap: 20,
  msgGap: 14,
  lineH: 13,
  ink: [17, 24, 39],
  body: [51, 51, 51],
  muted: [120, 128, 140],
  userInk: [67, 56, 202],
  headerBg: [238, 242, 255],
  rowLine: [224, 224, 224],
};

function stripMarkdown(md) {
  if (!md) return "";
  return String(md)
    .replace(/```[\s\S]*?```/g, " [code] ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*(\d+)\.\s+/gm, "$1. ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^\s*>\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function exportAgentConversationPdf({ title, agentName, messages }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - T.margin * 2;
  let y = T.margin;

  const ensure = (h) => {
    if (y + h > pageH - T.margin) { doc.addPage(); y = T.margin; }
  };

  // Header
  doc.setFont(T.fontFamily, "bold");
  doc.setFontSize(T.titleSize);
  doc.setTextColor(...T.ink);
  doc.text(title || "AI Agent Report", T.margin, y);
  y += T.titleGap;
  doc.setFont(T.fontFamily, "normal");
  doc.setFontSize(T.metaSize);
  doc.setTextColor(...T.muted);
  doc.text(`${agentName || "AI Agent"}  •  ${new Date().toLocaleString()}`, T.margin, y);
  y += 8;
  doc.setDrawColor(...T.muted);
  doc.setLineWidth(0.5);
  doc.line(T.margin, y, pageW - T.margin, y);
  y += T.msgGap;

  const addText = (text, size, color) => {
    doc.setFont(T.fontFamily, "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.splitTextToSize(text, contentW).forEach((line) => {
      ensure(T.lineH);
      doc.text(line, T.margin, y);
      y += T.lineH;
    });
  };

  const renderTable = (table) => {
    const headers = table.headers || [];
    const rows = table.rows || [];
    if (!headers.length && !rows.length) return;
    const cols = headers.length || (rows[0]?.length || 1);
    const colW = contentW / cols;
    const pad = 4;
    const hH = T.lineH + 2;
    ensure(hH);
    doc.setFillColor(...T.headerBg);
    doc.rect(T.margin, y - T.lineH + 2, contentW, hH, "F");
    doc.setFont(T.fontFamily, "bold");
    doc.setFontSize(T.smallSize);
    doc.setTextColor(...T.ink);
    headers.forEach((h, ci) => {
      const txt = doc.splitTextToSize(String(h ?? ""), colW - pad * 2, T.smallSize)[0] || "";
      doc.text(txt, T.margin + ci * colW + pad, y);
    });
    y += hH;
    doc.setFont(T.fontFamily, "normal");
    doc.setTextColor(...T.body);
    rows.forEach((row) => {
      const cells = (Array.isArray(row) ? row : Object.values(row || {})).slice(0, cols);
      const cellLines = cells.map((c) => doc.splitTextToSize(String(c ?? ""), colW - pad * 2, T.smallSize));
      const maxLines = Math.max(1, ...cellLines.map((c) => c.length));
      const rowH = maxLines * 11 + pad;
      ensure(rowH);
      cellLines.forEach((lines, ci) => {
        lines.forEach((line, li) => {
          doc.text(line, T.margin + ci * colW + pad, y + li * 11);
        });
      });
      y += rowH;
      doc.setDrawColor(...T.rowLine);
      doc.setLineWidth(0.3);
      doc.line(T.margin, y, T.margin + contentW, y);
    });
    y += 6;
  };

  (messages || []).forEach((msg) => {
    if (!msg) return;
    const isUser = msg.role === "user";
    ensure(T.lineH + 4);
    doc.setFont(T.fontFamily, "bold");
    doc.setFontSize(T.roleSize);
    doc.setTextColor(...(isUser ? T.userInk : T.ink));
    doc.text(isUser ? "You" : (agentName || "Agent"), T.margin, y);
    y += T.lineH;

    if (msg.content) addText(stripMarkdown(msg.content), T.bodySize, T.body);

    if (Array.isArray(msg.tables)) {
      msg.tables.forEach((table) => {
        y += 4;
        if (table.title) {
          ensure(T.lineH);
          doc.setFont(T.fontFamily, "bold");
          doc.setFontSize(T.smallSize);
          doc.setTextColor(...T.ink);
          doc.text(table.title, T.margin, y);
          y += T.lineH;
        }
        renderTable(table);
      });
    }

    if (Array.isArray(msg.charts) && msg.charts.length) {
      msg.charts.forEach((ch) => {
        ensure(T.lineH);
        doc.setFont(T.fontFamily, "italic");
        doc.setFontSize(T.smallSize);
        doc.setTextColor(...T.muted);
        doc.text(`[chart: ${ch.title || ch.chart_type || "visualization"}]`, T.margin, y);
        y += T.lineH;
      });
    }

    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
      msg.tool_calls.forEach((tc) => {
        const proj = tc.display_projection || {};
        const label = proj.label || tc.name || "tool";
        const status = tc.status || "completed";
        const line = `↳ ${label} — ${status}`;
        doc.setFont(T.fontFamily, "normal");
        doc.setFontSize(T.smallSize);
        doc.setTextColor(...T.muted);
        doc.splitTextToSize(line, contentW - 12).forEach((l) => {
          ensure(T.lineH);
          doc.text(l, T.margin + 12, y);
          y += T.lineH;
        });
      });
    }

    y += T.msgGap;
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont(T.fontFamily, "normal");
    doc.setFontSize(T.smallSize);
    doc.setTextColor(...T.muted);
    doc.text(`${i} / ${pages}`, pageW - T.margin, pageH - 20, { align: "right" });
  }

  const safe = (title || "agent-report").replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "");
  doc.save(`${safe || "agent-report"}.pdf`);
}