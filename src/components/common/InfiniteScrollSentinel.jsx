import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

/**
 * Invisible sentinel element that triggers `onLoadMore` when it scrolls into view.
 * Renders a small spinner while a batch is loading.
 *
 * @param {boolean}  hasMore        - whether more pages are available
 * @param {boolean}  isLoadingMore - whether a batch is currently loading
 * @param {Function} onLoadMore    - callback to fetch the next page
 * @param {string}   rootMargin    - IntersectionObserver root margin (default "400px")
 * @param {string}  label          - label for the loading text (e.g. "firms", "contacts")
 */
export default function InfiniteScrollSentinel({
  hasMore,
  isLoadingMore,
  onLoadMore,
  rootMargin = "400px",
  label = "items",
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    let triggered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !triggered) {
          triggered = true;
          onLoadMore();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore, rootMargin]);

  if (!hasMore && !isLoadingMore) return null;

  return (
    <div
      ref={sentinelRef}
      className="flex items-center justify-center py-4 gap-2 text-sm text-gray-400"
    >
      {isLoadingMore && (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading more {label}…</span>
        </>
      )}
    </div>
  );
}