import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyFirmEnrichment } from '../../shared/firmEnrichApply.ts';

// Background worker for server-side import jobs. Called by the "Process Import
// Jobs" workflow (scheduled every 5 minutes) and also safe to call directly.
// Processes as many pending items as possible within a ~50-second time budget
// across ALL enriching jobs. Marks each item done/failed, increments progress,
// and flips jobs to 'completed' when all items are processed. Idempotent —
// skips items already done/in_progress.
const TIME_BUDGET_MS = 50_000; // leave a safety margin before the function timeout

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const requestedJobId: string | undefined = body?.job_id;

    const startedAt = Date.now();
    let processed = 0;
    let failed = 0;
    let jobsTouched = 0;

    // Process items until we run out of time or have no more pending items.
    while (Date.now() - startedAt < TIME_BUDGET_MS) {
      // Find the oldest enriching job (or use the requested one).
      let jobId: string | undefined = requestedJobId;
      if (!jobId) {
        const jobs = await svc.entities.ImportJob.filter({ status: 'enriching' }, 'created_date', 1);
        if (Array.isArray(jobs) && jobs.length > 0) jobId = jobs[0].id;
      }
      if (!jobId) break; // no active jobs

      const job = await svc.entities.ImportJob.get(jobId);
      if (!job || job.status !== 'enriching') {
        if (requestedJobId) break; // specific job finished
        continue; // try finding the next job
      }

      const pendingItems: any[] = Array.isArray(job.pending_items) ? job.pending_items : [];
      const next = pendingItems.find((it: any) => it.state === 'pending');
      if (!next) {
        // Nothing pending in this job — mark completed if progress >= total.
        if ((job.progress || 0) >= (job.total || 0)) {
          await svc.entities.ImportJob.update(job.id, { status: 'completed' });
        }
        if (requestedJobId) break;
        // Mark this job as done and continue looking for other jobs.
        // To avoid re-fetching the same completed job, we set a flag.
        jobsTouched++;
        if (jobsTouched > 50) break; // safety limit
        continue;
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

      processed++;
      if (summary.error) failed++;

      // If a specific job was requested and it's done, stop.
      if (requestedJobId && isDone) break;
    }

    if (processed === 0) {
      return Response.json({ status: 'idle', message: 'No pending import items to process.' });
    }

    return Response.json({
      status: 'processed',
      processed,
      failed,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}