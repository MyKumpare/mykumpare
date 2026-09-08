import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Returns a summary of firms grouped by firm_type (category), counting how many
 * are "active" (have at least one non-deleted product) vs "inactive" (no products).
 * All aggregation is done server-side to avoid loading full datasets to the client.
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

async function fetchAll(entity: any, baseFilter: any): Promise<any[]> {
  const BATCH = 5000;
  const all: any[] = [];
  let lastDate: string | null = null;

  while (true) {
    const filter: any = { ...baseFilter };
    if (lastDate) filter.created_date = { $lt: lastDate };

    let batch: any[] | null = null;
    for (let retry = 0; retry < 3; retry++) {
      try {
        batch = await fetchWithRetry(entity, filter, '-created_date', BATCH);
        break;
      } catch (err: any) {
        if (retry === 2) throw err;
        await sleep(60000);
      }
    }
    if (!batch) throw new Error('Failed to fetch batch after all retries');

    all.push(...batch);
    if (batch.length < BATCH) break;

    const last = batch[batch.length - 1];
    lastDate = last?.created_date;
    if (!lastDate) break;
    await sleep(1000);
  }

  return all;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entities = base44.asServiceRole.entities;

    // Fetch all non-deleted firms and products in parallel
    const [firms, products] = await Promise.all([
      fetchAll(entities.Firm, { deleted_at: null }),
      fetchAll(entities.Product, { deleted_at: null }),
    ]);

    // Build set of firm IDs that have at least one non-deleted product
    const firmsWithProducts = new Set<string>();
    for (const product of products) {
      if (product.firm_id) firmsWithProducts.add(product.firm_id);
    }

    // Group firms by firm_type and count active/inactive
    const categoryMap = new Map<string, { active: number; inactive: number }>();

    for (const firm of firms) {
      const category = firm.firm_type || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { active: 0, inactive: 0 });
      }
      const counts = categoryMap.get(category)!;
      if (firmsWithProducts.has(firm.id)) {
        counts.active++;
      } else {
        counts.inactive++;
      }
    }

    // Convert to sorted array (most firms first)
    const summary = Array.from(categoryMap.entries())
      .map(([firm_type, counts]) => ({
        firm_type,
        active_count: counts.active,
        inactive_count: counts.inactive,
        total_count: counts.active + counts.inactive,
      }))
      .sort((a, b) => b.total_count - a.total_count);

    const totals = {
      total_firms: firms.length,
      total_active: summary.reduce((sum, s) => sum + s.active_count, 0),
      total_inactive: summary.reduce((sum, s) => sum + s.inactive_count, 0),
      total_products: products.length,
    };

    return Response.json({ summary, totals });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}