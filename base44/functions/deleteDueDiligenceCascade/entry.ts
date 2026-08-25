import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Cascading due diligence deletion.
// Hard-deletes: DueDiligence record itself, plus all related:
//   - DdStageNoteVersion (prior note versions / approval history)
//   - DdNotification (notifications sent to approvers and assigned team members)
// Uses the service role so related records owned by other users are removed too.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ddId = body?.due_diligence_id;
    if (!ddId) return Response.json({ error: 'due_diligence_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const counts = {};

    // Verify the DD record exists.
    const dd = await svc.entities.DueDiligence.get(ddId);
    if (!dd) return Response.json({ error: 'Due diligence record not found' }, { status: 404 });

    // Authorization: cascading deletion uses the service role (bypasses per-user
    // ownership), so gate it carefully. Platform admins may delete any DD.
    // Otherwise the user must belong to the same tenant as the DD record AND
    // hold a firm-level role that permits deletion (firm admin / co-admin, or can_delete).
    const isPlatformAdmin = user.role === 'admin';
    const userFirmId = user.linked_firm_id ?? user.data?.linked_firm_id;
    const sameTenant = !!userFirmId && dd.tenant_id === userFirmId;
    const firmRole = user.firm_role ?? user.data?.firm_role;
    const canDelete = (user.can_delete ?? user.data?.can_delete) === true;
    const allowedByFirm = sameTenant && (firmRole === 'admin' || firmRole === 'co-admin' || canDelete);
    if (!isPlatformAdmin && !allowedByFirm) {
      return Response.json({ error: 'Forbidden — insufficient permissions to delete this due diligence record' }, { status: 403 });
    }

    // --- Stage note versions (prior approvals / note history) ---
    const versions = await svc.entities.DdStageNoteVersion.filter({ due_diligence_id: ddId });
    if (versions.length) {
      await svc.entities.DdStageNoteVersion.deleteMany({ due_diligence_id: ddId });
    }
    counts.stage_note_versions = versions.length;

    // --- Notifications (approver + assigned team member notifications) ---
    const notifications = await svc.entities.DdNotification.filter({ due_diligence_id: ddId });
    if (notifications.length) {
      await svc.entities.DdNotification.deleteMany({ due_diligence_id: ddId });
    }
    counts.notifications = notifications.length;

    // --- Finally, delete the due diligence record itself ---
    await svc.entities.DueDiligence.delete(ddId);

    // --- Recompute the product's product_status now that this DD is gone ---
    // The DD sync sets product_status to "In-Process" (when a DD is started) and
    // "Approved" (when a DD reaches Buy List). Deleting the DD must revert that
    // auto-set status so the product isn't left stuck in a state backed by no
    // DD record. Manual statuses (On-Hold, Rejected, Removed) are never touched.
    if (dd.product_id) {
      try {
        const product = await svc.entities.Product.get(dd.product_id);
        if (product && (product.product_status === "In-Process" || product.product_status === "Approved")) {
          const remaining = (await svc.entities.DueDiligence.filter({ product_id: dd.product_id }))
            .filter((r) => !r.deleted_at);
          const hasBuyList = remaining.some((r) => r.status === "Buy List");
          const hasActive = remaining.some((r) => r.status !== "Buy List" && r.status !== "Rejected");
          const newStatus = hasBuyList ? "Approved" : (hasActive ? "In-Process" : "Not Reviewed");
          if (newStatus !== product.product_status) {
            await svc.entities.Product.update(dd.product_id, { product_status: newStatus });
            counts.product_status_reverted = { from: product.product_status, to: newStatus };
          }
        }
      } catch { /* product not found — no-op */ }
    }

    return Response.json({
      success: true,
      due_diligence_id: ddId,
      product_name: dd.product_name,
      deleted: counts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}