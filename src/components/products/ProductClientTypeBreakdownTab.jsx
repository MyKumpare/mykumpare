import React from "react";
import ClientTypeBreakdownSection from "@/components/shared/ClientTypeBreakdownSection";

/**
 * Product wrapper for the reusable client-type AUM breakdown editor.
 * Mirrors the ProductAumHistoryTab → FirmAumHistoryTab pattern.
 */
export default function ProductClientTypeBreakdownTab({ productId, productName }) {
  return (
    <ClientTypeBreakdownSection
      entityId={productId}
      entityName="Product"
      entityLabel="Product"
    />
  );
}