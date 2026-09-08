import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Fetches portfolio records using server-side cursor-based pagination under the
 * service role, bypassing the 5,000-row single-query limit and user-level
 * entity read rate limits. Retries with backoff on 429 throttling.
 *
 * Batch mode: body has `cursor`/`limit` → returns { records, nextCursor, hasMore }
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

    let cursor: string | null = null;
    let limit = 50;
    try {
      const body = await req.json();
      if (body && typeof body === 'object') {
        cursor = body.cursor ?? null;
        limit = body.limit ?? 50;
      }
    } catch { /* no body */ }

    const filter: any = { deleted_at: null };
    if (cursor) filter.created_date = { $lt: cursor };
    const batch = await fetchWithRetry(entities.Portfolio, filter, '-created_date', limit);
    const hasMore = batch.length === limit;
    const nextCursor = hasMore && batch.length > 0 ? batch[batch.length - 1]?.created_date : null;
    return Response.json({ records: batch, nextCursor, hasMore });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}