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

    if (source !== 'firm') {
      return Response.json({ error: `Import source '${source}' is not yet supported by the server-side job.` }, { status: 400 });
    }
    if (!tenantId) {
      return Response.json({ error: 'Tenant id is required to start an import job.' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const accepted = items.filter((it: any) => it?.accept && it?.firm);
    const mergedItems = items.filter((it: any) => it?.mergeTargetId);
    const duplicateSkipped = items
      .filter((it: any) => !it?.accept && !it?.mergeTargetId)
      .map((it: any) => ({ row: it?.row, error: 'Skipped — duplicate firm name' }));
    const failed: any[] = [];
    const createdFirms: any[] = [];

    // Bulk-create accepted firms in batches (SDK bulkCreate cap).
    const BATCH = 100;
    for (let i = 0; i < accepted.length; i += BATCH) {
      const batch = accepted.slice(i, i + BATCH);
      try {
        const toCreate = batch.map((b: any) => ({ ...b.firm, tenant_id: b.firm.tenant_id || tenantId }));
        const created = await svc.entities.Firm.bulkCreate(toCreate);
        (Array.isArray(created) ? created : []).forEach((f: any) => createdFirms.push(f));
      } catch (err: any) {
        batch.forEach((b: any) => failed.push({ row: b.row, error: err?.message || 'Create failed' }));
      }
    }

    // Apply append-only merges into chosen existing firms.
    let mergedCount = 0;
    for (const it of mergedItems) {
      try {
        const target = await svc.entities.Firm.get(it.mergeTargetId);
        if (!target) {
          failed.push({ row: it.row, error: 'Merge target firm not found' });
          continue;
        }
        const updates = buildCsvMergeUpdates(target, it.firm || {});
        if (Object.keys(updates).length > 0) {
          await svc.entities.Firm.update(target.id, updates);
        }
        mergedCount++;
      } catch (err: any) {
        failed.push({ row: it.row, error: err?.message || 'Merge failed' });
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