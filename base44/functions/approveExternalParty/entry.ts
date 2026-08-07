import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Admin-only endpoint: approves or rejects an ExternalPartyRequest.
// On approval:
//   1. Creates a Firm (if no exact match) or links to existing
//   2. Creates a Contact record
//   3. Invites the user via base44.users.inviteUser
//   4. Creates a PendingInvitation with invitation_type='external_party'
//   5. Updates the request status
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { request_id, action, rejection_reason, use_existing_firm_id } = body;

    if (!request_id || !action || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'request_id and action (approve/reject) are required' }, { status: 400 });
    }

    const request = await svc.entities.ExternalPartyRequest.get(request_id);
    if (!request) return Response.json({ error: 'Request not found' }, { status: 404 });
    if (request.status !== 'pending') return Response.json({ error: `Request already ${request.status}` }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];

    if (action === 'reject') {
      await svc.entities.ExternalPartyRequest.update(request_id, {
        status: 'rejected',
        approved_by_id: user.id,
        approved_by_name: user.full_name || user.email,
        approved_date: today,
        rejection_reason: rejection_reason || undefined,
      });
      return Response.json({ success: true, status: 'rejected' });
    }

    // --- APPROVAL ---
    // 1. Find or create the Firm
    let firmId = null;
    let firmName = request.firm_name;
    let createdNewFirm = false;

    if (use_existing_firm_id) {
      firmId = use_existing_firm_id;
    } else {
      const allFirms = await svc.entities.Firm.list('-created_date', 5000);
      const normalizeName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedNew = normalizeName(request.firm_name);
      const existing = allFirms.find(f => !f.deleted_at && normalizeName(f.name) === normalizedNew);

      if (existing) {
        firmId = existing.id;
      } else {
        const newFirm = await svc.entities.Firm.create({
          name: request.firm_name,
          firm_types: request.firm_types || [],
          tenant_id: user.linked_firm_id,
        });
        firmId = newFirm.id;
        // Set tenant_id to the firm's own ID so external party users
        // can read their firm data via RLS (data.tenant_id === linked_firm_id)
        await svc.entities.Firm.update(firmId, { tenant_id: firmId });
        createdNewFirm = true;
      }
    }

    // 2. Create a Contact record
    const contact = await svc.entities.Contact.create({
      tenant_id: user.linked_firm_id,
      salutation: request.salutation || undefined,
      first_name: request.first_name,
      middle_name: request.middle_name || undefined,
      last_name: request.last_name,
      suffix: request.suffix || undefined,
      email: request.email,
      phones: request.phone ? [request.phone] : undefined,
      firm_ids: [firmId],
      contact_status: 'Active',
      employee_status: 'Non-Employee',
    });

    // 3. Invite the user
    try {
      await base44.users.inviteUser(request.email, 'user');
    } catch (e) {
      // User might already be invited — that's OK, we still create the pending invitation
    }

    // 4. Create PendingInvitation
    await svc.entities.PendingInvitation.create({
      email: request.email,
      firm_id: firmId,
      firm_name: firmName,
      firm_role: request.is_first_user ? 'admin' : 'user',
      can_edit: !request.is_first_user,
      can_delete: false,
      first_name: request.first_name,
      last_name: request.last_name,
      contact_id: contact.id,
      contact_name: [request.salutation, request.first_name, request.last_name].filter(Boolean).join(' '),
      invited_by_name: user.full_name || user.email,
      accepted: false,
      invitation_type: 'external_party',
    });

    // 5. Update the request
    await svc.entities.ExternalPartyRequest.update(request_id, {
      status: 'approved',
      approved_by_id: user.id,
      approved_by_name: user.full_name || user.email,
      approved_date: today,
      created_firm_id: firmId,
      created_contact_id: contact.id,
    });

    return Response.json({
      success: true,
      status: 'approved',
      firm_id: firmId,
      firm_name: firmName,
      created_new_firm: createdNewFirm,
      contact_id: contact.id,
      is_firm_admin: request.is_first_user,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});