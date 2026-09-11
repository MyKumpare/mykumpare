import { base44 } from "@/api/base44Client";

const BATCH_SIZE = 500;
const MAX_PAGES = 200;
const RETRY_DELAYS = [3000, 6000, 10000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches ALL pages of a cursor-paginated backend function in a single call.
 * Loops through pages client-side (via cursor) so all records are returned
 * as one batch with hasMore: false — no incremental page loading needed.
 *
 * Retries on 429 rate-limit errors with backoff, since multiple entities
 * are fetched concurrently on app open.
 */
export async function fetchAllRecords(functionName, cursor = null) {
  const all = [];
  let currentCursor = cursor;
  let pages = 0;

  while (pages < MAX_PAGES) {
    pages++;
    let data;
    let lastErr;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const res = await base44.functions.invoke(functionName, {
          cursor: currentCursor,
          limit: BATCH_SIZE,
        });
        data = res?.data ?? res ?? {};
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt]);
      }
    }
    if (lastErr) throw lastErr;

    const records = data.records || [];
    all.push(...records);
    if (!data.hasMore || !data.nextCursor) break;
    currentCursor = data.nextCursor;
  }

  return { records: all, nextCursor: null, hasMore: false };
}