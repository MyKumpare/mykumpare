import { base44 } from "@/api/base44Client";

const BATCH_SIZE = 500;
const MAX_PAGES = 200;
const RETRY_DELAYS = [3000, 6000, 10000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function invokeWithRetry(functionName, payload) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await base44.functions.invoke(functionName, payload);
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt]);
    }
  }
  throw lastErr;
}

/**
 * Fetches ALL records for an entity in a single query.
 *
 * Primary strategy: legacy mode — one function invocation that fetches
 * everything server-side (the server handles pagination and 429 backoff
 * internally). This means only ONE call per entity instead of dozens of
 * batch calls, dramatically reducing the chance of hitting rate limits.
 *
 * Fallback: if legacy mode fails (e.g. response too large → 500), falls
 * back to batch mode with client-side cursor looping and retry.
 */
export async function fetchAllRecords(functionName) {
  // ── Legacy mode: one server-side call ──
  try {
    const res = await invokeWithRetry(functionName, { all: true });
    const data = res?.data ?? res ?? {};
    if (data.records) {
      return { records: data.records, nextCursor: null, hasMore: false };
    }
  } catch (err) {
    console.warn(`[fetchAllRecords] Legacy mode failed for ${functionName}, falling back to batch mode`, err);
  }

  // ── Batch mode fallback: client-side cursor loop ──
  const all = [];
  let cursor = null;
  let pages = 0;

  while (pages < MAX_PAGES) {
    pages++;
    const res = await invokeWithRetry(functionName, { cursor, limit: BATCH_SIZE });
    const data = res?.data ?? res ?? {};
    const records = data.records || [];
    all.push(...records);
    if (!data.hasMore || !data.nextCursor) break;
    cursor = data.nextCursor;
  }

  return { records: all, nextCursor: null, hasMore: false };
}