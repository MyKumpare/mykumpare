import React from "react";
import { cn } from "@/lib/utils";

const STYLES = {
  Funded: "bg-emerald-100 text-emerald-700",
  Terminated: "bg-red-100 text-red-700",
};

/**
 * Badge showing a product's (or firm's aggregated) funding status.
 * Renders nothing when status is empty — funding status only appears once
 * the due diligence is completed and the product has been in a portfolio.
 */
export default function FundingStatusBadge({ status, className }) {
  if (!status || !STYLES[status]) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap",
        STYLES[status],
        className
      )}
    >
      {status}
    </span>
  );
}