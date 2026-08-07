import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Scans the database for orphan records — records that still reference
// soft-deleted contacts or soft-deleted firms. Returns a structured list
// grouped by entity type so the UI can present each orphan for user
// approval before deletion.
//
// Orphan categories:
//  1. PendingInvitation referencing a deleted contact (by contact_id or email)
//  2. ExternalChat referencing a deleted contact (sender / external / analyst)
//  3. DdNotification addressed to a deleted contact
//  4. ContactActivity referencing a deleted contact
//  5. FollowUpTask referencing a deleted contact
//  6. DueDiligence with stale contact references (analyst / supervisor / assignments)
//  7. Product with a deleted contact still in investment_team
//  8. Questionnaire with a deleted contact as assignee / requester
//  9. OrgChart with nodes pointing to a deleted contact
// 10. Contact whose firm_ids include a deleted firm
// 11. Product whose firm_id is a deleted firm
// 12. DueDiligence whose firm_id is a deleted firm
// 13. PendingInvitation whose firm_id is a deleted firm
// 14. ExternalChat whose external_firm_id is a deleted firm
//
// Authorization: platform admins see all orphans. Firm admins/co-admins only
// see orphans tied to their tenant.
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

    const svc = base44.asServiceRole;
    const orphans: any[] = [];

    // --- Load soft-deleted contacts and firms ---
    const allContacts = await svc.entities.Contact.list('-deleted_at', 5000);
    const deletedContacts = allContacts.filter((c) => c.deleted_at);
    const deletedContactIds = new Set(deletedContacts.map((c) => c.id));
    const deletedContactEmails = new Map();
    for (const c of deletedContacts) {
      if (c.email) deletedContactEmails.set(c.email.toLowerCase(), c);
    }
    const contactNameById = new Map(deletedContacts.map((c) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id]));

    const allFirms = await svc.entities.Firm.list('-deleted_at', 5000);
    const deletedFirms = allFirms.filter((f) => f.deleted_at);
    const deletedFirmIds = new Set(deletedFirms.map((f) => f.id));
    const firmNameById = new Map(deletedFirms.map((f) => [f.id, f.name || f.id]));

    // Tenant filter helper: skip records outside the user's tenant unless platform admin.
    const inTenant = (rec: any) => {
      if (isPlatformAdmin) return true;
      if (!userFirmId) return false;
      return rec.tenant_id === userFirmId || rec.firm_id === userFirmId;
    };

    const add = (entityType, record, referenceField, referencedName, description) => {
      if (!inTenant(record)) return;
      orphans.push({
        entity_type: entityType,
        record_id: record.id,
        reference_field: referenceField,
        referenced_name: referencedName,
        description,
        record,
      });
    };

    // --- 1. PendingInvitation referencing deleted contacts ---
    const allPending = await svc.entities.PendingInvitation.list('-created_date', 5000);
    for (const p of allPending) {
      if (p.contact_id && deletedContactIds.has(p.contact_id)) {
        add('PendingInvitation', p, 'contact_id', contactNameById.get(p.contact_id) || p.contact_name || p.email,
          `Invitation "${p.contact_name || p.email}" still references deleted contact.`);
      } else if (p.email && deletedContactEmails.has(p.email.toLowerCase())) {
        const c = deletedContactEmails.get(p.email.toLowerCase());
        add('PendingInvitation', p, 'email', contactNameById.get(c.id) || p.email,
          `Invitation "${p.contact_name || p.email}" matches deleted contact by email.`);
      }
    }

    // --- 2. ExternalChat referencing deleted contacts ---
    const allChats = await svc.entities.ExternalChat.list('-created_date', 5000);
    for (const c of allChats) {
      if (c.sender_contact_id && deletedContactIds.has(c.sender_contact_id)) {
        add('ExternalChat', c, 'sender_contact_id', contactNameById.get(c.sender_contact_id) || c.sender_name,
          `Chat from "${c.sender_name}" references a deleted contact as sender.`);
      }
      if (c.external_contact_id && deletedContactIds.has(c.external_contact_id)) {
        add('ExternalChat', c, 'external_contact_id', contactNameById.get(c.external_contact_id) || c.external_contact_name,
          `Chat with "${c.external_contact_name}" references a deleted external contact.`);
      }
      if (c.analyst_contact_id && deletedContactIds.has(c.analyst_contact_id)) {
        add('ExternalChat', c, 'analyst_contact_id', contactNameById.get(c.analyst_contact_id) || c.analyst_name,
          `Chat with analyst "${c.analyst_name}" references a deleted contact.`);
      }
    }

    // --- 3. DdNotification addressed to deleted contacts ---
    const allNotifs = await svc.entities.DdNotification.list('-created_date', 5000);
    for (const n of allNotifs) {
      if (n.contact_id && deletedContactIds.has(n.contact_id)) {
        add('DdNotification', n, 'contact_id', contactNameById.get(n.contact_id) || n.contact_name,
          `Notification "${n.title}" is addressed to a deleted contact.`);
      }
    }

    // --- 4. ContactActivity referencing deleted contacts ---
    const allActivities = await svc.entities.ContactActivity.list('-created_date', 5000);
    for (const a of allActivities) {
      if (a.contact_id && deletedContactIds.has(a.contact_id)) {
        add('ContactActivity', a, 'contact_id', contactNameById.get(a.contact_id) || 'Unknown',
          `Activity references a deleted contact as the primary contact.`);
        continue;
      }
      if (Array.isArray(a.associated_firms_contacts)) {
        for (const af of a.associated_firms_contacts) {
          if (Array.isArray(af.contacts) && af.contacts.some((c) => c.contact_id && deletedContactIds.has(c.contact_id))) {
            add('ContactActivity', a, 'associated_firms_contacts', 'Multiple', `Activity "${a.subject || a.id}" references a deleted contact in its associations.`);
            break;
          }
        }
      }
    }

    // --- 5. FollowUpTask referencing deleted contacts ---
    const allTasks = await svc.entities.FollowUpTask.list('-created_date', 5000);
    for (const t of allTasks) {
      if (t.originator_contact_id && deletedContactIds.has(t.originator_contact_id)) {
        add('FollowUpTask', t, 'originator_contact_id', contactNameById.get(t.originator_contact_id) || 'Unknown',
          `Task "${t.subject || t.id}" was originated by a deleted contact.`);
        continue;
      }
      if (t.assigned_to_contact_id && deletedContactIds.has(t.assigned_to_contact_id)) {
        add('FollowUpTask', t, 'assigned_to_contact_id', contactNameById.get(t.assigned_to_contact_id) || 'Unknown',
          `Task "${t.subject || t.id}" is assigned to a deleted contact.`);
        continue;
      }
      if (Array.isArray(t.assignments) && t.assignments.some((asg) => asg.contact_id && deletedContactIds.has(asg.contact_id))) {
        add('FollowUpTask', t, 'assignments', 'Multiple', `Task "${t.subject || t.id}" has an assignment for a deleted contact.`);
        continue;
      }
      if (Array.isArray(t.assigned_firms_contacts)) {
        for (const af of t.assigned_firms_contacts) {
          if (Array.isArray(af.contacts) && af.contacts.some((c) => c.contact_id && deletedContactIds.has(c.contact_id))) {
            add('FollowUpTask', t, 'assigned_firms_contacts', 'Multiple', `Task "${t.subject || t.id}" references a deleted contact in its associations.`);
            break;
          }
        }
      }
    }

    // --- 6. DueDiligence with stale contact references ---
    const allDd = await svc.entities.DueDiligence.list('-created_date', 5000);
    for (const dd of allDd) {
      const refs: string[] = [];
      if (dd.primary_analyst_contact_id && deletedContactIds.has(dd.primary_analyst_contact_id)) refs.push('primary analyst');
      if (dd.secondary_analyst_contact_id && deletedContactIds.has(dd.secondary_analyst_contact_id)) refs.push('secondary analyst');
      if (Array.isArray(dd.assigned_contact_ids) && dd.assigned_contact_ids.some((id) => deletedContactIds.has(id))) refs.push('assigned contacts');
      if (Array.isArray(dd.stages)) {
        for (const stage of dd.stages) {
          if (stage.supervisor_contact_id && deletedContactIds.has(stage.supervisor_contact_id)) refs.push('supervisor');
          if (Array.isArray(stage.sub_stages)) {
            for (const ss of stage.sub_stages) {
              if (ss.performed_by_contact_id && deletedContactIds.has(ss.performed_by_contact_id)) refs.push('performer');
              if (Array.isArray(ss.assignments) && ss.assignments.some((asg) => asg.contact_id && deletedContactIds.has(asg.contact_id))) refs.push('sub-stage assignments');
            }
          }
        }
      }
      if (refs.length) {
        add('DueDiligence', dd, 'stages/analyst', 'Multiple',
          `Due diligence "${dd.product_name || dd.firm_name || dd.id}" references deleted contacts: ${refs.join(', ')}.`);
      }
    }

    // --- 7. Product with deleted contact in investment_team ---
    const allProducts = await svc.entities.Product.list('-created_date', 5000);
    for (const p of allProducts) {
      if (p.deleted_at) continue;
      if (Array.isArray(p.investment_team) && p.investment_team.some((m) => m.contact_id && deletedContactIds.has(m.contact_id))) {
        add('Product', p, 'investment_team', 'Multiple', `Product "${p.name}" has a deleted contact in its investment team.`);
      }
    }

    // --- 8. Questionnaire with deleted contact as assignee/requester ---
    const allQ = await svc.entities.Questionnaire.list('-created_date', 5000);
    for (const q of allQ) {
      if (q.assignee_contact_id && deletedContactIds.has(q.assignee_contact_id)) {
        add('Questionnaire', q, 'assignee_contact_id', contactNameById.get(q.assignee_contact_id) || q.assignee_contact_name,
          `Questionnaire "${q.name}" is assigned to a deleted contact.`);
      }
      if (q.requester_contact_id && deletedContactIds.has(q.requester_contact_id)) {
        add('Questionnaire', q, 'requester_contact_id', contactNameById.get(q.requester_contact_id) || q.requester_name,
          `Questionnaire "${q.name}" was requested by a deleted contact.`);
      }
    }

    // --- 9. OrgChart with nodes pointing to deleted contacts ---
    const allOrgCharts = await svc.entities.OrgChart.list('-created_date', 5000);
    for (const oc of allOrgCharts) {
      if (!Array.isArray(oc.nodes)) continue;
      const stale = oc.nodes.filter((n) => n.contact_id && deletedContactIds.has(n.contact_id));
      if (stale.length) {
        add('OrgChart', oc, 'nodes', 'Multiple', `Org chart has ${stale.length} node(s) pointing to a deleted contact.`);
      }
    }

    // --- Firm-based orphans (references to deleted firms) ---
    // 10. Contacts whose firm_ids include a deleted firm
    for (const c of allContacts) {
      if (c.deleted_at) continue;
      if (Array.isArray(c.firm_ids) && c.firm_ids.some((id) => deletedFirmIds.has(id))) {
        const staleFirms = c.firm_ids.filter((id) => deletedFirmIds.has(id)).map((id) => firmNameById.get(id) || id);
        add('Contact', c, 'firm_ids', staleFirms.join(', '), `Contact "${[c.first_name, c.last_name].filter(Boolean).join(' ')}" is linked to deleted firm(s).`);
      }
    }

    // 11. Products whose firm_id is a deleted firm
    for (const p of allProducts) {
      if (p.deleted_at) continue;
      if (p.firm_id && deletedFirmIds.has(p.firm_id)) {
        add('Product', p, 'firm_id', firmNameById.get(p.firm_id) || p.firm_id, `Product "${p.name}" belongs to a deleted firm.`);
      }
    }

    // 12. DueDiligence whose firm_id is a deleted firm
    for (const dd of allDd) {
      if (dd.firm_id && deletedFirmIds.has(dd.firm_id)) {
        add('DueDiligence', dd, 'firm_id', firmNameById.get(dd.firm_id) || dd.firm_id, `Due diligence "${dd.product_name || dd.firm_name || dd.id}" belongs to a deleted firm.`);
      }
    }

    // 13. PendingInvitation whose firm_id is a deleted firm
    for (const p of allPending) {
      if (p.firm_id && deletedFirmIds.has(p.firm_id)) {
        add('PendingInvitation', p, 'firm_id', firmNameById.get(p.firm_id) || p.firm_id, `Invitation "${p.contact_name || p.email}" belongs to a deleted firm.`);
      }
    }

    // 14. ExternalChat whose external_firm_id is a deleted firm
    for (const c of allChats) {
      if (c.external_firm_id && deletedFirmIds.has(c.external_firm_id)) {
        add('ExternalChat', c, 'external_firm_id', firmNameById.get(c.external_firm_id) || c.external_firm_name,
          `Chat with "${c.external_firm_name}" references a deleted firm.`);
      }
    }

    // Group by entity type for the UI.
    const grouped: Record<string, any[]> = {};
    for (const o of orphans) {
      if (!grouped[o.entity_type]) grouped[o.entity_type] = [];
      grouped[o.entity_type].push(o);
    }

    return Response.json({
      success: true,
      total: orphans.length,
      grouped,
      deleted_contacts_count: deletedContacts.length,
      deleted_firms_count: deletedFirms.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}