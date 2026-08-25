import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { mergeDueDiligenceRecords } from '../../shared/dueDiligenceCleanup.ts';

// Merge duplicate Due Diligence records into a single primary entry.
// Moves all associated activities and status history (linked via due_diligence_id)
// from each secondary record into the primary, then deletes the secondaries.
//
// Repointed linked records:
//   - DdStageNoteVersion  (stage note version / approval history)
//   - DdNotification      (approver + assigned team member notifications)
//   - ExternalChat        (external firm chat messages)
//
// Embedded arrays merged into the primary:
//   - analyst_history     (analyst coverage history — appended, deduped)
//
// The secondary DD records are hard-deleted after their linked records are moved.
// Uses the service role so records owned by other users are repointed/removed too.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const primaryId = body?.primary_id;
    const secondaryIds = Array.isArray(body?.secondary_ids) ? body.secondary_ids : [];
    if (!primaryId || secondaryIds.length === 0) {
      return Response.json({ error: 'primary_id and a non-empty secondary_ids array are required' }, { status: 400 });
    }
    if (secondaryIds.includes(primaryId)) {
      return Response.json({ error: 'primary_id cannot appear in secondary_ids' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const primary = await svc.entities.DueDiligence.get(primaryId);
    if (!primary) return Response.json({ error: 'Primary due diligence record not found' }, { status: 404 });

    // Authorization: cascading service-role operation. Platform admins may merge any DD.
    // Otherwise the user must belong to the same tenant as the primary AND hold a
    // firm-level role that permits editing (firm admin / co-admin, or can_edit).
    const isPlatformAdmin = user.role === 'admin';
    const userFirmId = user.linked_firm_id ?? user.data?.linked_firm_id;
    const firmRole = user.firm_role ?? user.data?.firm_role;
    const canEdit = (user.can_edit ?? user.data?.can_edit) === true;
    const allowedByFirm = !!userFirmId && primary.tenant_id === userFirmId &&
      (firmRole === 'admin' || firmRole === 'co-admin' || canEdit);
    if (!isPlatformAdmin && !allowedByFirm) {
      return Response.json({ error: 'Forbidden — insufficient permissions to merge these due diligence records' }, { status: 403 });
    }

    const { counts } = await mergeDueDiligenceRecords(svc, primaryId, secondaryIds);

    return Response.json({
      success: true,
      primary_id: primaryId,
      product_name: primary.product_name,
      merged: counts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}