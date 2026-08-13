import React from "react";
import FirmAumHistoryTab from "@/components/firms/FirmAumHistoryTab";

export default function ProductAumHistoryTab({ productId, productName, onDirtyChange, saveRef }) {
  return (
    <FirmAumHistoryTab
      firmId={productId}
      firmName={productName}
      entityName="Product"
      entityLabel="Product"
      onDirtyChange={onDirtyChange}
      saveRef={saveRef}
    />
  );
}