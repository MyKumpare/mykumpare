import { base44 } from "@/api/base44Client";

/**
 * Fetches ALL non-deleted products using cursor-based batch mode.
 *
 * The legacy `fetchAllProducts({})` mode returns the entire dataset (~3.2MB)
 * in a single response, which causes intermittent 500 errors under load.
 * This helper paginates through the backend function in smaller 500-record
 * batches, which is far more reliable while still returning every record.
 *
 * @returns {Promise<Array>} all non-deleted product records
 */
export async function fetchAllProductsBatched() {
  const all = [];
  let cursor = null;
  // Safety cap to prevent infinite loops if the backend misbehaves.
  for (let i = 0; i < 200; i++) {
    const res = await base44.functions.invoke("fetchAllProducts", {
      cursor,
      limit: 500,
      batchMode: true,
    });
    const data = res?.data ?? res ?? {};
    const records = data.records || [];
    all.push(...records);
    if (!data.hasMore || !data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return all.filter((p) => !p.deleted_at);
}