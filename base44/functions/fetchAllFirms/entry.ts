import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Fetches ALL firm records using server-side cursor-based pagination under the
 * service role, bypassing the 5,000-row single-query limit and user-level entity
 * read rate limits. Retries with backoff on 429 throttling.
 *
 * Returns { records: Firm[], total: number }.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(entity: any, filter: any, sort: string, limit: number, retries = 5): Promise<any[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await entity.filter(filter, sort, limit);
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('rate') || err?.message?.includes('traffic');
      if (attempt === retries || !is429) throw err;
      // Rate limit typically asks for ~6s; wait 10s, then 20s, then 30s, then 40s, then 50s
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
    const BATCH = 5000;
    const all: any[] = [];
    let lastDate: string | null = null;
    let batchNum = 0;

    while (true) {
      const filter = lastDate ? { created_date: { $lt: lastDate } } : {};

      // Retry the entire batch up to 3 times with long backoff.
      // Only break out of the loop when a batch legitimately returns < BATCH
      // records (meaning we've reached the end). If a batch fails all retries,
      // we retry the whole batch with an even longer delay.
      let batch: any[] | null = null;
      for (let outerRetry = 0; outerRetry < 3; outerRetry++) {
        try {
          batch = await fetchWithRetry(entities.Firm, filter, '-created_date', BATCH);
          break;
        } catch (err: any) {
          if (outerRetry === 2) throw err;
          await sleep(60000); // 1 minute between full-batch retries
        }
      }
      if (!batch) throw new Error('Failed to fetch batch after all retries');

      all.push(...batch);
      batchNum++;

      if (batch.length < BATCH) break;

      const last = batch[batch.length - 1];
      lastDate = last?.created_date;
      if (!lastDate) break;

      // Small delay between batches to avoid 429 rate-limiting
      await sleep(1000);
    }

    return Response.json({ records: all, total: all.length, batches: batchNum });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}