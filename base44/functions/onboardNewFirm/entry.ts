import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Creates a brand-new tenant (firm) for a signing-up user, plus their
// self-linked contact, running as the service role so RLS (which keys on
// linked_firm_id the user doesn't have yet) doesn't block the first record.
// The firm's own tenant_id is set to its own id (it is the tenant root).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // A user who already belongs to a tenant can't onboard a new one here.
    if (user.linked_firm_id) {
      return Response.json({ error: 'You already belong to a firm.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const name = (body?.name || "").trim();
    const firmType = body?.firm_type || "Investment Manager";
    const website = (body?.website || "").trim();
    if (!name) return Response.json({ error: 'Firm name is required' }, { status: 400 });

    // Create the firm without tenant_id first (service role bypasses RLS),
    // then stamp tenant_id with the firm's own id so it is its own tenant root.
    const firm = await base44.asServiceRole.entities.Firm.create({
      name,
      firm_type: firmType,
      firm_types: [firmType],
      website: website || undefined,
    });
    await base44.asServiceRole.entities.Firm.update(firm.id, { tenant_id: firm.id });

    // Derive the signer's contact name from their full_name.
    const parts = (user.full_name || "").trim().split(/\s+/);
    const first_name = parts[0] || name;
    const last_name = parts.slice(1).join(" ") || "";

    const contact = await base44.asServiceRole.entities.Contact.create({
      tenant_id: firm.id,
      first_name,
      last_name,
      email: user.email || "",
      firm_ids: [firm.id],
      contact_status: "Active",
    });

    return Response.json({
      firm_id: firm.id,
      contact_id: contact.id,
      firm: { ...firm, tenant_id: firm.id },
      contact,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}