import { useInfiniteQuery } from "@tanstack/react-query";

/**
 * Generic infinite-scroll hook for any Base44 entity, built on useInfiniteQuery.
 *
 * @param {Object}   opts
 * @param {Array}    opts.queryKey   - React Query cache key (e.g. ["firms"])
 * @param {Function} opts.fetchFn    - (skip, limit) => Promise<items[]>
 * @param {number}   opts.batchSize  - items per page (default 500; max 5000 per request)
 * @param {number}   opts.staleTime  - React Query stale time in ms (default 300000)
 * @param {boolean}  opts.enabled    - whether the query is enabled (default true)
 * @returns {Object} useInfiniteQuery result plus a convenience `items` flat array
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
    queryFn: async ({ pageParam = 0 }) => fetchFn(pageParam, batchSize),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, page) => sum + page.length, 0);
      return lastPage.length < batchSize ? undefined : totalLoaded;
    },
    staleTime,
    enabled,
  });

  return query;
}