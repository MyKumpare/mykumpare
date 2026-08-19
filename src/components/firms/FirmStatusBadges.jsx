import React from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import ProductStatusBadge from "@/components/products/ProductStatusBadge";
import { Package } from "lucide-react";

// Product statuses that count as "under due diligence / reviewed".
// "Not Reviewed" products don't contribute a firm status (they default the firm to Not Reviewed).
const ACTIVE_STATUSES = ["In-Process", "On-Hold", "Rejected", "Approved", "Removed"];

/**
 * Derives the firm's status badge groups from its products' product_status.
 * - If no product is under due diligence → [{ status: "Not Reviewed", products: [] }]
 * - Otherwise → one group per distinct active product status, ordered by ACTIVE_STATUSES.
 *
 * Derived on read (not stored), so it auto-refreshes as product statuses update
 * (products are refetched via the existing realtime subscription).
 */
export function getFirmStatuses(firm, products) {
  const firmProducts = products.filter((p) => p.firm_id === firm.id);
  const contributing = firmProducts.filter((p) => ACTIVE_STATUSES.includes(p.product_status));
  if (contributing.length === 0) return [{ status: "Not Reviewed", products: [] }];
  const map = {};
  for (const p of contributing) {
    if (!map[p.product_status]) map[p.product_status] = [];
    map[p.product_status].push(p);
  }
  return ACTIVE_STATUSES.filter((s) => map[s]).map((s) => ({ status: s, products: map[s] }));
}

export default function FirmStatusBadges({ firm, products, onEditProduct }) {
  const groups = getFirmStatuses(firm, products);
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {groups.map(({ status, products: groupProducts }) =>
        groupProducts.length === 0 ? (
          <ProductStatusBadge key={status} status={status} />
        ) : (
          <HoverCard key={status} openDelay={100} closeDelay={200}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer leading-none"
                title={`${status} · ${groupProducts.length} product${groupProducts.length > 1 ? "s" : ""} — hover to view`}
              >
                <ProductStatusBadge status={status} />
              </button>
            </HoverCardTrigger>
            <HoverCardContent align="start" sideOffset={6} className="w-64 p-2">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-1 pb-1.5">
                {status} · {groupProducts.length} product{groupProducts.length > 1 ? "s" : ""}
              </div>
              <div className="space-y-0.5 max-h-60 overflow-y-auto">
                {groupProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEditProduct?.(p); }}
                    className="w-full flex items-center gap-1.5 px-1.5 py-1.5 rounded-md hover:bg-violet-50 text-left text-xs text-gray-700 transition-colors"
                  >
                    <Package className="w-3 h-3 text-violet-500 flex-shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        )
      )}
    </div>
  );
}