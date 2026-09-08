import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import FundingStatusBadge from "@/components/products/FundingStatusBadge";
import ProductStatusBadge from "@/components/products/ProductStatusBadge";
import { Package, Search } from "lucide-react";

const TYPE_COLORS = {
  "Investment Manager": "bg-blue-100 text-blue-700",
  "Allocator": "bg-emerald-100 text-emerald-700",
  "Investment Consultant": "bg-amber-100 text-amber-700",
  "Securities Brokerage": "bg-orange-100 text-orange-700",
  "Trade Organizations": "bg-gray-100 text-gray-700",
};

const getFirmTypes = (f) =>
  f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];

const STATUS_LABEL = {
  all: "All Products",
  Funded: "Funded Products",
  Terminated: "Terminated Products",
  pending: "Pending Products",
};

/**
 * Dialog showing a filtered list of products for a specific firm type,
 * optionally narrowed by funding status. Each product row is clickable
 * to open the product form via onProductClick.
 */
export default function FirmTypeProductListDialog({
  open,
  onOpenChange,
  firmType,
  fundingStatus,
  products,
  firms,
  onProductClick,
}) {
  const [search, setSearch] = useState("");

  const firmMap = useMemo(() => Object.fromEntries(firms.map((f) => [f.id, f])), [firms]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const firm = firmMap[p.firm_id];
      if (!firm) return false;
      const types = getFirmTypes(firm);
      if (!types.includes(firmType)) return false;
      if (fundingStatus === "all") return true;
      if (fundingStatus === "pending") return p.funding_status !== "Funded" && p.funding_status !== "Terminated";
      return p.funding_status === fundingStatus;
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (firmMap[p.firm_id]?.name || "").toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [products, firmMap, firmType, fundingStatus, search]);

  const handleProductClick = (product) => {
    onOpenChange(false);
    if (onProductClick) onProductClick(product);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLORS[firmType] || "bg-gray-100 text-gray-600"}`}>
              {firmType}
            </span>
            <span>{STATUS_LABEL[fundingStatus] || "Products"}</span>
          </DialogTitle>
          <DialogDescription>
            {filtered.length} product{filtered.length !== 1 ? "s" : ""} for {firmType} firms
            {fundingStatus !== "all" && ` — ${STATUS_LABEL[fundingStatus]}`}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product or firm name..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-accent transition-colors group border border-transparent hover:border-border"
                >
                  <Package className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {firmMap[product.firm_id]?.name || "—"}
                    </p>
                  </div>
                  <ProductStatusBadge status={product.product_status} className="flex-shrink-0" />
                  <FundingStatusBadge status={product.funding_status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}