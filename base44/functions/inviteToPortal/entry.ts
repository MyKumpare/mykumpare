import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Handles proactive invitations to the External Portal.
//   action: "list"    → returns all external_party PendingInvitation records (status display)
//   action: "invite"  → creates a Contact (if new) + platform user invite + PendingInvitation + history log
//   action: "rescind" → deletes a pending external-party invitation + history log
//   action: "remind"  → records a reminder-sent history event
// Runs service-role for entity writes so internal (non-admin) users can invite
// external firms whose tenant_id differs from the inviter's own firm.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const svc = base44.asServiceRole;

    // ── LIST: external party invitations for status display ──
    if (action === 'list') {
      const all = await svc.entities.PendingInvitation.list('-created_date', 500);
      const external = all.filter((i) => i.invitation_type === 'external_party');
      return Response.json({ invitations: external });
    }

    // ── INVITE: create contact (if new) + invite platform user + PendingInvitation + history ──
    if (action === 'invite') {
      const {
        firm_id, firm_name, contact_id,
        first_name, last_name, email,
        is_new_contact, salutation, suffix,
        firm_types,
      } = body;

      if (!firm_id) return Response.json({ error: 'firm_id is required' }, { status: 400 });
      if (!email) return Response.json({ error: 'email is required' }, { status: 400 });
      const normEmail = String(email).trim().toLowerCase();

      // Prevent duplicate pending invitations
      const all = await svc.entities.PendingInvitation.list('-created_date', 500);
      const dup = all.find(
        (i) => i.email === normEmail && i.invitation_type === 'external_party' && !i.accepted
      );
      if (dup) {
        return Response.json({ error: 'This contact has already been invited to the portal.' }, { status: 400 });
      }

      let finalContactId = contact_id || null;

      // Create the Contact record when this is a brand-new contact
      if (is_new_contact && !finalContactId) {
        if (!first_name || !last_name) {
          return Response.json({ error: 'first_name and last_name are required for new contacts' }, { status: 400 });
        }
        const contact = await svc.entities.Contact.create({
          tenant_id: user.linked_firm_id,
          salutation: salutation || undefined,
          first_name,
          last_name,
          suffix: suffix || undefined,
          email: normEmail,
          firm_ids: [firm_id],
          contact_status: 'Active',
          employee_status: 'Non-Employee',
        });
        finalContactId = contact.id;
      }

      // Invite the user to the platform (no-op if already invited)
      try {
        await base44.users.inviteUser(normEmail, 'user');
      } catch (e) {
        // User may already be invited — that's fine, we still record the invitation
      }

      const invitation = await svc.entities.PendingInvitation.create({
        email: normEmail,
        firm_id,
        firm_name: firm_name || '',
        firm_types: firm_types || [],
        firm_role: 'user',
        can_edit: true,
        can_delete: false,
        first_name: first_name || '',
        last_name: last_name || '',
        salutation: salutation || undefined,
        suffix: suffix || undefined,
        contact_id: finalContactId || undefined,
        contact_name: [first_name, last_name].filter(Boolean).join(' '),
        invited_by_name: user.full_name || user.email,
        accepted: false,
        invitation_type: 'external_party',
      });

      // Log the "sent" event in the invitation history
      try {
        await svc.entities.InvitationHistory.create({
          invitation_id: invitation.id,
          email: normEmail,
          firm_name: firm_name || '',
          event_type: 'sent',
          actor_name: user.full_name || user.email,
          details: `Invitation sent to ${normEmail} for ${firm_name || 'the portal'}`,
        });
      } catch (e) {
        // History logging is best-effort — don't fail the invite
      }

      return Response.json({ success: true, invitation });
    }

    // ── REMIND: record a reminder-sent history event ──
    if (action === 'remind') {
      const { invitation_id } = body;
      if (!invitation_id) return Response.json({ error: 'invitation_id is required' }, { status: 400 });

      const inv = await svc.entities.PendingInvitation.get(invitation_id);
      if (!inv) return Response.json({ error: 'Invitation not found' }, { status: 404 });

      try {
        await svc.entities.InvitationHistory.create({
          invitation_id,
          email: inv.email || '',
          firm_name: inv.firm_name || '',
          event_type: 'reminder_sent',
          actor_name: user.full_name || user.email,
          details: `Reminder email sent to ${inv.email || 'invitee'}`,
        });
      } catch (e) {
        // best-effort
      }

      return Response.json({ success: true });
    }

    // ── RESCIND: delete a pending external-party invitation + history ──
    if (action === 'rescind') {
      const { invitation_id } = body;
      if (!invitation_id) return Response.json({ error: 'invitation_id is required' }, { status: 400 });

      const inv = await svc.entities.PendingInvitation.get(invitation_id);
      if (!inv) return Response.json({ error: 'Invitation not found' }, { status: 404 });
      if (inv.invitation_type !== 'external_party') {
        return Response.json({ error: 'Only external party invitations can be rescinded' }, { status: 400 });
      }
      if (inv.accepted) {
        return Response.json({ error: 'This invitation has already been accepted and cannot be rescinded' }, { status: 400 });
      }

      // Log the "rescinded" event before deleting the invitation
      try {
        await svc.entities.InvitationHistory.create({
          invitation_id,
          email: inv.email || '',
          firm_name: inv.firm_name || '',
          event_type: 'rescinded',
          actor_name: user.full_name || user.email,
          details: `Invitation to ${inv.email || 'invitee'} rescinded by ${user.full_name || user.email}`,
        });
      } catch (e) {
        // best-effort
      }

      await svc.entities.PendingInvitation.delete(invitation_id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action. Use "list", "invite", "remind", or "rescind".' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}