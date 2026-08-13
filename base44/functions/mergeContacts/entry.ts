import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Authorization: merging/deleting contacts is an administrative operation.
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const primaryId = body?.primary_id;
    const secondaryId = body?.secondary_id;
    if (!primaryId || !secondaryId || primaryId === secondaryId) {
      return Response.json({ error: 'Invalid contact ids' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const primary = await svc.entities.Contact.get(primaryId);
    const secondary = await svc.entities.Contact.get(secondaryId);
    if (!primary || !secondary) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    const merged = { ...primary };
    const pickScalar = (key) => {
      const pv = primary[key];
      const sv = secondary[key];
      if (sv === undefined || sv === null || sv === '') return pv;
      if (pv === undefined || pv === null || pv === '') return sv;
      return pv;
    };
    [
      'salutation', 'first_name', 'middle_name', 'last_name', 'suffix', 'title',
      'email', 'linkedin_url', 'employee_status', 'contact_status', 'contact_role',
      'contact_type', 'gender', 'veteran_status', 'disability_status', 'biography',
      'notes', 'photo_url',
    ].forEach((k) => { merged[k] = pickScalar(k); });

    const union = (a, b) => Array.from(new Set([...(a || []), ...(b || [])]));
    merged.firm_ids = union(primary.firm_ids, secondary.firm_ids);
    merged.designations = union(primary.designations, secondary.designations);
    merged.contact_roles = union(primary.contact_roles, secondary.contact_roles);
    merged.contact_firm_roles = union(primary.contact_firm_roles, secondary.contact_firm_roles);
    merged.ethnicity = union(primary.ethnicity, secondary.ethnicity);

    const phoneKey = (p) => `${p?.country_code || ''}|${p?.area_code || ''}|${p?.number_mid || ''}|${p?.number_last || ''}`;
    const phonesMap = new Map();
    [...(primary.phones || []), ...(secondary.phones || [])].forEach((p) => {
      if (p && p.id) phonesMap.set(phoneKey(p), p);
    });
    merged.phones = Array.from(phonesMap.values());

    const addrKey = (a) => `${(a?.address_line1 || '').toLowerCase()}|${(a?.city || '').toLowerCase()}`;
    const addrMap = new Map();
    [...(primary.addresses || []), ...(secondary.addresses || [])].forEach((a) => {
      if (a && a.id) addrMap.set(addrKey(a), a);
    });
    merged.addresses = Array.from(addrMap.values());

    merged.education = [...(primary.education || []), ...(secondary.education || [])];
    merged.professional_experience = [...(primary.professional_experience || []), ...(secondary.professional_experience || [])];

    await svc.entities.Contact.update(primaryId, merged);

    const primaryName = `${primary.first_name || ''} ${primary.last_name || ''}`.trim();

    // OrgChart nodes
    let charts = [];
    try { charts = await svc.entities.OrgChart.list(null, 500); } catch {}
    for (const chart of charts) {
      let changed = false;
      const nodes = (chart.nodes || []).map((n) => {
        if (n.contact_id === secondaryId) { changed = true; return { ...n, contact_id: primaryId }; }
        return n;
      });
      if (changed) {
        await svc.entities.OrgChart.update(chart.id, { nodes, root_ids: chart.root_ids || [] });
      }
    }

    // Ownership owners
    let ownerships = [];
    try { ownerships = await svc.entities.Ownership.list(null, 500); } catch {}
    for (const own of ownerships) {
      let changed = false;
      const owners = (own.owners || []).map((o) => {
        if (o.contact_id === secondaryId) { changed = true; return { ...o, contact_id: primaryId }; }
        return o;
      });
      if (changed) await svc.entities.Ownership.update(own.id, { owners });
    }

    // ContactActivity
    let activities = [];
    try { activities = await svc.entities.ContactActivity.filter({ contact_id: secondaryId }); } catch {}
    for (const act of activities) {
      try { await svc.entities.ContactActivity.update(act.id, { contact_id: primaryId }); } catch {}
    }

    // FollowUpTask references
    let tasks = [];
    try { tasks = await svc.entities.FollowUpTask.list(null, 500); } catch {}
    for (const task of tasks) {
      let changed = false;
      const updates = {};
      if (task.assigned_to_contact_id === secondaryId) {
        updates.assigned_to_contact_id = primaryId;
        updates.assigned_to_contact_name = primaryName;
        changed = true;
      }
      if (task.originator_contact_id === secondaryId) {
        updates.originator_contact_id = primaryId;
        updates.originator_contact_name = primaryName;
        changed = true;
      }
      const assignments = (task.assignments || []).map((a) => {
        if (a.contact_id === secondaryId) {
          changed = true;
          return { ...a, contact_id: primaryId, contact_name: primaryName };
        }
        return a;
      });
      if (changed) {
        updates.assignments = assignments;
        try { await svc.entities.FollowUpTask.update(task.id, updates); } catch {}
      }
    }

    // Product investment team
    let products = [];
    try { products = await svc.entities.Product.list(null, 500); } catch {}
    for (const product of products) {
      let changed = false;
      const team = (product.investment_team || []).map((m) => {
        if (m.contact_id === secondaryId) { changed = true; return { ...m, contact_id: primaryId }; }
        return m;
      });
      if (changed) {
        try { await svc.entities.Product.update(product.id, { investment_team: team }); } catch {}
      }
    }

    await svc.entities.Contact.delete(secondaryId);

    return Response.json({ success: true, merged_contact_id: primaryId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});