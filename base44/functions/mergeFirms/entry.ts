import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { pickScalar, toArray, union, dedupeByKey, phoneKey, addrKey, mergeAumHistory } from '../../shared/mergeUtils.ts';

// Merges two Firm entities into one, consolidating their data and reassigning
// all references from the secondary firm to the primary firm, then deletes the
// secondary firm. Administrative operation (admin role required).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const primaryId = body?.primary_id;
    const secondaryId = body?.secondary_id;
    if (!primaryId || !secondaryId || primaryId === secondaryId) {
      return Response.json({ error: 'Invalid firm ids' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const primary = await svc.entities.Firm.get(primaryId);
    const secondary = await svc.entities.Firm.get(secondaryId);
    if (!primary || !secondary) {
      return Response.json({ error: 'Firm not found' }, { status: 404 });
    }

    const merged = { ...primary };
    const pick = pickScalar(primary, secondary);
    [
      'name', 'logo_url', 'website', 'linkedin_url', 'email', 'year_founded',
      'description', 'firm_type', 'tenant_id',
    ].forEach((k) => { merged[k] = pick(k); });

    merged.firm_types = union(primary.firm_types, secondary.firm_types);

    // Addresses — dedupe by address_line1 + city
    merged.addresses = dedupeByKey(
      [...(primary.addresses || []), ...(secondary.addresses || [])].filter((a) => a && a.id),
      addrKey
    );

    // Phones — dedupe by number parts
    merged.phones = dedupeByKey(
      [...(primary.phones || []), ...(secondary.phones || [])].filter((p) => p && p.id),
      phoneKey
    );

    // AUM history — union by month_end_date (primary wins on conflict)
    merged.aum_history = mergeAumHistory(primary.aum_history, secondary.aum_history);

    await svc.entities.Firm.update(primaryId, merged);

    const primaryName = primary.name;

    // --- Contacts: replace secondaryId with primaryId in firm_ids arrays ---
    const allContacts = await svc.entities.Contact.list('-created_date', 5000);
    for (const c of allContacts) {
      if (Array.isArray(c.firm_ids) && c.firm_ids.includes(secondaryId)) {
        const newFirmIds = c.firm_ids.map((fid) => (fid === secondaryId ? primaryId : fid));
        // Deduplicate (avoid double primaryId)
        const deduped = Array.from(new Set(newFirmIds));
        try { await svc.entities.Contact.update(c.id, { firm_ids: deduped }); } catch {}
      }
    }

    // --- Products: reassign firm_id and firm_name ---
    const secProducts = await svc.entities.Product.filter({ firm_id: secondaryId });
    for (const p of secProducts) {
      try { await svc.entities.Product.update(p.id, { firm_id: primaryId, firm_name: primaryName }); } catch {}
    }

    // --- Portfolios: reassign firm_id (allocator) and advisor_firm_id ---
    const portAllocator = await svc.entities.Portfolio.filter({ firm_id: secondaryId });
    for (const p of portAllocator) {
      try { await svc.entities.Portfolio.update(p.id, { firm_id: primaryId, allocator_name: primaryName }); } catch {}
    }
    const portAdvisor = await svc.entities.Portfolio.filter({ advisor_firm_id: secondaryId });
    for (const p of portAdvisor) {
      try { await svc.entities.Portfolio.update(p.id, { advisor_firm_id: primaryId, advisor_firm_name: primaryName }); } catch {}
    }

    // --- FirmDocuments: reassign firm_id ---
    const docs = await svc.entities.FirmDocument.filter({ firm_id: secondaryId });
    for (const d of docs) {
      try { await svc.entities.FirmDocument.update(d.id, { firm_id: primaryId }); } catch {}
    }

    // --- DueDiligence: reassign firm_id and firm_name ---
    const dd = await svc.entities.DueDiligence.filter({ firm_id: secondaryId });
    for (const d of dd) {
      try { await svc.entities.DueDiligence.update(d.id, { firm_id: primaryId, firm_name: primaryName }); } catch {}
    }

    // --- Ownership: reassign firm_id ---
    const own = await svc.entities.Ownership.filter({ firm_id: secondaryId });
    for (const o of own) {
      try { await svc.entities.Ownership.update(o.id, { firm_id: primaryId }); } catch {}
    }

    // --- OrgCharts: reassign firm_id ---
    const org = await svc.entities.OrgChart.filter({ firm_id: secondaryId });
    for (const o of org) {
      try { await svc.entities.OrgChart.update(o.id, { firm_id: primaryId }); } catch {}
    }

    // --- ContactActivity: reassign associated_firms_contacts ---
    const allActivities = await svc.entities.ContactActivity.list('-created_date', 5000);
    for (const a of allActivities) {
      if (Array.isArray(a.associated_firms_contacts)) {
        let changed = false;
        const newAssoc = a.associated_firms_contacts.map((af) => {
          if (af && af.firm_id === secondaryId) {
            changed = true;
            return { ...af, firm_id: primaryId, firm_name: af.firm_name ? primaryName : af.firm_name };
          }
          return af;
        });
        if (changed) {
          try { await svc.entities.ContactActivity.update(a.id, { associated_firms_contacts: newAssoc }); } catch {}
        }
      }
    }

    // --- FollowUpTask: reassign originator_firm_id and assigned_firms_contacts ---
    const allTasks = await svc.entities.FollowUpTask.list('-created_date', 5000);
    for (const t of allTasks) {
      const updates = {};
      let changed = false;
      if (t.originator_firm_id === secondaryId) {
        updates.originator_firm_id = primaryId;
        updates.originator_firm_name = primaryName;
        changed = true;
      }
      if (Array.isArray(t.assigned_firms_contacts)) {
        let assocChanged = false;
        const newAssoc = t.assigned_firms_contacts.map((af) => {
          if (af && af.firm_id === secondaryId) {
            assocChanged = true;
            return { ...af, firm_id: primaryId, firm_name: af.firm_name ? primaryName : af.firm_name };
          }
          return af;
        });
        if (assocChanged) {
          updates.assigned_firms_contacts = newAssoc;
          changed = true;
        }
      }
      if (changed) {
        try { await svc.entities.FollowUpTask.update(t.id, updates); } catch {}
      }
    }

    // --- ExternalProductSubmission: reassign firm_id and firm_name ---
    const eps = await svc.entities.ExternalProductSubmission.filter({ firm_id: secondaryId });
    for (const e of eps) {
      try { await svc.entities.ExternalProductSubmission.update(e.id, { firm_id: primaryId, firm_name: primaryName }); } catch {}
    }

    // --- ExternalChat: reassign external_firm_id and external_firm_name ---
    const chats = await svc.entities.ExternalChat.filter({ external_firm_id: secondaryId });
    for (const c of chats) {
      try { await svc.entities.ExternalChat.update(c.id, { external_firm_id: primaryId, external_firm_name: primaryName }); } catch {}
    }

    // --- Delete the secondary firm ---
    await svc.entities.Firm.delete(secondaryId);

    return Response.json({ success: true, merged_firm_id: primaryId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}