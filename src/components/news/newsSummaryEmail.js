import { base44 } from "@/api/base44Client";

const fmt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-US") : "—");

const escapeHtml = (str) =>
  String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const alertBg = (s) => (s === "High" ? "#dc2626" : s === "Medium" ? "#d97706" : "#2563eb");
const statusBg = (s) => (s === "Positive" ? "#059669" : s === "Negative" ? "#dc2626" : "#6b7280");

// Builds the email subject + HTML body for a generated news summary report.
// `report` shape matches the object produced by NewsSummaryDialog / NewsSelectionSummaryDialog.
export function buildSummaryEmail(report) {
  const { targetLabel, startDate, endDate, stats, overallAlert, overallStatus, summary, items } = report;
  const subject = `News Summary — ${targetLabel} (${fmt(startDate)} to ${fmt(endDate)})`;

  const statCell = (label, value, color) =>
    `<td style="padding:8px 6px;text-align:center;border:1px solid #eef;border-radius:8px;background:#fff;width:20%;"><div style="font-size:20px;font-weight:700;color:${color};">${value}</div><div style="font-size:10px;letter-spacing:1px;color:#9ca3af;text-transform:uppercase;">${label}</div></td>`;

  const itemRows = (items || [])
    .slice(0, 50)
    .map((it, i) => {
      const a = it.alert_status || "Low";
      const st = it.news_status || "Neutral";
      return `<tr>
        <td style="padding:6px 4px;color:#6b7280;font-size:12px;white-space:nowrap;vertical-align:top;">${it.news_date ? fmt(it.news_date) : "—"}</td>
        <td style="padding:6px 4px;white-space:nowrap;vertical-align:top;">
          <span style="font-size:10px;font-weight:600;color:#fff;background:${alertBg(a)};padding:1px 6px;border-radius:6px;">${a}</span>
          <span style="font-size:10px;font-weight:600;color:#fff;background:${statusBg(st)};padding:1px 6px;border-radius:6px;margin-left:2px;">${st}</span>
        </td>
        <td style="padding:6px 4px;font-size:12px;color:#374151;vertical-align:top;">
          <div style="font-weight:600;">${escapeHtml(it.headline)}</div>
          ${it.summary ? `<div style="color:#6b7280;margin-top:2px;">${escapeHtml(it.summary.slice(0, 240))}</div>` : ""}
          ${it.article_url ? `<a href="${escapeHtml(it.article_url)}" style="color:#6366f1;font-size:11px;">Read article</a>` : ""}
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;background:#f9fafb;padding:16px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
    <h2 style="margin:0 0 4px;font-size:18px;color:#111827;">News Summary — ${escapeHtml(targetLabel)}</h2>
    <p style="margin:0 0 16px;font-size:12px;color:#6b7280;">${fmt(startDate)} to ${fmt(endDate)} · Generated ${new Date().toLocaleString()}</p>

    <table style="width:100%;border-collapse:separate;border-spacing:4px;margin-bottom:12px;">
      <tr>
        ${statCell("Total", stats.total, "#111827")}
        ${statCell("High", stats.high, "#dc2626")}
        ${statCell("Medium", stats.medium, "#d97706")}
        ${statCell("Negative", stats.negative, "#dc2626")}
        ${statCell("Positive", stats.positive, "#059669")}
      </tr>
    </table>

    <p style="font-size:13px;margin:0 0 12px;">
      <strong>Overall Alert:</strong> <span style="color:${alertBg(overallAlert)};">${overallAlert}</span> &nbsp;
      <strong>Overall Status:</strong> <span style="color:${statusBg(overallStatus)};">${overallStatus}</span>
    </p>

    <p style="font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Summary</p>
    <p style="font-size:13px;line-height:1.5;color:#374151;margin:0 0 16px;white-space:pre-wrap;">${escapeHtml(summary)}</p>

    ${items && items.length ? `
    <p style="font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">News Items (${items.length})</p>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="border-bottom:1px solid #e5e7eb;">
        <th style="text-align:left;padding:6px 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;">Date</th>
        <th style="text-align:left;padding:6px 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;">Alert</th>
        <th style="text-align:left;padding:6px 4px;font-size:10px;color:#9ca3af;text-transform:uppercase;">Headline</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>` : ""}
  </div>
</body></html>`;

  return { subject, html };
}

// Sends a generated news summary report to the given email address.
export async function sendSummaryEmail(to, report) {
  const { subject, html } = buildSummaryEmail(report);
  await base44.integrations.Core.SendEmail({ to, subject, body: html });
}