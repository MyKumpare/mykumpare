import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Cascading contact deletion.
// Soft-deletes (trash, recoverable): Contact.
// Hard-deletes (no trash support): ContactActivity, FollowUpTask, ExternalChat,
// DdNotification, PendingInvitation (external party portal access).
// Cleans up references in: DueDiligence (analyst/supervisor/assignment fields),
// Product (investment_team), Questionnaire (assignee/requester), OrgChart (nodes).
// Uses the service role so related records owned by other users are removed too.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const contactId = body?.contact_id;
    if (!contactId) return Response.json({ error: 'contact_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();
    const counts = {};

    // Verify the contact exists and is not already deleted.
    const contact = await svc.entities.Contact.get(contactId);
    if (!contact) return Response.json({ error: 'Contact not found' }, { status: 404 });
    if (contact.deleted_at) {
      return Response.json({
        success: true,
        contact_id: contactId,
        already_deleted: true,
        deleted: {},
      });
    }

    // Authorization: cascading deletion uses the service role (bypasses per-user
    // ownership), so gate it carefully. Platform admins may delete any contact.
    // Otherwise the user must belong to the same tenant as the contact AND hold a
    // firm-level role that permits deletion (firm admin / co-admin, or can_delete).
    const isPlatformAdmin = user.role === 'admin';
    const userFirmId = user.linked_firm_id ?? user.data?.linked_firm_id;
    const sameTenant = !!userFirmId && contact.tenant_id === userFirmId;
    const firmRole = user.firm_role ?? user.data?.firm_role;
    const canDelete = (user.can_delete ?? user.data?.can_delete) === true;
    const allowedByFirm = sameTenant && (firmRole === 'admin' || firmRole === 'co-admin' || canDelete);
    if (!isPlatformAdmin && !allowedByFirm) {
      return Response.json({ error: 'Forbidden — insufficient permissions to delete this contact' }, { status: 403 });
    }

    // --- Pending invitations (external party portal access) ---
    // Match by contact_id OR by email (invitation may predate the contact record).
    let pendingInv = await svc.entities.PendingInvitation.filter({ contact_id: contactId });
    if (contact.email) {
      const byEmail = await svc.entities.PendingInvitation.filter({ email: contact.email });
      const seen = new Set(pendingInv.map((p) => p.id));
      for (const p of byEmail) {
        if (!seen.has(p.id)) {
          pendingInv = [...pendingInv, p];
          seen.add(p.id);
        }
      }
    }
    for (const p of pendingInv) {
      await svc.entities.PendingInvitation.delete(p.id);
    }
    counts.pending_invitations = pendingInv.length;

    // --- Invitation history (lifecycle log for the invitations above) ---
    let invHistoryCount = 0;
    for (const p of pendingInv) {
      const hist = await svc.entities.InvitationHistory.filter({ invitation_id: p.id });
      if (hist.length) {
        await svc.entities.InvitationHistory.deleteMany({ invitation_id: p.id });
        invHistoryCount += hist.length;
      }
    }
    counts.invitation_history = invHistoryCount;

    // --- External chats (bidirectional chat with external firms) ---
    let externalChats = await svc.entities.ExternalChat.filter({ sender_contact_id: contactId });
    const ecByExt = await svc.entities.ExternalChat.filter({ external_contact_id: contactId });
    const ecByAnalyst = await svc.entities.ExternalChat.filter({ analyst_contact_id: contactId });
    {
      const seen = new Set(externalChats.map((c) => c.id));
      for (const c of [...ecByExt, ...ecByAnalyst]) {
        if (!seen.has(c.id)) {
          externalChats = [...externalChats, c];
          seen.add(c.id);
        }
      }
    }
    for (const c of externalChats) {
      await svc.entities.ExternalChat.delete(c.id);
    }
    counts.external_chats = externalChats.length;

    // --- DD notifications addressed to this contact ---
    const ddNotifs = await svc.entities.DdNotification.filter({ contact_id: contactId });
    for (const n of ddNotifs) {
      await svc.entities.DdNotification.delete(n.id);
    }
    counts.dd_notifications = ddNotifs.length;

    // --- Contact activities (owned by this contact or referencing it) ---
    const allActivities = await svc.entities.ContactActivity.list('-created_date', 5000);
    const contactActivities = allActivities.filter((a) => {
      if (a.contact_id === contactId) return true;
      const assoc = Array.isArray(a.associated_firms_contacts) &&
        a.associated_firms_contacts.some((af) =>
          Array.isArray(af.contacts) && af.contacts.some((c) => c.contact_id === contactId));
      return !!assoc;
    });
    for (const a of contactActivities) {
      await svc.entities.ContactActivity.delete(a.id);
    }
    counts.contact_activities = contactActivities.length;

    // --- Follow-up tasks (originated by, assigned to, or referencing this contact) ---
    const allTasks = await svc.entities.FollowUpTask.list('-created_date', 5000);
    const contactTasks = allTasks.filter((t) => {
      if (t.originator_contact_id === contactId) return true;
      if (t.assigned_to_contact_id === contactId) return true;
      const assignments = Array.isArray(t.assignments) &&
        t.assignments.some((asg) => asg.contact_id === contactId);
      const assocContacts = Array.isArray(t.assigned_firms_contacts) &&
        t.assigned_firms_contacts.some((af) =>
          Array.isArray(af.contacts) && af.contacts.some((c) => c.contact_id === contactId));
      return !!(assignments || assocContacts);
    });
    for (const t of contactTasks) {
      await svc.entities.FollowUpTask.delete(t.id);
    }
    counts.follow_up_tasks = contactTasks.length;

    // --- Due diligence records: clean up contact references ---
    // The contact may be a primary/secondary analyst, a supervisor, a sub-stage
    // performer, or a member of assigned_contact_ids / task_assignments.
    const allDd = await svc.entities.DueDiligence.list('-created_date', 5000);
    let ddCleaned = 0;
    for (const dd of allDd) {
      if (dd.tenant_id && userFirmId && dd.tenant_id !== userFirmId && !isPlatformAdmin) continue;
      let changed = false;
      const update: any = {};

      if (dd.primary_analyst_contact_id === contactId) {
        update.primary_analyst_contact_id = '';
        update.primary_analyst_name = '';
        changed = true;
      }
      if (dd.secondary_analyst_contact_id === contactId) {
        update.secondary_analyst_contact_id = '';
        update.secondary_analyst_name = '';
        changed = true;
      }
      if (Array.isArray(dd.assigned_contact_ids) && dd.assigned_contact_ids.includes(contactId)) {
        update.assigned_contact_ids = dd.assigned_contact_ids.filter((id) => id !== contactId);
        changed = true;
      }

      // Walk stages → sub_stages → assignments for performed_by / task assignments
      if (Array.isArray(dd.stages)) {
        const stages = dd.stages.map((stage) => {
          let stageChanged = false;
          const stageUpdate: any = {};
          if (stage.supervisor_contact_id === contactId) {
            stageUpdate.supervisor_contact_id = '';
            stageUpdate.supervisor_name = '';
            stageChanged = true;
          }
          let subStages = stage.sub_stages;
          if (Array.isArray(subStages)) {
            subStages = subStages.map((ss) => {
              let ssChanged = false;
              const ssUpdate: any = {};
              if (ss.performed_by_contact_id === contactId) {
                ssUpdate.performed_by_contact_id = '';
                ssUpdate.performed_by_name = '';
                ssChanged = true;
              }
              let assignments = ss.assignments;
              if (Array.isArray(assignments)) {
                const filtered = assignments.filter((asg) => asg.contact_id !== contactId);
                if (filtered.length !== assignments.length) {
                  assignments = filtered;
                  ssChanged = true;
                }
              }
              if (!ssChanged) return ss;
              return { ...ss, ...ssUpdate, assignments };
            });
            if (subStages !== stage.sub_stages) {
              stageUpdate.sub_stages = subStages;
              stageChanged = true;
            }
          }
          if (!stageChanged) return stage;
          return { ...stage, ...stageUpdate };
        });
        if (stages !== dd.stages) {
          update.stages = stages;
          changed = true;
        }
      }

      // Walk approval_process_logic → task_assignments
      if (Array.isArray(dd.approval_process_logic)) {
        const apl = dd.approval_process_logic.map((step) => {
          let stepChanged = false;
          const stepUpdate: any = {};
          if (step.performed_by_contact_id === contactId) {
            stepUpdate.performed_by_contact_id = '';
            stepUpdate.performed_by_name = '';
            stepChanged = true;
          }
          let taskAssignments = step.task_assignments;
          if (Array.isArray(taskAssignments)) {
            const filtered = taskAssignments.filter((asg) => asg.contact_id !== contactId);
            if (filtered.length !== taskAssignments.length) {
              taskAssignments = filtered;
              stepChanged = true;
            }
          }
          if (!stepChanged) return step;
          return { ...step, ...stepUpdate, task_assignments: taskAssignments };
        });
        if (apl !== dd.approval_process_logic) {
          update.approval_process_logic = apl;
          changed = true;
        }
      }

      if (changed) {
        await svc.entities.DueDiligence.update(dd.id, update);
        ddCleaned++;
      }
    }
    counts.due_diligence_cleaned = ddCleaned;

    // --- Products: remove contact from investment_team arrays ---
    const allProducts = await svc.entities.Product.list('-created_date', 5000);
    let productsCleaned = 0;
    for (const p of allProducts) {
      if (p.deleted_at) continue;
      if (!Array.isArray(p.investment_team)) continue;
      const filtered = p.investment_team.filter((m) => m.contact_id !== contactId);
      if (filtered.length !== p.investment_team.length) {
        await svc.entities.Product.update(p.id, { investment_team: filtered });
        productsCleaned++;
      }
    }
    counts.products_cleaned = productsCleaned;

    // --- Questionnaires: clear assignee / requester references ---
    const allQ = await svc.entities.Questionnaire.list('-created_date', 5000);
    let qCleaned = 0;
    for (const q of allQ) {
      let changed = false;
      const update: any = {};
      if (q.assignee_contact_id === contactId) {
        update.assignee_contact_id = '';
        update.assignee_contact_name = '';
        changed = true;
      }
      if (q.requester_contact_id === contactId) {
        update.requester_contact_id = '';
        update.requester_name = '';
        changed = true;
      }
      if (changed) {
        await svc.entities.Questionnaire.update(q.id, update);
        qCleaned++;
      }
    }
    counts.questionnaires_cleaned = qCleaned;

    // --- Org charts: remove nodes referencing this contact ---
    const allOrgCharts = await svc.entities.OrgChart.list('-created_date', 5000);
    let orgChartsCleaned = 0;
    for (const oc of allOrgCharts) {
      if (!Array.isArray(oc.nodes)) continue;
      const removedIds = new Set(
        oc.nodes.filter((n) => n.contact_id === contactId).map((n) => n.id),
      );
      if (removedIds.size === 0) continue;
      const remainingNodes = oc.nodes.filter((n) => n.contact_id !== contactId);
      // Remove deleted node ids from other nodes' children arrays and root_ids
      const cleanedNodes = remainingNodes.map((n) => ({
        ...n,
        children: Array.isArray(n.children)
          ? n.children.filter((cid) => !removedIds.has(cid))
          : n.children,
      }));
      const cleanedRoots = Array.isArray(oc.root_ids)
        ? oc.root_ids.filter((rid) => !removedIds.has(rid))
        : oc.root_ids;
      await svc.entities.OrgChart.update(oc.id, { nodes: cleanedNodes, root_ids: cleanedRoots });
      orgChartsCleaned++;
    }
    counts.org_charts_cleaned = orgChartsCleaned;

    // --- Finally, soft-delete the contact itself ---
    await svc.entities.Contact.update(contactId, { deleted_at: now });

    return Response.json({
      success: true,
      contact_id: contactId,
      contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(' '),
      deleted: counts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}