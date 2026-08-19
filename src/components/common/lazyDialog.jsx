import React, { useState, useEffect, Suspense } from "react";

/**
 * Wraps a dynamic import with retry logic. Handles the common Vite
 * "Failed to fetch dynamically imported module" error caused by stale
 * chunk hashes (from a rebuilt app) still cached in the browser, or
 * transient network blips in the preview sandbox.
 *
 * On final failure, reloads the page so the browser fetches the fresh
 * HTML + chunks with updated hashes.
 */
function withRetry(loadFn, retries = 3) {
  return async () => {
    let lastErr;
    for (let i = 0; i < retries; i++) {
      try {
        return await loadFn();
      } catch (err) {
        lastErr = err;
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, 300 * (i + 1)));
        }
      }
    }
    // All retries failed — force a cache-busting reload so the browser
    // re-fetches fresh HTML and the current chunk hashes (a plain reload()
    // can still serve stale chunks from cache, which loops the same error).
    if (typeof window !== "undefined" && window.location) {
      const url = new URL(window.location.href);
      url.searchParams.set("_rr", Date.now());
      window.location.replace(url.toString());
    }
    throw lastErr;
  };
}

/**
 * Wraps a dialog/modal component in React.lazy + conditional mounting.
 * The dialog's code is only downloaded when first opened, and the
 * component is only mounted after it has been opened at least once
 * (preserving close animations by staying mounted after first open).
 *
 * Includes automatic retry + reload on chunk-load failures.
 *
 * Usage:
 *   const MyDialog = lazyDialog(() => import("./MyDialog"));
 *   <MyDialog open={open} onOpenChange={setOpen} ... />
 */
export function lazyDialog(loadFn) {
  const LazyComponent = React.lazy(withRetry(loadFn));
  return function LazyDialogWrapper({ open, ...props }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
      if (open) setMounted(true);
    }, [open]);
    if (!mounted) return null;
    return (
      <Suspense fallback={null}>
        <LazyComponent open={open} {...props} />
      </Suspense>
    );
  };
}