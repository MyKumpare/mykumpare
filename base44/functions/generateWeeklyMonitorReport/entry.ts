import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Generates a weekly Monitor summary aggregating firm news, contact activity,
// and completed follow-up tasks. Returns structured data for PDF rendering.
// When email_to_admins is true (workflow mode), also emails an HTML summary
// to all admin users and uses the service role for data access.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(parseInt(body.days, 10) || 7, 1), 90);
    const emailToAdmins = !!body.email_to_admins;

    // Workflow calls (emailToAdmins) use the service role; UI calls use the
    // user's context so RLS scopes reads to their tenant.
    let dataClient: any;
    if (emailToAdmins) {
      dataClient = base44.asServiceRole;
    } else {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      dataClient = base44;
    }

    // Compute the date window (ISO dates)
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startStr = start.toISOString().split('T')[0];
    const endStr = now.toISOString().split('T')[0];

    // Fetch all three data sources in parallel
    const [allNews, allActivities, allTasks] = await Promise.all([
      dataClient.entities.FirmNews.list('-news_date', 1000),
      dataClient.entities.ContactActivity.list('-activity_date', 1000),
      dataClient.entities.FollowUpTask.list('-updated_date', 1000),
    ]);

    // ── Filter to the date window ──
    const weekNews = allNews.filter((n: any) =>
      !n.deleted_at && n.news_date && n.news_date >= startStr && n.news_date <= endStr
    );

    const weekActivities = allActivities.filter((a: any) =>
      a.activity_date && a.activity_date >= startStr && a.activity_date <= endStr
    );

    const weekTasks = allTasks.filter((t: any) => {
      if (t.status !== 'Completed') return false;
      const cd = t.completion_date || t.status_date;
      return cd && cd >= startStr && cd <= endStr;
    });

    // ── Aggregate stats ──
    const stats = {
      news_total: weekNews.length,
      news_high: weekNews.filter((n: any) => n.alert_status === 'High').length,
      news_medium: weekNews.filter((n: any) => n.alert_status === 'Medium').length,
      news_low: weekNews.filter((n: any) => n.alert_status === 'Low').length,
      news_positive: weekNews.filter((n: any) => n.news_status === 'Positive').length,
      news_negative: weekNews.filter((n: any) => n.news_status === 'Negative').length,
      news_neutral: weekNews.filter((n: any) => n.news_status === 'Neutral').length,
      activities_total: weekActivities.length,
      activities_by_type: {
        Call: weekActivities.filter((a: any) => a.activity_type === 'Call').length,
        Email: weekActivities.filter((a: any) => a.activity_type === 'Email').length,
        Meeting: weekActivities.filter((a: any) => a.activity_type === 'Meeting').length,
        Note: weekActivities.filter((a: any) => a.activity_type === 'Note').length,
        Other: weekActivities.filter((a: any) => a.activity_type === 'Other').length,
      },
      tasks_completed: weekTasks.length,
    };

    // ── Group news by firm ──
    const byFirm = new Map<string, any>();
    for (const n of weekNews) {
      const key = n.firm_id || 'unknown';
      if (!byFirm.has(key)) {
        byFirm.set(key, { firm_id: key, firm_name: n.firm_name || 'Unknown Firm', items: [] });
      }
      byFirm.get(key)!.items.push({
        id: n.id,
        news_date: n.news_date,
        headline: n.headline,
        summary: n.summary,
        alert_status: n.alert_status || 'Low',
        news_status: n.news_status || 'Neutral',
        article_url: n.article_url,
        source_type: n.source_type || 'firm',
        source_name: n.source_name,
      });
    }
    const firms = Array.from(byFirm.values()).sort((a, b) => b.items.length - a.items.length);

    // ── Format activities ──
    const activities = weekActivities
      .sort((a: any, b: any) => (b.activity_date || '').localeCompare(a.activity_date || ''))
      .map((a: any) => ({
        id: a.id,
        activity_date: a.activity_date,
        activity_type: a.activity_type,
        subjects: a.subjects || [],
        notes: a.notes ? a.notes.replace(/<[^>]*>/g, '').trim().substring(0, 200) : '',
        firms: (a.associated_firms_contacts || []).map((fc: any) => fc.firm_name).filter(Boolean),
      }));

    // ── Format completed tasks ──
    const tasks = weekTasks
      .sort((a: any, b: any) =>
        (b.completion_date || b.status_date || '').localeCompare(a.completion_date || a.status_date || '')
      )
      .map((t: any) => ({
        id: t.id,
        description: t.task_description ? t.task_description.replace(/<[^>]*>/g, '').trim().substring(0, 200) : '',
        due_date: t.due_date,
        completion_date: t.completion_date || t.status_date,
        assigned_to: t.assigned_to_contact_name || '',
        firm_name: t.assigned_to_firm_name || '',
      }));

    // ── High-impact news alerts ──
    const highAlertItems = weekNews
      .filter((n: any) => n.alert_status === 'High')
      .sort((a: any, b: any) => (b.news_date || '').localeCompare(a.news_date || ''))
      .map((n: any) => ({
        firm_name: n.firm_name || 'Unknown Firm',
        news_date: n.news_date,
        headline: n.headline,
        news_status: n.news_status || 'Neutral',
        article_url: n.article_url,
      }));

    const hasData = weekNews.length > 0 || weekActivities.length > 0 || weekTasks.length > 0;

    // ── AI executive summary ──
    let summary = '';
    let keyThemes: string[] = [];
    if (hasData) {
      try {
        const newsHeadlines = weekNews.slice(0, 60).map((n: any) =>
          `- [${n.alert_status || 'Low'}/${n.news_status || 'Neutral'}] ${n.firm_name || 'Unknown'}: ${n.headline}`
        ).join('\n');
        const activityLines = weekActivities.slice(0, 40).map((a: any) =>
          `- ${a.activity_type}: ${a.subjects?.join(', ') || 'activity'} (${(a.associated_firms_contacts || []).map((fc: any) => fc.firm_name).filter(Boolean).join(', ') || 'general'})`
        ).join('\n');
        const taskLines = weekTasks.slice(0, 30).map((t: any) =>
          `- Completed: ${t.task_description?.replace(/<[^>]*>/g, '').trim().substring(0, 100) || 'task'}`
        ).join('\n');

        const llmRes: any = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a financial research analyst preparing a weekly Monitor summary for an investment team. Synthesize the following into a concise executive summary (4-6 sentences) covering key news developments, activity highlights, and task completion progress. Also list 4-8 key themes as short bullet labels. Be professional, objective, and insightful. Highlight any high-impact or negative developments.\n\nNEWS (${weekNews.length} items):\n${newsHeadlines}\n\nACTIVITIES (${weekActivities.length} items):\n${activityLines}\n\nCOMPLETED TASKS (${weekTasks.length} items):\n${taskLines}`,
          response_json_schema: {
            type: 'object',
            properties: {
              executive_summary: { type: 'string' },
              key_themes: { type: 'array', items: { type: 'string' } },
            },
          },
        });
        summary = llmRes?.executive_summary || '';
        keyThemes = Array.isArray(llmRes?.key_themes)
          ? llmRes.key_themes.filter((t: any) => t && String(t).trim()).map((t: any) => String(t).trim())
          : [];
      } catch (e: any) {
        console.error('LLM synthesis failed:', e.message);
        summary = 'AI synthesis was unavailable for this period. See the detailed sections below for the full breakdown.';
        keyThemes = [];
      }
    }

    const result: any = {
      status: 'success',
      week_start: startStr,
      week_end: endStr,
      generated_at: now.toISOString(),
      stats,
      firms,
      activities,
      tasks,
      high_alert_items: highAlertItems,
      summary,
      key_themes: keyThemes,
      total_news: weekNews.length,
      total_activities: weekActivities.length,
      total_tasks: weekTasks.length,
    };

    // ── Email mode: send HTML summary to all admins ──
    if (emailToAdmins) {
      const users = await base44.asServiceRole.entities.User.list();
      const admins = users.filter((u: any) => u.role === 'admin' && u.email);
      if (admins.length > 0) {
        const htmlBody = buildEmailHtml(result);
        for (const admin of admins) {
          try {
            await base44.integrations.Core.SendEmail({
              to: admin.email,
              subject: `Weekly Monitor Summary Report — ${startStr} to ${endStr}`,
              body: htmlBody,
            });
          } catch (e: any) {
            console.error(`Failed to email ${admin.email}:`, e.message);
          }
        }
      }
      result.email_sent_to = admins.length;
    }

    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function buildEmailHtml(r: any): string {
  const s = r.stats || {};
  const fmt = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const newsRows = (r.high_alert_items || []).slice(0, 10).map((item: any) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#b91c1c;font-weight:600;font-size:12px;">${fmt(item.news_date)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;"><strong>${item.firm_name}</strong> — ${item.headline}</td></tr>`
  ).join('');

  const activityByType = s.activities_by_type || {};
  const activitySummary = Object.entries(activityByType).filter(([, v]) => v > 0).map(([k, v]) =>
    `${k}: ${v}`
  ).join(' · ') || 'None';

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:640px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#e11d48,#9f1239);padding:20px 24px;border-radius:8px 8px 0 0;color:#fff;">
    <h1 style="margin:0;font-size:20px;">Weekly Monitor Summary Report</h1>
    <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">${fmt(r.week_start)} — ${fmt(r.week_end)}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:20px 24px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="text-align:center;padding:10px;background:#f9fafb;border-radius:6px;"><div style="font-size:22px;font-weight:700;color:#111827;">${r.total_news}</div><div style="font-size:10px;color:#6b7280;text-transform:uppercase;">News Items</div></td>
        <td style="text-align:center;padding:10px;background:#f9fafb;border-radius:6px;"><div style="font-size:22px;font-weight:700;color:#b91c1c;">${s.news_high}</div><div style="font-size:10px;color:#6b7280;text-transform:uppercase;">High Impact</div></td>
        <td style="text-align:center;padding:10px;background:#f9fafb;border-radius:6px;"><div style="font-size:22px;font-weight:700;color:#111827;">${r.total_activities}</div><div style="font-size:10px;color:#6b7280;text-transform:uppercase;">Activities</div></td>
        <td style="text-align:center;padding:10px;background:#f9fafb;border-radius:6px;"><div style="font-size:22px;font-weight:700;color:#16a34a;">${r.total_tasks}</div><div style="font-size:10px;color:#6b7280;text-transform:uppercase;">Tasks Done</div></td>
      </tr>
    </table>
    <h2 style="font-size:15px;color:#111827;margin:0 0 8px;">Executive Summary</h2>
    <p style="font-size:13px;line-height:1.6;color:#374151;">${r.summary || 'No summary available.'}</p>
    ${r.key_themes && r.key_themes.length ? `<h2 style="font-size:15px;color:#111827;margin:16px 0 8px;">Key Themes</h2><ul style="font-size:13px;color:#374151;padding-left:18px;">${r.key_themes.map((t: string) => `<li style="margin-bottom:4px;">${t}</li>`).join('')}</ul>` : ''}
    ${newsRows ? `<h2 style="font-size:15px;color:#b91c1c;margin:16px 0 8px;">High-Impact Alerts</h2><table style="width:100%;border-collapse:collapse;">${newsRows}</table>` : ''}
    <h2 style="font-size:15px;color:#111827;margin:16px 0 8px;">Activity Breakdown</h2>
    <p style="font-size:13px;color:#374151;">${activitySummary}</p>
    <p style="font-size:12px;color:#6b7280;margin-top:20px;border-top:1px solid #eee;padding-top:12px;">Generated ${new Date(r.generated_at).toLocaleString('en-US')}</p>
  </div>
  </body></html>`;
}