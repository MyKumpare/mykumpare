import { useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

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
 * @param {boolean}  opts.clearOnMount - if true, forces a completely fresh fetch on every mount by appending a unique session id to the query key, bypassing all cached pages from prior visits (default false)
 * @returns {Object} useInfiniteQuery result
 */
export function useInfiniteEntity({
  queryKey,
  fetchFn,
  batchSize = 500,
  staleTime = 300000,
  enabled = true,
  clearOnMount = false,
}) {
  const queryClient = useQueryClient();

  // When clearOnMount is true, generate a unique session id on every mount.
  // Appending it to the query key creates a brand-new cache entry, so no stale
  // pages from a prior visit are ever reused. The old cache entries are
  // cleaned up below to avoid memory leaks.
  const [sessionId] = useState(() => (clearOnMount ? `${Date.now()}-${Math.random().toString(36).slice(2)}` : null));
  const effectiveQueryKey = clearOnMount ? [...queryKey, sessionId] : queryKey;

  // Clean up the cache entry for this session when the component unmounts so
  // we don't accumulate orphaned cache entries on every visit.
  useEffect(() => {
    if (!clearOnMount) return;
    return () => {
      queryClient.removeQueries({ queryKey: effectiveQueryKey, exact: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = useInfiniteQuery({
    queryKey: effectiveQueryKey,
    queryFn: async ({ pageParam }) => fetchFn(pageParam, batchSize),
    initialPageParam: null,
    getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage.nextCursor : undefined),
    staleTime,
    enabled,
    refetchOnMount: "always",
  });

  return query;
}