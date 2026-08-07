import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Deletes a user-approved list of orphan records. Each item in the payload
// is { entity_type, record_id, action } where action is one of:
//   - 'delete'  : hard-delete the record (or soft-delete for Contact/Product/Firm)
//   - 'clean'   : remove the stale reference from the record without deleting it
//                 (applies to DueDiligence, Product investment_team, Contact firm_ids,
//                 OrgChart nodes, Questionnaire assignee/requester)
//   - 'skip'    : take no action (user rejected)
//
// Uses the service role so records owned by other users can be cleaned up.
// Authorization: platform admins or firm admins/co-admins only.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'admin';
    const userFirmId = user.linked_firm_id ?? user.data?.linked_firm_id;
    const firmRole = user.firm_role ?? user.data?.firm_role;
    const isFirmAdmin = firmRole === 'admin' || firmRole === 'co-admin';
    if (!isPlatformAdmin && !isFirmAdmin) {
      return Response.json({ error: 'Forbidden — admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const items: Array<{ entity_type: string; record_id: string; action: string; reference_field?: string }> = body?.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'items array is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();
    const results: Array<{ entity_type: string; record_id: string; action: string; status: string; error?: string }> = [];

    for (const item of items) {
      const { entity_type, record_id, action, reference_field } = item;
      if (action === 'skip') {
        results.push({ entity_type, record_id, action, status: 'skipped' });
        continue;
      }
      try {
        switch (entity_type) {
          case 'PendingInvitation':
          case 'ExternalChat':
          case 'DdNotification':
          case 'ContactActivity':
          case 'FollowUpTask':
          case 'InvitationHistory':
            if (action === 'delete') {
              await svc.entities[entity_type].delete(record_id);
            }
            break;

          case 'Contact':
            if (action === 'clean') {
              // Remove deleted firm ids from firm_ids
              const c = await svc.entities.Contact.get(record_id);
              if (c && Array.isArray(c.firm_ids)) {
                const allFirms = await svc.entities.Firm.list('-deleted_at', 5000);
                const deletedFirmIds = new Set(allFirms.filter((f) => f.deleted_at).map((f) => f.id));
                const cleaned = c.firm_ids.filter((id) => !deletedFirmIds.has(id));
                if (cleaned.length !== c.firm_ids.length) {
                  await svc.entities.Contact.update(record_id, { firm_ids: cleaned });
                }
              }
            } else if (action === 'delete') {
              await svc.entities.Contact.update(record_id, { deleted_at: now });
            }
            break;

          case 'Product':
            if (action === 'clean') {
              const p = await svc.entities.Product.get(record_id);
              if (p && Array.isArray(p.investment_team)) {
                const allContacts = await svc.entities.Contact.list('-deleted_at', 5000);
                const deletedIds = new Set(allContacts.filter((c) => c.deleted_at).map((c) => c.id));
                const cleaned = p.investment_team.filter((m) => !m.contact_id || !deletedIds.has(m.contact_id));
                if (cleaned.length !== p.investment_team.length) {
                  await svc.entities.Product.update(record_id, { investment_team: cleaned });
                }
              }
            } else if (action === 'delete') {
              await svc.entities.Product.update(record_id, { deleted_at: now });
            }
            break;

          case 'DueDiligence':
            if (action === 'clean') {
              const dd = await svc.entities.DueDiligence.get(record_id);
              if (!dd) break;
              const allContacts = await svc.entities.Contact.list('-deleted_at', 5000);
              const deletedIds = new Set(allContacts.filter((c) => c.deleted_at).map((c) => c.id));
              const update: any = {};
              if (dd.primary_analyst_contact_id && deletedIds.has(dd.primary_analyst_contact_id)) {
                update.primary_analyst_contact_id = '';
                update.primary_analyst_name = '';
              }
              if (dd.secondary_analyst_contact_id && deletedIds.has(dd.secondary_analyst_contact_id)) {
                update.secondary_analyst_contact_id = '';
                update.secondary_analyst_name = '';
              }
              if (Array.isArray(dd.assigned_contact_ids)) {
                const filtered = dd.assigned_contact_ids.filter((id) => !deletedIds.has(id));
                if (filtered.length !== dd.assigned_contact_ids.length) update.assigned_contact_ids = filtered;
              }
              if (Array.isArray(dd.stages)) {
                const stages = dd.stages.map((stage) => {
                  let stageChanged = false;
                  const su: any = {};
                  if (stage.supervisor_contact_id && deletedIds.has(stage.supervisor_contact_id)) {
                    su.supervisor_contact_id = '';
                    su.supervisor_name = '';
                    stageChanged = true;
                  }
                  let subStages = stage.sub_stages;
                  if (Array.isArray(subStages)) {
                    subStages = subStages.map((ss) => {
                      let ssChanged = false;
                      const ssu: any = {};
                      if (ss.performed_by_contact_id && deletedIds.has(ss.performed_by_contact_id)) {
                        ssu.performed_by_contact_id = '';
                        ssu.performed_by_name = '';
                        ssChanged = true;
                      }
                      let assignments = ss.assignments;
                      if (Array.isArray(assignments)) {
                        const filtered = assignments.filter((a) => !a.contact_id || !deletedIds.has(a.contact_id));
                        if (filtered.length !== assignments.length) { assignments = filtered; ssChanged = true; }
                      }
                      if (!ssChanged) return ss;
                      return { ...ss, ...ssu, assignments };
                    });
                    if (subStages !== stage.sub_stages) { su.sub_stages = subStages; stageChanged = true; }
                  }
                  if (!stageChanged) return stage;
                  return { ...stage, ...su };
                });
                if (stages !== dd.stages) update.stages = stages;
              }
              if (Object.keys(update).length) {
                await svc.entities.DueDiligence.update(record_id, update);
              }
            }
            break;

          case 'Questionnaire':
            if (action === 'clean') {
              const q = await svc.entities.Questionnaire.get(record_id);
              if (!q) break;
              const allContacts = await svc.entities.Contact.list('-deleted_at', 5000);
              const deletedIds = new Set(allContacts.filter((c) => c.deleted_at).map((c) => c.id));
              const update: any = {};
              if (q.assignee_contact_id && deletedIds.has(q.assignee_contact_id)) {
                update.assignee_contact_id = '';
                update.assignee_contact_name = '';
              }
              if (q.requester_contact_id && deletedIds.has(q.requester_contact_id)) {
                update.requester_contact_id = '';
                update.requester_name = '';
              }
              if (Object.keys(update).length) {
                await svc.entities.Questionnaire.update(record_id, update);
              }
            }
            break;

          case 'OrgChart':
            if (action === 'clean') {
              const oc = await svc.entities.OrgChart.get(record_id);
              if (!oc || !Array.isArray(oc.nodes)) break;
              const allContacts = await svc.entities.Contact.list('-deleted_at', 5000);
              const deletedIds = new Set(allContacts.filter((c) => c.deleted_at).map((c) => c.id));
              const removedIds = new Set(oc.nodes.filter((n) => n.contact_id && deletedIds.has(n.contact_id)).map((n) => n.id));
              if (removedIds.size === 0) break;
              const remaining = oc.nodes.filter((n) => !removedIds.has(n.id));
              const cleanedNodes = remaining.map((n) => ({
                ...n,
                children: Array.isArray(n.children) ? n.children.filter((cid) => !removedIds.has(cid)) : n.children,
              }));
              const cleanedRoots = Array.isArray(oc.root_ids) ? oc.root_ids.filter((rid) => !removedIds.has(rid)) : oc.root_ids;
              await svc.entities.OrgChart.update(record_id, { nodes: cleanedNodes, root_ids: cleanedRoots });
            }
            break;

          default:
            results.push({ entity_type, record_id, action, status: 'error', error: 'Unknown entity type' });
            continue;
        }
        results.push({ entity_type, record_id, action, status: 'success' });
      } catch (err) {
        results.push({ entity_type, record_id, action, status: 'error', error: err.message });
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}