import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Fetches all contact records linked to a specific firm, using server-side
 * cursor-based pagination under the service role to bypass the 5,000-row
 * single-query limit. Only non-deleted contacts with the firm_id in their
 * firm_ids array are returned.
 *
 * Body: { firm_id: string }
 * Returns: { records: Contact[], total: number, batches: number }
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(entity: any, filter: any, sort: string, limit: number, retries = 3): Promise<any[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await entity.filter(filter, sort, limit);
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('rate') || err?.message?.includes('traffic');
      if (attempt === retries || !is429) throw err;
      const delays = [8000, 15000, 25000];
      await sleep(delays[attempt] || 25000);
    }
  }
  return [];
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const firmId = body?.firm_id;
    if (!firmId) return Response.json({ error: 'firm_id is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const BATCH = 5000;
    const all: any[] = [];
    let lastDate: string | null = null;
    let batchNum = 0;

    while (true) {
      const filter: any = { firm_ids: firmId, deleted_at: null };
      if (lastDate) filter.created_date = { $lt: lastDate };
      const batch = await fetchWithRetry(entities.Contact, filter, '-created_date', BATCH);
      all.push(...batch);
      batchNum++;

      if (batch.length < BATCH) break;

      const last = batch[batch.length - 1];
      lastDate = last?.created_date;
      if (!lastDate) break;

      await sleep(500);
    }

    return Response.json({ records: all, total: all.length, batches: batchNum });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}