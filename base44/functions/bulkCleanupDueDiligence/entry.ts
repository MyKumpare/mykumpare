import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { cascadeDeleteDueDiligence, mergeDueDiligenceRecords } from '../../shared/dueDiligenceCleanup.ts';

// Executes a user-approved list of due diligence cleanup actions. Each item
// in the payload `actions` array is one of:
//   - { type: 'delete_orphan', dd_id }
//       Cascade-deletes an orphaned DD record (plus its stage note versions
//       and notifications) and reverts the product's auto-set status.
//   - { type: 'merge_duplicates', primary_id, secondary_ids: string[] }
//       Merges duplicate DD records into the primary, repointing linked
//       records and deleting the secondaries.
//   - { type: 'fix_product_status', product_id, new_status? }
//       Reverts a product stuck in In-Process/Approved (with no backing DD)
//       back to Not Reviewed (or the specified new_status).
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
    const actions = Array.isArray(body?.actions) ? body.actions : [];
    if (actions.length === 0) {
      return Response.json({ error: 'actions array is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const results = [];

    for (const action of actions) {
      const { type } = action;
      try {
        if (type === 'delete_orphan') {
          const { dd, counts } = await cascadeDeleteDueDiligence(svc, action.dd_id);
          if (!dd) {
            results.push({ type, dd_id: action.dd_id, status: 'error', error: 'Record not found' });
          } else {
            results.push({ type, dd_id: action.dd_id, status: 'success', deleted: counts });
          }
        } else if (type === 'merge_duplicates') {
          const { counts } = await mergeDueDiligenceRecords(svc, action.primary_id, action.secondary_ids || []);
          results.push({ type, primary_id: action.primary_id, status: 'success', merged: counts });
        } else if (type === 'fix_product_status') {
          const product = await svc.entities.Product.get(action.product_id);
          if (!product) {
            results.push({ type, product_id: action.product_id, status: 'error', error: 'Product not found' });
          } else {
            const newStatus = action.new_status || 'Not Reviewed';
            if (product.product_status !== newStatus) {
              await svc.entities.Product.update(action.product_id, { product_status: newStatus });
              results.push({ type, product_id: action.product_id, status: 'success', from: product.product_status, to: newStatus });
            } else {
              results.push({ type, product_id: action.product_id, status: 'skipped', reason: 'Already correct' });
            }
          }
        } else {
          results.push({ type, status: 'error', error: 'Unknown action type' });
        }
      } catch (err) {
        const errResult = { type, status: 'error', error: err.message };
        if (action.dd_id) errResult.dd_id = action.dd_id;
        if (action.primary_id) errResult.primary_id = action.primary_id;
        if (action.product_id) errResult.product_id = action.product_id;
        results.push(errResult);
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}