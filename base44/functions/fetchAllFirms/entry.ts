import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Fetches firm records using server-side cursor-based pagination under the
 * service role, bypassing the 5,000-row single-query limit and user-level
 * entity read rate limits. Retries with backoff on 429 throttling.
 *
 * Two modes:
 *  - Batch mode (body has `cursor`/`limit`): returns one page { records, nextCursor, hasMore }
 *  - Legacy mode (no body): returns ALL records { records, total, batches }
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(entity: any, filter: any, sort: string, limit: number, retries = 5): Promise<any[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await entity.filter(filter, sort, limit);
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('rate') || err?.message?.includes('traffic');
      if (attempt === retries || !is429) throw err;
      const delays = [10000, 20000, 30000, 40000, 50000];
      await sleep(delays[attempt] || 50000);
    }
  }
  throw new Error('fetchWithRetry exhausted all retries');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entities = base44.asServiceRole.entities;

    // Parse optional batch-mode parameters from the request body.
    let batchMode = false;
    let cursor: string | null = null;
    let limit = 500;
    try {
      const body = await req.json();
      if (body && typeof body === 'object' && ('cursor' in body || 'limit' in body || 'batchMode' in body)) {
        batchMode = true;
        cursor = body.cursor ?? null;
        limit = body.limit ?? 500;
      }
    } catch { /* no body — legacy mode */ }

    if (batchMode) {
      // Only fetch non-deleted firms in batch mode
      const filter: any = { deleted_at: null };
      if (cursor) filter.created_date = { $lt: cursor };
      const batch = await fetchWithRetry(entities.Firm, filter, '-created_date', limit);
      const hasMore = batch.length === limit;
      const nextCursor = hasMore && batch.length > 0 ? batch[batch.length - 1]?.created_date : null;
      return Response.json({ records: batch, nextCursor, hasMore });
    }

    // Legacy mode: fetch ALL records
    const BATCH = 5000;
    const all: any[] = [];
    let lastDate: string | null = null;
    let batchNum = 0;

    while (true) {
      const filter = lastDate ? { created_date: { $lt: lastDate } } : {};

      let batch: any[] | null = null;
      for (let outerRetry = 0; outerRetry < 3; outerRetry++) {
        try {
          batch = await fetchWithRetry(entities.Firm, filter, '-created_date', BATCH);
          break;
        } catch (err: any) {
          if (outerRetry === 2) throw err;
          await sleep(60000);
        }
      }
      if (!batch) throw new Error('Failed to fetch batch after all retries');

      all.push(...batch);
      batchNum++;

      if (batch.length < BATCH) break;

      const last = batch[batch.length - 1];
      lastDate = last?.created_date;
      if (!lastDate) break;

      await sleep(1000);
    }

    return Response.json({ records: all, total: all.length, batches: batchNum });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}