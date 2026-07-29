import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Cascading firm deletion.
// Soft-deletes (trash, recoverable): Firm, Product, Contact, Portfolio.
// Hard-deletes (no trash support): ReturnSeries, FirmDocument, DueDiligence,
// Ownership, OrgChart, ContactActivity, FollowUpTask.
// Uses the service role so related records owned by other users are removed too.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const firmId = body?.firm_id;
    if (!firmId) return Response.json({ error: 'firm_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();
    const counts = {};

    // Verify the firm exists and is not already deleted.
    const firm = await svc.entities.Firm.get(firmId);
    if (!firm) return Response.json({ error: 'Firm not found' }, { status: 404 });
    // Idempotent: if the firm is already soft-deleted (e.g. a double-click while
    // the list is still refreshing), report success so the client refreshes
    // instead of surfacing a confusing error.
    if (firm.deleted_at) {
      return Response.json({
        success: true,
        firm_id: firmId,
        firm_name: firm.name,
        already_deleted: true,
        deleted: {},
      });
    }

    // Authorization: cascading deletion uses the service role (bypasses per-user
    // ownership), so gate it carefully. Platform admins may delete any firm.
    // Otherwise the user must belong to the same tenant as the firm AND hold a
    // firm-level role that permits deletion (firm admin / co-admin, or can_delete).
    const isPlatformAdmin = user.role === 'admin';
    const userFirmId = user.linked_firm_id ?? user.data?.linked_firm_id;
    const sameTenant = !!userFirmId && firm.tenant_id === userFirmId;
    const firmRole = user.firm_role ?? user.data?.firm_role;
    const canDelete = (user.can_delete ?? user.data?.can_delete) === true;
    const allowedByFirm = sameTenant && (firmRole === 'admin' || firmRole === 'co-admin' || canDelete);
    if (!isPlatformAdmin && !allowedByFirm) {
      return Response.json({ error: 'Forbidden — insufficient permissions to delete this firm' }, { status: 403 });
    }

    // --- Products of this firm (soft delete) ---
    const products = await svc.entities.Product.filter({ firm_id: firmId });
    const activeProductIds = products.filter((p) => !p.deleted_at).map((p) => p.id);
    for (const pid of activeProductIds) {
      await svc.entities.Product.update(pid, { deleted_at: now });
    }
    counts.products = activeProductIds.length;

    // --- Return series for those products (hard delete) ---
    let rsCount = 0;
    for (const pid of activeProductIds) {
      const rs = await svc.entities.ReturnSeries.filter({ product_id: pid });
      if (rs.length) {
        await svc.entities.ReturnSeries.deleteMany({ product_id: pid });
        rsCount += rs.length;
      }
    }
    counts.return_series = rsCount;

    // --- Contacts tied to this firm (soft delete entirely, even if multi-firm) ---
    const allContacts = await svc.entities.Contact.list('-created_date', 5000);
    const firmContacts = allContacts.filter(
      (c) => Array.isArray(c.firm_ids) && c.firm_ids.includes(firmId) && !c.deleted_at,
    );
    for (const c of firmContacts) {
      await svc.entities.Contact.update(c.id, { deleted_at: now });
    }
    counts.contacts = firmContacts.length;
    const firmContactIds = firmContacts.map((c) => c.id);

    // --- Firm documents (hard delete) ---
    const docs = await svc.entities.FirmDocument.filter({ firm_id: firmId });
    if (docs.length) await svc.entities.FirmDocument.deleteMany({ firm_id: firmId });
    counts.documents = docs.length;

    // --- Due diligence records (hard delete) ---
    const dd = await svc.entities.DueDiligence.filter({ firm_id: firmId });
    if (dd.length) await svc.entities.DueDiligence.deleteMany({ firm_id: firmId });
    counts.due_diligence = dd.length;

    // --- Portfolios where the firm is allocator OR advisor (soft delete) ---
    const portAllocator = await svc.entities.Portfolio.filter({ firm_id: firmId });
    const portAdvisor = await svc.entities.Portfolio.filter({ advisor_firm_id: firmId });
    const portIds = new Set(
      [...portAllocator, ...portAdvisor].filter((p) => !p.deleted_at).map((p) => p.id),
    );
    for (const pid of portIds) {
      await svc.entities.Portfolio.update(pid, { deleted_at: now });
    }
    counts.portfolios = portIds.size;

    // --- Ownership records (hard delete) ---
    const own = await svc.entities.Ownership.filter({ firm_id: firmId });
    if (own.length) await svc.entities.Ownership.deleteMany({ firm_id: firmId });
    counts.ownership = own.length;

    // --- Org charts (hard delete) ---
    const org = await svc.entities.OrgChart.filter({ firm_id: firmId });
    if (org.length) await svc.entities.OrgChart.deleteMany({ firm_id: firmId });
    counts.org_charts = org.length;

    // --- Contact activities referencing the firm or its contacts (hard delete) ---
    const allActivities = await svc.entities.ContactActivity.list('-created_date', 5000);
    const firmActivities = allActivities.filter((a) => {
      const assoc = (Array.isArray(a.associated_firms_contacts) &&
        a.associated_firms_contacts.some((af) => af && af.firm_id === firmId));
      const contact = firmContactIds.includes(a.contact_id);
      return assoc || contact;
    });
    for (const a of firmActivities) {
      await svc.entities.ContactActivity.delete(a.id);
    }
    counts.activities = firmActivities.length;

    // --- Follow-up tasks referencing the firm or its contacts (hard delete) ---
    const allTasks = await svc.entities.FollowUpTask.list('-created_date', 5000);
    const firmTasks = allTasks.filter((t) => {
      if (t.originator_firm_id === firmId) return true;
      const assocFirms = (Array.isArray(t.assigned_firms_contacts) &&
        t.assigned_firms_contacts.some((af) => af && af.firm_id === firmId));
      const assocContacts = (Array.isArray(t.assigned_firms_contacts) &&
        t.assigned_firms_contacts.some((af) =>
          Array.isArray(af.contacts) && af.contacts.some((c) => firmContactIds.includes(c.contact_id))));
      const assignments = (Array.isArray(t.assignments) &&
        t.assignments.some((asg) => firmContactIds.includes(asg.contact_id)));
      return assocFirms || assocContacts || assignments;
    });
    for (const t of firmTasks) {
      await svc.entities.FollowUpTask.delete(t.id);
    }
    counts.follow_up_tasks = firmTasks.length;

    // --- Finally, soft-delete the firm itself ---
    await svc.entities.Firm.update(firmId, { deleted_at: now });

    return Response.json({
      success: true,
      firm_id: firmId,
      firm_name: firm.name,
      deleted: counts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});