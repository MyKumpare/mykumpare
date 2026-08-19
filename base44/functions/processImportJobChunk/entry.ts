import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyFirmEnrichment } from '../../shared/firmEnrichApply.ts';

// Background worker for server-side import jobs. Called by the "Process Import
// Jobs" workflow (entity trigger on ImportJob) and also safe to call directly.
// Processes ONE pending item per invocation (enrichment takes ~30-90s, near
// the function timeout, so one-per-call keeps us within limits). Marks the
// item done/failed, increments progress, and flips the job to 'completed'
// when all items are processed. Idempotent — skips items already done.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    let jobId: string | undefined = body?.job_id;

    // If no job_id supplied (safety-net call), pick the oldest enriching job.
    if (!jobId) {
      const jobs = await svc.entities.ImportJob.filter({ status: 'enriching' }, 'created_date', 1);
      if (Array.isArray(jobs) && jobs.length > 0) jobId = jobs[0].id;
    }
    if (!jobId) return Response.json({ status: 'idle', message: 'No active import job.' });

    const job = await svc.entities.ImportJob.get(jobId);
    if (!job) return Response.json({ error: 'Import job not found' }, { status: 404 });
    if (job.status !== 'enriching') return Response.json({ status: job.status, progress: job.progress, total: job.total });

    const pendingItems: any[] = Array.isArray(job.pending_items) ? job.pending_items : [];
    const next = pendingItems.find((it: any) => it.state === 'pending');
    if (!next) {
      // Nothing pending — ensure the job is marked completed.
      if ((job.progress || 0) >= (job.total || 0)) {
        await svc.entities.ImportJob.update(job.id, { status: 'completed' });
      }
      return Response.json({ status: 'completed', progress: job.progress, total: job.total });
    }

    // Claim the item (mark in_progress) so a concurrent run doesn't double-process.
    const claimedItems = pendingItems.map((it: any) => it.id === next.id ? { ...it, state: 'in_progress' } : it);
    await svc.entities.ImportJob.update(job.id, { pending_items: claimedItems });

    let summary: any;
    try {
      if (job.source === 'firm') {
        const firm = await svc.entities.Firm.get(next.id);
        if (!firm) throw new Error('Firm not found');
        let enriched: any = null;
        try {
          const res = await svc.functions.invoke('enrichFirmFromWebsite', {
            firm_name: firm.name,
            website_url: firm.website || next.website || '',
          });
          enriched = res?.data && typeof res.data === 'object' ? res.data : res;
          if (enriched?.error) throw new Error(enriched.error);
        } catch (err: any) {
          throw new Error(err?.message || 'Enrichment request failed');
        }
        summary = await applyFirmEnrichment(firm, enriched || {}, firm.tenant_id || job.tenant_id, svc);
      } else {
        throw new Error(`Import source '${job.source}' is not yet supported by the background processor.`);
      }
    } catch (err: any) {
      summary = { name: next.name, fields_updated: 0, contacts_created: 0, contacts_updated: 0, error: err?.message || 'Enrichment failed' };
    }

    // Commit: mark the item done/failed, increment progress, append summary.
    const finalItems = pendingItems.map((it: any) =>
      it.id === next.id ? { ...it, state: summary.error ? 'failed' : 'done', error: summary.error || '' } : it
    );
    const newProgress = (job.progress || 0) + 1;
    const summaries = [...(job.results?.enrichment_summaries || []), {
      name: summary.name,
      fields_updated: summary.fields_updated || 0,
      contacts_created: summary.contacts_created || 0,
      contacts_updated: summary.contacts_updated || 0,
      error: summary.error || '',
    }];
    const isDone = newProgress >= (job.total || 0);
    await svc.entities.ImportJob.update(job.id, {
      pending_items: finalItems,
      progress: newProgress,
      status: isDone ? 'completed' : 'enriching',
      results: {
        ...(job.results || {}),
        enrichment_summaries: summaries,
      },
    });

    return Response.json({
      status: isDone ? 'completed' : 'enriching',
      progress: newProgress,
      total: job.total,
      current: summary.name,
      error: summary.error || null,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}