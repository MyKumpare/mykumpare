import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { email, inviteeName, firmName, invitedByName, registrationUrl } = body;

    if (!email) return Response.json({ error: 'email is required' }, { status: 400 });

    // Get the Outlook shared connector token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    const subject = `You're invited to join ${firmName || 'MyKumpare'}`;
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">You're Invited!</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">${firmName || 'MyKumpare'} Portal Access</p>
        </div>
        <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
          <p style="color: #374151; font-size: 14px;">Hi ${inviteeName || 'there'},</p>
          <p style="color: #374151; font-size: 14px; line-height: 1.6;">
            <strong>${invitedByName || 'A team member'}</strong> from <strong>${firmName || 'our firm'}</strong> has invited you to join the MyKumpare portal.
            You'll be able to complete assigned questionnaires, submit product information, and collaborate with our team.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${registrationUrl || '#'}"
               style="background: #4f46e5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
              Access Your Portal
            </a>
          </div>
          <p style="color: #6b7280; font-size: 12px; line-height: 1.5;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <span style="color: #4f46e5; word-break: break-all;">${registrationUrl || ''}</span>
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 11px;">
            This invitation was sent by ${invitedByName || 'a team member'} via the MyKumpare platform.
            If you weren't expecting this invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients: [{ emailAddress: { address: email } }],
        },
        saveToSentItems: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return Response.json({ error: `Graph API error: ${response.status} ${errText}` }, { status: 500 });
    }

    return Response.json({ success: true, message: `Invitation email sent to ${email}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}