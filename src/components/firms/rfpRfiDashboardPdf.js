import { jsPDF } from "jspdf";
import { drawMyKumpareBranding } from "@/components/reports/reportBranding";

// Exports the current (filtered/sorted) RFP/RFI dashboard view to a branded
// PDF. Captures the active filter context, a stats strip, and every visible
// opportunity with its type, status, progress, decision, due date, product
// match, and notes. Uses the shared MyKumpare header/footer branding.

const INK = [31, 41, 55];
const MUTED = [120, 128, 140];
const PRIMARY = [37, 99, 235];
const BORDER = [226, 232, 240];

function fmt(d) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function daysAway(d) {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(d + "T00:00:00");
  return Math.round((due - today) / 86400000);
}

export function generateRfpRfiDashboardPdf({ items, filters = {}, totalCount }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensure = (need) => {
    if (y + need > pageH - 50) {
      drawMyKumpareBranding(doc);
      doc.addPage();
      y = margin;
    }
  };

  // ── Header band ──
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text("RFP / RFI Dashboard", margin, y + 6);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const stamp = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  doc.text(`Generated ${stamp}`, margin, y);
  y += 12;

  // ── Filter context ──
  const filterParts = [];
  filterParts.push(`Status: ${filters.statusFilter || "all"}`);
  if (filters.decisionFilter && filters.decisionFilter !== "all") filterParts.push(`Decision: ${filters.decisionFilter}`);
  if (filters.search) filterParts.push(`Search: "${filters.search}"`);
  filterParts.push(`Sort: ${filters.sortBy || "due_asc"}`);
  filterParts.push(`${items.length} of ${totalCount} shown`);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(filterParts.join("   ·   "), margin, y);
  y += 16;

  // ── Stats strip ──
  const stats = {
    total: items.length,
    open: items.filter((r) => r.status === "Open").length,
    needsReview: items.filter((r) => (r.decision_status || "Needs Review") === "Needs Review").length,
    submitted: items.filter((r) => r.decision_status === "Submitted").length,
    passed: items.filter((r) => r.decision_status === "Passed").length,
    match: items.filter((r) => r.product_match_status === "Match" || r.product_match_status === "Near Match").length,
  };
  const statBoxes = [
    { label: "SHOWN", value: stats.total, color: INK },
    { label: "OPEN", value: stats.open, color: [16, 122, 87] },
    { label: "NEEDS REVIEW", value: stats.needsReview, color: [180, 120, 40] },
    { label: "SUBMITTED", value: stats.submitted, color: PRIMARY },
    { label: "PASSED", value: stats.passed, color: [185, 60, 60] },
    { label: "PRODUCT MATCH", value: stats.match, color: [5, 122, 85] },
  ];
  const boxW = (pageW - margin * 2 - 5 * 8) / 6;
  statBoxes.forEach((s, i) => {
    const x = margin + i * (boxW + 8);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, boxW, 34, 4, 4, "F");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(s.label, x + 8, y + 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...s.color);
    doc.text(String(s.value), x + 8, y + 27);
  });
  y += 44;

  // ── Column headers ──
  const cols = [
    { key: "title", label: "Title / Firm", w: 180 },
    { key: "type", label: "Type", w: 50 },
    { key: "status", label: "Status", w: 55 },
    { key: "progress", label: "Progress", w: 65 },
    { key: "decision", label: "Decision", w: 65 },
    { key: "due", label: "Due", w: 70 },
    { key: "match", label: "Product Match", w: 150 },
    { key: "notes", label: "Notes", w: 160 },
  ];
  const headerY = y;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, headerY, pageW - margin * 2, 20, "F");
  let cx = margin + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK);
  cols.forEach((c) => {
    doc.text(c.label, cx, headerY + 13);
    cx += c.w;
  });
  y = headerY + 20;

  // ── Rows ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let alt = false;
  items.forEach((r) => {
    const rowH = 34;
    ensure(rowH + 6);
    if (alt) {
      doc.setFillColor(250, 251, 252);
      doc.rect(margin, y, pageW - margin * 2, rowH, "F");
    }
    alt = !alt;

    cx = margin + 6;
    // Title + firm
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    const titleLines = doc.splitTextToSize(r.title || "Untitled", cols[0].w - 8);
    doc.text(titleLines.slice(0, 2), cx, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(6.5);
    doc.text((r.firm_name || "—").slice(0, 40), cx, y + 22);
    doc.setFontSize(7.5);
    cx += cols[0].w;

    // Type
    doc.setTextColor(...INK);
    doc.text(r.rfp_type || "—", cx, y + 11);
    cx += cols[1].w;

    // Status
    doc.text(r.status || "—", cx, y + 11);
    cx += cols[2].w;

    // Progress
    doc.text(r.progress_status || "Draft", cx, y + 11);
    cx += cols[3].w;

    // Decision
    doc.text(r.decision_status || "Needs Review", cx, y + 11);
    cx += cols[4].w;

    // Due
    const days = daysAway(r.due_date);
    const dueColor = days !== null && days < 0 ? [185, 60, 60] : INK;
    doc.setTextColor(...dueColor);
    doc.text(fmt(r.due_date), cx, y + 11);
    if (days !== null) {
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(days === 0 ? "Today" : days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`, cx, y + 21);
      doc.setFontSize(7.5);
    }
    cx += cols[5].w;

    // Product match
    const ms = r.product_match_status || "Not Checked";
    doc.setTextColor(ms === "Match" ? [5, 122, 85] : ms === "Near Match" ? [180, 120, 40] : ms === "No Match" ? [185, 60, 60] : MUTED);
    doc.setFont("helvetica", "bold");
    doc.text(ms, cx, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    if (r.matched_product_names && r.matched_product_names.length) {
      const names = doc.splitTextToSize(r.matched_product_names.join(", "), cols[6].w - 8);
      doc.text(names.slice(0, 2), cx, y + 21);
    } else if (r.product_match_summary) {
      const sum = doc.splitTextToSize(r.product_match_summary, cols[6].w - 8);
      doc.setTextColor(...MUTED);
      doc.setFontSize(6.5);
      doc.text(sum.slice(0, 2), cx, y + 21);
      doc.setFontSize(7.5);
    }
    cx += cols[6].w;

    // Notes
    doc.setTextColor(...MUTED);
    if (r.notes) {
      const noteLines = doc.splitTextToSize(r.notes, cols[7].w - 8);
      doc.text(noteLines.slice(0, 3), cx, y + 11);
    } else {
      doc.text("—", cx, y + 11);
    }

    y += rowH;
  });

  // ── Branding footer on all pages ──
  drawMyKumpareBranding(doc);

  const stamp2 = new Date().toISOString().slice(0, 10);
  doc.save(`RFP-RFI-Dashboard-${stamp2}.pdf`);
}