import React, { useMemo } from "react";
import { Package } from "lucide-react";

const STATUS_STYLES = {
  "Not Reviewed": "bg-gray-100 text-gray-600",
  "In-Process": "bg-amber-100 text-amber-700",
  "On-Hold": "bg-blue-100 text-blue-700",
  Rejected: "bg-red-100 text-red-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Removed: "bg-gray-200 text-gray-500",
};

/**
 * Compact product list for one firm in the comparison view.
 */
export default function FirmCompareProducts({ products = [] }) {
  const sorted = useMemo(
    () => [...products].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [products]
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-gray-400 italic">No products.</p>;
  }

  return (
    <div className="space-y-1.5">
      {sorted.map((p) => {
        const status = p.product_status || "Not Reviewed";
        const style = STATUS_STYLES[status] || "bg-gray-100 text-gray-600";
        return (
          <div key={p.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-gray-100 bg-white">
            <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
              <p className="text-[11px] text-gray-400 truncate">
                {[p.product_type, p.asset_class].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${style}`}>
              {status}
            </span>
          </div>
        );
      })}
    </div>
  );
}