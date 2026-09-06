import { useInfiniteQuery } from "@tanstack/react-query";

/**
 * Generic infinite-scroll hook for any Base44 entity, built on useInfiniteQuery.
 * Uses cursor-based pagination via a backend function to avoid client-side rate limits.
 *
 * @param {Object}   opts
 * @param {Array}    opts.queryKey   - React Query cache key (e.g. ["firms"])
 * @param {Function} opts.fetchFn    - (cursor, limit) => Promise<{ records, nextCursor, hasMore }>
 * @param {number}   opts.batchSize  - items per page (default 500)
 * @param {number}   opts.staleTime  - React Query stale time in ms (default 300000)
 * @param {boolean}  opts.enabled    - whether the query is enabled (default true)
 * @returns {Object} useInfiniteQuery result
 */
export function useInfiniteEntity({
  queryKey,
  fetchFn,
  batchSize = 500,
  staleTime = 300000,
  enabled = true,
}) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => fetchFn(pageParam, batchSize),
    initialPageParam: null,
    getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage.nextCursor : undefined),
    staleTime,
    enabled,
  });

  return query;
}