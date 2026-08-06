import React, { useState, useEffect, Suspense } from "react";

/**
 * Wraps a dialog/modal component in React.lazy + conditional mounting.
 * The dialog's code is only downloaded when first opened, and the
 * component is only mounted after it has been opened at least once
 * (preserving close animations by staying mounted after first open).
 *
 * Usage:
 *   const MyDialog = lazyDialog(() => import("./MyDialog"));
 *   <MyDialog open={open} onOpenChange={setOpen} ... />
 */
export function lazyDialog(loadFn) {
  const LazyComponent = React.lazy(loadFn);
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