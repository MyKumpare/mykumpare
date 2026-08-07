import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { firm_id } = body || {};

    if (!firm_id) {
      return Response.json({ error: 'firm_id is required' }, { status: 400 });
    }

    // Use service role to bypass RLS — external firm users cannot read DueDiligence records directly
    const ddRecords = await base44.asServiceRole.entities.DueDiligence.filter(
      { firm_id: firm_id },
      '-created_date',
      50
    );

    // Collect unique analyst contact IDs
    const analystMap = new Map();
    for (const dd of ddRecords) {
      if (dd.primary_analyst_contact_id && !analystMap.has(dd.primary_analyst_contact_id)) {
        analystMap.set(dd.primary_analyst_contact_id, {
          contact_id: dd.primary_analyst_contact_id,
          name: dd.primary_analyst_name || '',
          due_diligence_id: dd.id,
          product_name: dd.product_name || '',
          firm_name: dd.firm_name || ''
        });
      }
    }

    if (analystMap.size === 0) {
      return Response.json({ analysts: [] });
    }

    // Fetch contact details (phone, email) for each analyst
    const contactIds = [...analystMap.keys()];
    const contacts = await base44.asServiceRole.entities.Contact.filter(
      { _id: { $in: contactIds } },
      '-created_date',
      50
    );

    const contactMap = new Map();
    for (const c of contacts) {
      contactMap.set(c.id, c);
    }

    const analysts = [...analystMap.values()].map((a) => {
      const c = contactMap.get(a.contact_id);
      const phone = c?.phones?.find((p) => p.is_default) || c?.phones?.[0];
      return {
        contact_id: a.contact_id,
        name: a.name || (c ? [c.salutation, c.first_name, c.last_name].filter(Boolean).join(' ') : ''),
        email: c?.email || '',
        phone: phone
          ? `+${phone.country_code} (${phone.area_code}) ${phone.number_mid}-${phone.number_last}`
          : '',
        due_diligence_id: a.due_diligence_id,
        product_name: a.product_name,
        firm_name: a.firm_name
      };
    });

    return Response.json({ analysts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}