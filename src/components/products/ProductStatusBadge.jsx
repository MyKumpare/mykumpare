import React from "react";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES = {
  "Not Reviewed": "bg-gray-100 text-gray-600 border-gray-200",
  "In-Process": "bg-blue-50 text-blue-700 border-blue-200",
  "On-Hold": "bg-amber-50 text-amber-700 border-amber-200",
  "Rejected": "bg-rose-50 text-rose-700 border-rose-200",
  "Approved": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Removed": "bg-zinc-100 text-zinc-500 border-zinc-200",
};

export default function ProductStatusBadge({ status, className = "" }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES["Not Reviewed"];
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 h-4 font-medium leading-none ${style} ${className}`}
    >
      {status || "Not Reviewed"}
    </Badge>
  );
}