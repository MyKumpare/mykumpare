import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Scans the database for due diligence data-integrity issues:
//   1. Orphaned DD records — DD whose associated product or firm has been
//      deleted, no longer exists, or was never linked.
//   2. Duplicate DD records — multiple DD records for the same firm + product.
//   3. Stale product statuses — products stuck in "In-Process" or "Approved"
//      product_status with no backing DD record (the DD was deleted or never
//      created, but the auto-set status was never reverted).
//
// Returns a structured list of each issue so the UI can present them for
// user approval before any cleanup action runs.
//
// Authorization: platform admins see all records. Firm admins/co-admins
// only see records tied to their tenant.
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

    // --- Load all DD records, products, and firms ---
    const allDd = await svc.entities.DueDiligence.list('-created_date', 5000);
    const allProducts = await svc.entities.Product.list('-created_date', 5000);
    const allFirms = await svc.entities.Firm.list('-created_date', 5000);

    const productById = new Map(allProducts.map((p) => [p.id, p]));
    const firmById = new Map(allFirms.map((f) => [f.id, f]));
    const deletedProductIds = new Set(allProducts.filter((p) => p.deleted_at).map((p) => p.id));
    const deletedFirmIds = new Set(allFirms.filter((f) => f.deleted_at).map((f) => f.id));

    const inTenant = (rec) => {
      if (isPlatformAdmin) return true;
      if (!userFirmId) return false;
      return rec.tenant_id === userFirmId || rec.firm_id === userFirmId;
    };

    // --- 1. Orphaned DD records ---
    const orphanedDd = [];
    for (const dd of allDd) {
      if (!inTenant(dd)) continue;
      let reason = null;
      let reasonLabel = null;
      if (dd.firm_id && deletedFirmIds.has(dd.firm_id)) {
        reason = 'firm_deleted';
        reasonLabel = 'Associated firm has been deleted';
      } else if (dd.firm_id && !firmById.has(dd.firm_id)) {
        reason = 'firm_missing';
        reasonLabel = 'Associated firm no longer exists';
      } else if (dd.product_id && deletedProductIds.has(dd.product_id)) {
        reason = 'product_deleted';
        reasonLabel = 'Associated product has been deleted';
      } else if (dd.product_id && !productById.has(dd.product_id)) {
        reason = 'product_missing';
        reasonLabel = 'Associated product no longer exists';
      } else if (!dd.product_id) {
        reason = 'no_product';
        reasonLabel = 'Due diligence has no associated product';
      }
      if (reason) {
        orphanedDd.push({
          dd_id: dd.id,
          firm_id: dd.firm_id,
          firm_name: dd.firm_name || firmById.get(dd.firm_id)?.name || 'Unknown',
          product_id: dd.product_id,
          product_name: dd.product_name || productById.get(dd.product_id)?.name || 'Unknown',
          status: dd.status,
          process_status: dd.process_status,
          start_date: dd.start_date,
          reason,
          reason_label: reasonLabel,
        });
      }
    }

    // --- 2. Duplicate DD records (same firm_id + product_id) ---
    const ddByKey = new Map();
    for (const dd of allDd) {
      if (!inTenant(dd)) continue;
      if (!dd.product_id) continue; // skip orphans with no product
      const key = `${dd.firm_id || ''}|${dd.product_id}`;
      if (!ddByKey.has(key)) ddByKey.set(key, []);
      ddByKey.get(key).push(dd);
    }
    const duplicateGroups = [];
    for (const [key, records] of ddByKey.entries()) {
      if (records.length <= 1) continue;
      // Suggest the most-advanced record as the merge primary (Buy List >
      // Pipeline > Rejected), breaking ties by most recent start_date.
      const statusRank = { 'Buy List': 3, 'Pipeline': 2, 'Rejected': 1 };
      records.sort((a, b) => {
        const ra = statusRank[a.status] || 0;
        const rb = statusRank[b.status] || 0;
        if (rb !== ra) return rb - ra;
        return (b.start_date || '').localeCompare(a.start_date || '');
      });
      duplicateGroups.push({
        key,
        firm_id: records[0].firm_id,
        firm_name: records[0].firm_name || firmById.get(records[0].firm_id)?.name || 'Unknown',
        product_id: records[0].product_id,
        product_name: records[0].product_name || productById.get(records[0].product_id)?.name || 'Unknown',
        count: records.length,
        records: records.map((r) => ({
          dd_id: r.id,
          status: r.status,
          process_status: r.process_status,
          start_date: r.start_date,
          primary_analyst_name: r.primary_analyst_name,
          current_stage_index: r.current_stage_index,
        })),
        suggested_primary_id: records[0].id,
      });
    }

    // --- 3. Stale product statuses (In-Process/Approved but no DD record) ---
    const staleProductStatuses = [];
    for (const p of allProducts) {
      if (p.deleted_at) continue;
      if (!inTenant(p)) continue;
      if (p.product_status !== 'In-Process' && p.product_status !== 'Approved') continue;
      const hasDd = allDd.some((dd) => dd.product_id === p.id && !dd.deleted_at);
      if (!hasDd) {
        staleProductStatuses.push({
          product_id: p.id,
          product_name: p.name,
          firm_name: p.firm_name || firmById.get(p.firm_id)?.name || 'Unknown',
          current_status: p.product_status,
          expected_status: 'Not Reviewed',
        });
      }
    }

    return Response.json({
      success: true,
      orphaned_dd: orphanedDd,
      duplicate_groups: duplicateGroups,
      stale_product_statuses: staleProductStatuses,
      totals: {
        orphaned: orphanedDd.length,
        duplicate_groups: duplicateGroups.length,
        duplicate_records: duplicateGroups.reduce((s, g) => s + g.count - 1, 0),
        stale_statuses: staleProductStatuses.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}