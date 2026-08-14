import React, { useEffect } from "react";
import ProductAumHistoryDerived from "./ProductAumHistoryDerived";

/**
 * Product AUM History is now a read-only view derived from the parent firm's
 * allocation matrix (the single source of truth). onDirtyChange / saveRef are
 * kept for interface compatibility with the product detail dialog but are
 * no-ops since this view is not editable.
 */
export default function ProductAumHistoryTab({ productId, productName, onDirtyChange, saveRef }) {
  useEffect(() => {
    if (onDirtyChange) onDirtyChange(false);
  }, [onDirtyChange]);

  useEffect(() => {
    if (saveRef) saveRef.current = async () => {};
  }, [saveRef]);

  return <ProductAumHistoryDerived productId={productId} productName={productName} />;
}