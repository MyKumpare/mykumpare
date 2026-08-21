import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Gathers all High-impact FirmNews alerts detected in the last 24 hours and
 * emails a summary report to every admin user. Invoked daily (morning) by the
 * "Daily News Alert Summary" scheduled workflow, so there is no end-user auth —
 * data access uses the service role.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Fetch recent news (newest first) and keep only High-impact alerts from the last 24h.
    const news = await base44.asServiceRole.entities.FirmNews.list("-created_date", 500);
    const alerts = news.filter((n) => {
      if (n.deleted_at) return false;
      if (n.alert_status !== "High") return false;
      if (!n.created_date) return false;
      return new Date(n.created_date) >= cutoff;
    });

    // Notify all admin users.
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter((u) => u.role === "admin" && u.email);
    if (admins.length === 0) return Response.json({ skipped: "no admin recipients" });

    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    let subject: string;
    let body: string;

    if (alerts.length === 0) {
      subject = `✅ Daily News Alert Summary — ${dateStr} (No High-Impact Alerts)`;
      body = [
        `<h2 style="margin:0 0 8px;color:#111827;">Daily News Alert Summary</h2>`,
        `<p style="margin:0 0 4px;color:#6b7280;font-size:13px;">${dateStr}</p>`,
        `<p style="margin:12px 0;color:#374151;">No high-impact news alerts were detected in the last 24 hours.</p>`,
      ].join("");
    } else {
      subject = `🚨 Daily News Alert Summary — ${dateStr} (${alerts.length} High-Impact Alert${alerts.length === 1 ? "" : "s"})`;
      const rows = alerts.map((a, i) => {
        const firm = a.firm_name || "—";
        const headline = a.headline || "—";
        const date = a.news_date || "—";
        const sentiment = a.news_status || "Neutral";
        const summary = a.summary ? `<p style="margin:4px 0 0;color:#4b5563;font-size:13px;">${escapeHtml(a.summary)}</p>` : "";
        const link = a.article_url
          ? `<a href="${escapeAttr(a.article_url)}" style="color:#2563eb;font-size:12px;">Read article</a>`
          : "";
        return [
          `<tr>`,
          `<td style="padding:10px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">`,
          `<div style="font-size:11px;color:#9ca3af;margin-bottom:2px;">#${i + 1} · ${escapeHtml(firm)} · ${date} · ${sentiment}</div>`,
          `<div style="font-weight:600;color:#111827;font-size:14px;">${escapeHtml(headline)}</div>`,
          summary,
          link,
          `</td>`,
          `</tr>`,
        ].join("");
      }).join("");

      body = [
        `<h2 style="margin:0 0 8px;color:#111827;">Daily News Alert Summary</h2>`,
        `<p style="margin:0 0 4px;color:#6b7280;font-size:13px;">${dateStr}</p>`,
        `<p style="margin:8px 0 12px;color:#374151;">${alerts.length} high-impact news alert${alerts.length === 1 ? "" : "s"} detected in the last 24 hours:</p>`,
        `<table style="width:100%;border-collapse:collapse;">${rows}</table>`,
        `<p style="margin:16px 0 0;color:#9ca3af;font-size:11px;">Review and manage these alerts in MyKumpare.</p>`,
      ].join("");
    }

    let sent = 0;
    const errors = [];
    for (const admin of admins) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject,
          body,
        });
        sent++;
      } catch (e) {
        errors.push({ email: admin.email, error: (e as Error).message });
      }
    }

    return Response.json({
      sent,
      alert_count: alerts.length,
      admin_count: admins.length,
      errors,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return String(s).replace(/"/g, "&quot;");
}