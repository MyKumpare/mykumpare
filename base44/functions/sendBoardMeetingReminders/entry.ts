import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Daily 2-day-ahead board meeting reminder. Finds board meetings scheduled
// exactly 2 days from today (in America/New_York), creates a BoardMeetingAlert
// (upcoming_reminder) in the Monitor section, and emails a digest to the app
// admin. Designed to run via the "Board Meeting Reminders" workflow.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Compute "2 days from now" in America/New_York
    const nowStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nyNow = new Date(nowStr);
    const target = new Date(nyNow);
    target.setDate(target.getDate() + 2);
    const targetDate = target.toISOString().slice(0, 10);

    const allMeetings = await base44.asServiceRole.entities.BoardMeeting.list('-meeting_date', 2000).catch(() => []);
    const dueMeetings = (allMeetings || []).filter((m: any) =>
      !m.deleted_at && (m.meeting_date || '').slice(0, 10) === targetDate
    );

    if (!dueMeetings.length) {
      return Response.json({ status: 'ok', target_date: targetDate, reminders_sent: 0, email_sent: false });
    }

    // Deduplicate against existing upcoming_reminder alerts for this target date
    const existingAlerts = await base44.asServiceRole.entities.BoardMeetingAlert.list('-created_date', 500).catch(() => []);
    const dedup = new Set<string>();
    for (const a of (existingAlerts || [])) {
      if (a.deleted_at || a.alert_type !== 'upcoming_reminder') continue;
      dedup.add(`${a.meeting_id}|${targetDate}`);
    }

    let remindersSent = 0;
    const emailLines: string[] = [];

    for (const m of dueMeetings) {
      const key = `${m.id}|${targetDate}`;
      if (dedup.has(key)) continue;
      dedup.add(key);

      let tenantId: string | undefined = m.tenant_id;
      let firmName = m.firm_name || '';
      if (m.firm_id && !tenantId) {
        const firm = await base44.asServiceRole.entities.Firm.get(m.firm_id).catch(() => null);
        if (firm) { tenantId = firm.tenant_id || undefined; firmName = firm.name; }
      }

      const mentionNames = (m.mentions || []).map((x: any) => x.entity_name).filter(Boolean).join(', ');
      const flagged = m.needs_review && !m.reviewed;
      const details = `Reminder: "${m.title || 'Untitled'}" is scheduled in 2 days (${targetDate}).${mentionNames ? ` Mentions: ${mentionNames}.` : ''}${flagged ? ' Flagged for review.' : ''}`;

      await base44.asServiceRole.entities.BoardMeetingAlert.create({
        tenant_id: tenantId || undefined,
        firm_id: m.firm_id || '',
        firm_name: firmName,
        alert_type: 'upcoming_reminder',
        meeting_title: m.title || 'Untitled board meeting',
        meeting_date: m.meeting_date || targetDate,
        meeting_id: m.id,
        details,
        source_url: m.source_url || '',
        is_read: false,
        is_dismissed: false,
      });
      remindersSent++;
      emailLines.push(`• ${m.title || 'Untitled'} — ${firmName} — ${m.meeting_date || targetDate}${flagged ? ' (FLAGGED FOR REVIEW)' : ''}${mentionNames ? ` [Mentions: ${mentionNames}]` : ''}`);
    }

    // Email digest to the first admin user
    let emailSent = false;
    if (remindersSent > 0) {
      try {
        const users = await base44.asServiceRole.entities.User.list().catch(() => []);
        const adminEmail = (users || []).find((u: any) => u.role === 'admin' && u.email)?.email;
        if (adminEmail) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: adminEmail,
            subject: `Board Meeting Reminder: ${remindersSent} meeting${remindersSent === 1 ? '' : 's'} in 2 days (${targetDate})`,
            body: `The following board meeting${remindersSent === 1 ? ' is' : 's are'} scheduled in 2 days (${targetDate}):\n\n${emailLines.join('\n')}\n\nReview them in the Monitor → Bd Mtg Alerts section of your app.`,
          });
          emailSent = true;
        }
      } catch {}
    }

    return Response.json({ status: 'ok', target_date: targetDate, reminders_sent: remindersSent, email_sent: emailSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}