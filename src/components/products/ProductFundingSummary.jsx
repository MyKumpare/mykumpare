import React, { useMemo, useState, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import FundingStatusBadge from "@/components/products/FundingStatusBadge";
import ProductStatusBadge from "@/components/products/ProductStatusBadge";
import { Package, TrendingUp, TrendingDown, Building2, ChevronRight } from "lucide-react";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const TYPE_COLORS = {
  "Investment Manager": "bg-blue-100 text-blue-700",
  "Allocator": "bg-emerald-100 text-emerald-700",
  "Investment Consultant": "bg-amber-100 text-amber-700",
  "Securities Brokerage": "bg-orange-100 text-orange-700",
  "Trade Organizations": "bg-gray-100 text-gray-700",
};

const getFirmTypes = (f) =>
  f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];

/**
 * Interactive product-count trigger. Hovering or clicking the "X products"
 * text opens a popover listing the firm's products; each product is clickable
 * to open the product form.
 */
function FirmProductCount({ firmId, productsByFirm, onProductClick }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const firmProducts = (productsByFirm[firmId] || []).slice().sort((a, b) =>
    (a.name || "").localeCompare(b.name || "")
  );
  const count = firmProducts.length;

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleMouseEnter = () => {
    cancelClose();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  const handleProductClick = (product) => {
    setOpen(false);
    if (onProductClick) onProductClick(product);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] text-gray-500 hover:text-violet-700 hover:underline cursor-pointer font-medium transition-colors"
        >
          {count} product{count !== 1 ? "s" : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-64 p-0"
        onMouseEnter={cancelClose}
        onMouseLeave={handleMouseLeave}
      >
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            {count} Product{count !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {firmProducts.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 italic">No products</p>
          ) : (
            firmProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-violet-50 transition-colors group"
              >
                <Package className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400 flex-shrink-0" />
                <span className="text-xs text-gray-700 group-hover:text-violet-700 font-medium truncate flex-1">
                  {product.name}
                </span>
                <ProductStatusBadge status={product.product_status} className="flex-shrink-0" />
                <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-violet-400 flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Funding-health summary for the Product Dashboard. Shows total active funding,
 * current status counts, a breakdown of funding by firm type, and per-firm
 * detail cards so overall health is visible at a glance.
 */
export default function ProductFundingSummary({ products, firms, onProductClick }) {
  const firmMap = useMemo(() => Object.fromEntries(firms.map((f) => [f.id, f])), [firms]);

  const productsByFirm = useMemo(() => {
    const byFirm = {};
    for (const p of products) {
      const fid = p.firm_id;
      if (!fid) continue;
      if (!byFirm[fid]) byFirm[fid] = [];
      byFirm[fid].push(p);
    }
    return byFirm;
  }, [products]);

  const firmMetrics = useMemo(() => {
    const byFirm = {};
    for (const p of products) {
      const fid = p.firm_id;
      if (!fid) continue;
      if (!byFirm[fid]) byFirm[fid] = { firm_id: fid, total: 0, funded: 0, terminated: 0 };
      byFirm[fid].total++;
      if (p.funding_status === "Funded") byFirm[fid].funded++;
      else if (p.funding_status === "Terminated") byFirm[fid].terminated++;
    }
    return Object.values(byFirm)
      .map((r) => {
        const status = r.funded > 0 ? "Funded" : r.terminated > 0 ? "Terminated" : "";
        return { ...r, status, firm: firmMap[r.firm_id] };
      })
      .filter((r) => r.firm)
      .sort((a, b) => a.firm.name.localeCompare(b.firm.name));
  }, [products, firmMap]);

  const statusCounts = useMemo(() => {
    let funded = 0, terminated = 0, pending = 0;
    for (const p of products) {
      if (p.funding_status === "Funded") funded++;
      else if (p.funding_status === "Terminated") terminated++;
      else pending++;
    }
    return { funded, terminated, pending, total: products.length };
  }, [products]);

  const typeBreakdown = useMemo(() => {
    const byType = {};
    FIRM_TYPES.forEach((t) => { byType[t] = { type: t, firms: 0, total: 0, funded: 0, terminated: 0 }; });
    for (const r of firmMetrics) {
      for (const t of getFirmTypes(r.firm)) {
        if (!byType[t]) continue;
        byType[t].firms++;
        byType[t].total += r.total;
        byType[t].funded += r.funded;
        byType[t].terminated += r.terminated;
      }
    }
    return Object.values(byType).filter((r) => r.firms > 0);
  }, [firmMetrics]);

  if (firmMetrics.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-4">
      {/* Header: total active funding + status counts */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-gray-700">Funding Metrics</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-bold text-emerald-600">{statusCounts.funded}</span>
            <span className="text-[11px] text-gray-500 leading-tight">active<br />funding</span>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> Funded: {statusCounts.funded}
            </span>
            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
              <TrendingDown className="w-3.5 h-3.5" /> Terminated: {statusCounts.terminated}
            </span>
            <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
              Pending: {statusCounts.pending}
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown by firm type */}
      {typeBreakdown.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">By Firm Type</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {typeBreakdown.map((r) => (
              <div key={r.type} className="rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLORS[r.type] || "bg-gray-100 text-gray-600"}`}>
                    {r.type}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto">{r.firms} firm{r.firms !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-600">
                  <span>{r.total} product{r.total !== 1 ? "s" : ""}</span>
                  <span className="text-emerald-700 font-medium">{r.funded} funded</span>
                  {r.terminated > 0 && <span className="text-red-600 font-medium">{r.terminated} terminated</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-firm detail */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
          <Building2 className="w-3 h-3" /> By Firm
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {firmMetrics.map((r) => (
            <div key={r.firm_id} className="rounded-lg border border-gray-100 bg-white p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                {r.firm.logo_url ? (
                  <img src={r.firm.logo_url} alt="" className="w-4 h-4 object-contain rounded flex-shrink-0" />
                ) : null}
                <span className="text-xs font-semibold text-gray-800 truncate flex-1">{r.firm.name}</span>
                <FundingStatusBadge status={r.status} />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                <FirmProductCount
                  firmId={r.firm_id}
                  productsByFirm={productsByFirm}
                  onProductClick={onProductClick}
                />
                <span className="text-emerald-700 font-medium">{r.funded} funded</span>
                {r.terminated > 0 && <span className="text-red-600 font-medium">{r.terminated} terminated</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}