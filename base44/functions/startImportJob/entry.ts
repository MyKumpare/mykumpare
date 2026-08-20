import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildCsvMergeUpdates } from '../../shared/importMerge.ts';

// Starts a server-side import job. For a 'firm' import the caller (frontend
// CsvFirmImport) passes the final reviewed items — accepted firms to create and
// merge decisions. This function bulk-creates the accepted firms, applies the
// append-only merges, then creates an ImportJob record in 'enriching' state
// with one pending_item per created firm. The "Process Import Jobs" workflow
// then drives enrichment in the background (one firm per run), surviving
// navigation/close. Returns the job id immediately so the frontend can poll
// status.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const source = body?.source || 'firm';
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    const validationSkipped: any[] = Array.isArray(body?.validationSkipped) ? body.validationSkipped : [];
    const tenantId = body?.tenant_id || user?.data?.linked_firm_id || '';

    if (!tenantId) {
      return Response.json({ error: 'Tenant id is required to start an import job.' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Product import: bulk-create accepted products server-side so the import
    // survives navigation/close. Products need no web enrichment, so the job
    // completes immediately with created/failed counts.
    if (source === 'product') {
      const accepted = items.filter((it: any) => it?.accept && it?.product);
      const duplicateSkipped = items
        .filter((it: any) => !it?.accept)
        .map((it: any) => ({
          row: it?.row,
          error: it?.autoSkipped ? 'Skipped — exact duplicate product' : 'Skipped — duplicate product',
          product_name: it?.product?.name || '',
          product_type: it?.product?.product_type || '',
          firm_name: it?.firmName || it?.product?.firm_name || '',
          firm_type: it?.firmType || '',
        }));
      const failed: any[] = [];
      const createdProducts: any[] = [];
      const createdItems: any[] = [];

      // Create new firms for items flagged createFirm (deduped by firm name).
      const newFirmMap: Record<string, any> = {};
      const createFirmItems = accepted.filter((it: any) => it?.createFirm && !it?.firmId);
      for (const it of createFirmItems) {
        const key = (it?.firmName || '').toLowerCase().trim();
        if (!key || newFirmMap[key]) continue;
        try {
          const firm = await svc.entities.Firm.create({
            tenant_id: tenantId,
            name: it.firmName,
            firm_types: Array.isArray(it.firmType) ? it.firmType : (it.firmType ? [it.firmType] : []),
          });
          newFirmMap[key] = firm;
        } catch (err: any) {
          failed.push({ row: it.row, error: `Failed to create firm "${it.firmName}": ${err?.message || 'unknown'}`, product_name: it?.product?.name || '', product_type: it?.product?.product_type || '', firm_name: it.firmName || '', firm_type: it.firmType || '' });
        }
      }

      // Apply user-chosen name updates to mapped existing firms (near-match
      // name resolution). If the user chose the imported name over the
      // existing firm's name, update the firm record so the canonical name
      // matches the user's choice.
      const firmNameUpdates: Record<string, string> = {};
      for (const it of accepted) {
        if (it.firmId && it.mergeTargetName) firmNameUpdates[it.firmId] = it.mergeTargetName;
      }
      for (const fid of Object.keys(firmNameUpdates)) {
        try {
          const firm = await svc.entities.Firm.get(fid);
          if (firm && firmNameUpdates[fid] && firmNameUpdates[fid] !== firm.name) {
            await svc.entities.Firm.update(fid, { name: firmNameUpdates[fid] });
          }
        } catch (err: any) {
          // non-fatal — name update is best-effort
        }
      }

      // Resolve each accepted product to a firm id, then bulk-create.
      const toCreate: { product: any; row: any }[] = [];
      for (const it of accepted) {
        let firmId = it.firmId || null;
        let firmName = it.product.firm_name;
        if (!firmId && it.createFirm) {
          const key = (it.firmName || '').toLowerCase().trim();
          const newFirm = newFirmMap[key];
          if (!newFirm) { failed.push({ row: it.row, error: `Firm not created: ${it.firmName}`, product_name: it?.product?.name || '', product_type: it?.product?.product_type || '', firm_name: it.firmName || '', firm_type: it.firmType || '' }); continue; }
          firmId = newFirm.id;
          firmName = newFirm.name;
        }
        if (!firmId) { failed.push({ row: it.row, error: 'No associated firm', product_name: it?.product?.name || '', product_type: it?.product?.product_type || '', firm_name: it.firmName || '', firm_type: it.firmType || '' }); continue; }
        toCreate.push({ product: { ...it.product, firm_id: firmId, firm_name: firmName, tenant_id: it.product.tenant_id || tenantId }, row: it.row, firmName: it.firmName || firmName, firmType: it.firmType || '' });
      }

      const BATCH = 100;
      for (let i = 0; i < toCreate.length; i += BATCH) {
        const batch = toCreate.slice(i, i + BATCH);
        try {
          const productsToCreate = batch.map((b) => b.product);
          const created = await svc.entities.Product.bulkCreate(productsToCreate);
          (Array.isArray(created) ? created : []).forEach((p: any, idx: number) => {
            createdProducts.push(p);
            createdItems.push({ row: batch[idx]?.row, product_name: p.name, firm_name: batch[idx]?.product?.firm_name || batch[idx]?.firmName || '' });
          });
        } catch (err: any) {
          batch.forEach((b) => failed.push({ row: b.row, error: err?.message || 'Create failed', product_name: b.product?.name || '', product_type: b.product?.product_type || '', firm_name: b.firmName || b.product?.firm_name || '', firm_type: b.firmType || '' }));
        }
      }
      const job = await svc.entities.ImportJob.create({
        tenant_id: tenantId,
        source: 'product',
        status: 'completed',
        total: createdProducts.length,
        progress: createdProducts.length,
        pending_items: [],
        results: {
          created: createdProducts.length,
          merged: 0,
          failed: [...(validationSkipped || []), ...duplicateSkipped, ...failed],
          enrichment_summaries: [],
          created_items: createdItems,
        },
      });
      return Response.json({
        job_id: job.id,
        created: createdProducts.length,
        merged: 0,
        failed: failed.length,
        total: createdProducts.length,
      });
    }

    if (source !== 'firm') {
      return Response.json({ error: `Import source '${source}' is not yet supported by the server-side job.` }, { status: 400 });
    }
    const accepted = items.filter((it: any) => it?.accept && it?.firm);
    const mergedItems = items.filter((it: any) => it?.mergeTargetId);
    const duplicateSkipped = items
      .filter((it: any) => !it?.accept && !it?.mergeTargetId)
      .map((it: any) => ({ row: it?.row, error: 'Skipped — duplicate firm name', name: it?.firm?.name || '', firm_types: (it?.firm?.firm_types || []).join('; ') }));
    const failed: any[] = [];
    const createdFirms: any[] = [];
    const createdItems: any[] = [];

    // Bulk-create accepted firms in batches (SDK bulkCreate cap).
    const BATCH = 100;
    for (let i = 0; i < accepted.length; i += BATCH) {
      const batch = accepted.slice(i, i + BATCH);
      try {
        const toCreate = batch.map((b: any) => ({ ...b.firm, tenant_id: b.firm.tenant_id || tenantId }));
        const created = await svc.entities.Firm.bulkCreate(toCreate);
        (Array.isArray(created) ? created : []).forEach((f: any, idx: number) => {
          createdFirms.push(f);
          createdItems.push({ row: batch[idx]?.row, name: f.name });
        });
      } catch (err: any) {
        batch.forEach((b: any) => failed.push({ row: b.row, error: err?.message || 'Create failed', name: b?.firm?.name || '', firm_types: (b?.firm?.firm_types || []).join('; ') }));
      }
    }

    // Apply append-only merges into chosen existing firms.
    let mergedCount = 0;
    for (const it of mergedItems) {
      try {
        const target = await svc.entities.Firm.get(it.mergeTargetId);
        if (!target) {
          failed.push({ row: it.row, error: 'Merge target firm not found', name: it?.firm?.name || '', firm_types: (it?.firm?.firm_types || []).join('; ') });
          continue;
        }
        const updates = buildCsvMergeUpdates(target, it.firm || {});
        // Apply the user's name choice from the merge picker: if they chose the
        // imported name (differs from the existing name), update the record name.
        if (it.mergeTargetName && it.mergeTargetName !== target.name) {
          updates.name = it.mergeTargetName;
        }
        if (Object.keys(updates).length > 0) {
          await svc.entities.Firm.update(target.id, updates);
        }
        mergedCount++;
      } catch (err: any) {
        failed.push({ row: it.row, error: err?.message || 'Merge failed', name: it?.firm?.name || '', firm_types: (it?.firm?.firm_types || []).join('; ') });
      }
    }

    const pendingItems = createdFirms.map((f: any) => ({
      id: f.id,
      name: f.name,
      website: f.website || '',
      state: 'pending' as const,
    }));

    const job = await svc.entities.ImportJob.create({
      tenant_id: tenantId,
      source: 'firm',
      status: createdFirms.length > 0 ? 'enriching' : 'completed',
      total: createdFirms.length,
      progress: 0,
      pending_items: pendingItems,
      results: {
        created: createdFirms.length,
        merged: mergedCount,
        failed: [...(validationSkipped || []), ...duplicateSkipped, ...failed],
        enrichment_summaries: [],
        created_items: createdItems,
      },
    });

    return Response.json({
      job_id: job.id,
      created: createdFirms.length,
      merged: mergedCount,
      failed: failed.length,
      total: createdFirms.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}