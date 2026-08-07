import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Scheduled maintenance task: finds external-party invitations that have been
// pending (not accepted) for more than 3 days and sends a reminder email to the
// internal user who created the invitation.  Called by the daily scheduled
// workflow "External Invitation Reminders".  Also callable directly by an admin.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    // 3-day cutoff
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - THREE_DAYS_MS);

    // Fetch all pending invitations (paginated list, max 500)
    const all = await svc.entities.PendingInvitation.list('-created_date', 500);

    // Filter: external party, not accepted, no reminder sent yet, older than 3 days
    const due = all.filter((inv) => {
      if (inv.invitation_type !== 'external_party') return false;
      if (inv.accepted) return false;
      if (inv.reminder_sent) return false;
      if (!inv.created_date) return false;
      return new Date(inv.created_date) < cutoff;
    });

    if (due.length === 0) {
      return Response.json({ success: true, message: 'No pending invitations due for reminders.', reminders_sent: 0 });
    }

    // Collect unique internal user IDs (created_by_id) to look up their emails
    const userIds = [...new Set(due.map((inv) => inv.created_by_id).filter(Boolean))];
    const users = userIds.length > 0 ? await svc.entities.User.list('-created_date', 500) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Get Outlook connector token for sending emails
    let outlookToken = null;
    try {
      const { accessToken } = await svc.connectors.getConnection('outlook');
      outlookToken = accessToken;
    } catch (e) {
      return Response.json({ error: 'Outlook connector not available: ' + e.message }, { status: 500 });
    }

    const today = new Date().toISOString().slice(0, 10);
    let sent = 0;
    let failed = 0;

    for (const inv of due) {
      const inviter = userMap.get(inv.created_by_id);
      if (!inviter || !inviter.email) {
        failed++;
        continue;
      }

      const inviteeName = inv.contact_name || [inv.first_name, inv.last_name].filter(Boolean).join(' ') || inv.email;
      const subject = `Reminder: ${inviteeName} hasn't registered yet`;
      const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Follow-up Reminder</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px;">Pending external party invitation</p>
          </div>
          <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 14px;">Hi ${inviter.full_name || inviter.email},</p>
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              It's been over 3 days since you invited <strong>${inviteeName}</strong> (${inv.email})
              ${inv.firm_name ? ` from <strong>${inv.firm_name}</strong>` : ''} to join the MyKumpare portal,
              and they haven't registered yet.
            </p>
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              Consider reaching out to them directly to encourage registration so they can complete their assigned tasks.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 11px;">
              This is an automated reminder from the MyKumpare platform.
            </p>
          </div>
        </div>
      `;

      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${outlookToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              subject,
              body: { contentType: 'HTML', content: htmlBody },
              toRecipients: [{ emailAddress: { address: inviter.email } }],
            },
            saveToSentItems: true,
          }),
        });

        if (response.ok) {
          await svc.entities.PendingInvitation.update(inv.id, {
            reminder_sent: true,
            reminder_sent_date: today,
          });
          sent++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    return Response.json({
      success: true,
      reminders_sent: sent,
      failed,
      checked: due.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}