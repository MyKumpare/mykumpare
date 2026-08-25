import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Daily 48-hour deadline reminder for RFP/RFI records. Finds open, active
// RFP/RFI records whose due_date falls within the next 48 hours (today or
// tomorrow, in America/New_York), emails a digest to the app admins, and
// stamps each alerted record with deadline_alert_sent_at so it is not
// alerted again. Designed to run via the "RFP/RFI Deadline Reminders" workflow.
//
// A record is eligible when it:
//   - is not soft-deleted
//   - has a due_date
//   - status is Open (not already Closed)
//   - progress_status is not terminal (Awarded / Not Awarded / Cancelled)
//   - decision_status is not "Passed" (the team decided not to pursue)
//   - has not already been alerted (deadline_alert_sent_at empty)
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Compute today and tomorrow in America/New_York (48-hour window).
    const nowStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const nyNow = new Date(nowStr);
    const today = nyNow.toISOString().slice(0, 10);
    const tomorrow = new Date(nyNow.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const TERMINAL_PROGRESS = ['Awarded', 'Not Awarded', 'Cancelled'];

    const all = await base44.asServiceRole.entities.FirmRfpRfi.list('-due_date', 2000).catch(() => []);
    const dueSoon = (all || []).filter((r: any) =>
      !r.deleted_at &&
      r.due_date &&
      (r.status === 'Open') &&
      !TERMINAL_PROGRESS.includes(r.progress_status) &&
      (r.decision_status || 'Needs Review') !== 'Passed' &&
      !r.deadline_alert_sent_at &&
      (r.due_date === today || r.due_date === tomorrow)
    );

    if (!dueSoon.length) {
      return Response.json({ status: 'ok', today, tomorrow, alerts_sent: 0, email_sent: false });
    }

    const stamp = new Date().toISOString();
    const emailLines: string[] = [];

    for (const r of dueSoon) {
      // Stamp the record so it is not alerted again.
      await base44.asServiceRole.entities.FirmRfpRfi.update(r.id, { deadline_alert_sent_at: stamp }).catch(() => {});

      const dueLabel = r.due_date === today ? 'TODAY' : 'tomorrow';
      const matched = (r.matched_product_names || []).join(', ');
      emailLines.push(
        `• ${r.title || 'Untitled'} — ${r.firm_name || '—'}\n` +
        `  Due: ${r.due_date} (${dueLabel})  |  Type: ${r.rfp_type || '—'}  |  Progress: ${r.progress_status || 'Draft'}  |  Decision: ${r.decision_status || 'Needs Review'}` +
        (matched ? `\n  Matched products: ${matched}` : '') +
        (r.source_url ? `\n  Source: ${r.source_url}` : '')
      );
    }

    // Email digest to all admin users.
    let emailSent = false;
    try {
      const users = await base44.asServiceRole.entities.User.list().catch(() => []);
      const adminEmails = (users || []).filter((u: any) => u.role === 'admin' && u.email).map((u: any) => u.email);
      if (adminEmails.length) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: adminEmails.join(', '),
          subject: `RFP/RFI Deadline Alert: ${dueSoon.length} proposal${dueSoon.length === 1 ? '' : 's'} due within 48 hours`,
          body:
            `The following RFP/RFI ${dueSoon.length === 1 ? 'proposal is' : 'proposals are'} due within the next 48 hours (as of ${today}):\n\n` +
            emailLines.join('\n\n') +
            `\n\nReview them in the Monitor → RFP/RFI section of your app.`,
        });
        emailSent = true;
      }
    } catch {}

    return Response.json({ status: 'ok', today, tomorrow, alerts_sent: dueSoon.length, email_sent: emailSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}