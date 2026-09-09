import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, TrendingUp, Building, Package, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value) {
  if (value == null || isNaN(value)) return "$0";
  return currencyFmt.format(value);
}

/**
 * Get the latest AUM value for a product from its aum_history array.
 */
function getLatestProductAum(product) {
  if (!product.aum_history || product.aum_history.length === 0) return 0;
  const sorted = [...product.aum_history].sort(
    (a, b) => new Date(b.month_end_date || 0) - new Date(a.month_end_date || 0)
  );
  return sorted[0]?.firm_aum || 0;
}

/**
 * Get the latest month-end date across a firm's products' aum_history.
 */
function getLatestAumDate(products) {
  let latest = null;
  for (const p of products) {
    if (!p.aum_history) continue;
    for (const entry of p.aum_history) {
      const d = entry.month_end_date;
      if (d && (!latest || d > latest)) latest = d;
    }
  }
  return latest;
}

export default function FirmAumSummarySection({ firms, products, onFirmClick, forceExpanded }) {
  const [expanded, setExpanded] = useState(false);
  const [sortField, setSortField] = useState("totalAum");
  const [sortDir, setSortDir] = useState("desc");

  React.useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  // Build firm → total product AUM mapping
  const firmAumData = useMemo(() => {
    const firmMap = new Map();
    for (const firm of firms) {
      firmMap.set(firm.id, {
        firm,
        productCount: 0,
        totalAum: 0,
        productsWithAum: 0,
      });
    }
    for (const product of products) {
      const entry = firmMap.get(product.firm_id);
      if (!entry) continue;
      entry.productCount++;
      const aum = getLatestProductAum(product);
      if (aum > 0) entry.productsWithAum++;
      entry.totalAum += aum;
    }
    return Array.from(firmMap.values()).filter((e) => e.productCount > 0 || e.totalAum > 0);
  }, [firms, products]);

  // Sort the data
  const sortedData = useMemo(() => {
    const sorted = [...firmAumData].sort((a, b) => {
      let cmp = 0;
      if (sortField === "totalAum") cmp = a.totalAum - b.totalAum;
      else if (sortField === "name") cmp = a.firm.name.localeCompare(b.firm.name);
      else if (sortField === "productCount") cmp = a.productCount - b.productCount;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [firmAumData, sortField, sortDir]);

  const grandTotal = useMemo(
    () => firmAumData.reduce((sum, e) => sum + e.totalAum, 0),
    [firmAumData]
  );
  const totalProducts = useMemo(
    () => firmAumData.reduce((sum, e) => sum + e.productCount, 0),
    [firmAumData]
  );
  const firmsWithAum = firmAumData.filter((e) => e.totalAum > 0).length;
  const latestDate = getLatestAumDate(products);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const SortHeader = ({ field, label, className = "" }) => (
    <button
      onClick={() => toggleSort(field)}
      className={`hover:text-foreground transition-colors cursor-pointer ${sortField === field ? "text-foreground" : "text-muted-foreground"} ${className}`}
    >
      {label}
      {sortField === field && (sortDir === "desc" ? " ↓" : " ↑")}
    </button>
  );

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 group"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          )}
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Firm AUM Summary
          </span>
          <span className="text-xs text-gray-400 font-normal">
            ({firmsWithAum} firms with AUM)
          </span>
        </button>
      </div>

      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100 space-y-3">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
                  Total Product AUM
                </span>
              </div>
              <p className="text-xl font-bold text-emerald-900">{formatCurrency(grandTotal)}</p>
              {latestDate && (
                <p className="text-xs text-emerald-600 mt-0.5">As of {latestDate}</p>
              )}
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Building className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                  Firms with AUM
                </span>
              </div>
              <p className="text-xl font-bold text-blue-900">{firmsWithAum}</p>
              <p className="text-xs text-blue-600 mt-0.5">out of {firmAumData.length} firms with products</p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-violet-600" />
                <span className="text-xs font-medium text-violet-700 uppercase tracking-wide">
                  Products Tracked
                </span>
              </div>
              <p className="text-xl font-bold text-violet-900">{totalProducts}</p>
              <p className="text-xs text-violet-600 mt-0.5">linked to firms</p>
            </div>
          </div>

          {/* Firm AUM table */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">
                      <SortHeader field="name" label="Firm Name" />
                    </th>
                    <th className="text-left px-3 py-2 font-medium">
                      <SortHeader field="productCount" label="Products" />
                    </th>
                    <th className="text-right px-3 py-2 font-medium">
                      <SortHeader field="totalAum" label="Total AUM" className="justify-end" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-gray-400 italic">
                        No firms with product AUM data yet.
                      </td>
                    </tr>
                  ) : (
                    sortedData.map((entry) => (
                      <tr
                        key={entry.firm.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-3 py-2">
                          <button
                            onClick={() => onFirmClick && onFirmClick(entry.firm)}
                            className="text-left font-medium text-gray-800 hover:text-primary hover:underline"
                          >
                            {entry.firm.name}
                          </button>
                          {entry.firm.firm_type && (
                            <span className="ml-2 text-xs text-gray-400">{entry.firm.firm_type}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {entry.productCount}
                          {entry.productsWithAum < entry.productCount && (
                            <span className="text-xs text-gray-400 ml-1">
                              ({entry.productsWithAum} with AUM)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                          {formatCurrency(entry.totalAum)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {sortedData.length > 0 && (
                  <tfoot className="bg-muted/30 border-t-2 border-gray-200">
                    <tr>
                      <td className="px-3 py-2 font-bold text-gray-800">Grand Total</td>
                      <td className="px-3 py-2 font-bold text-gray-800">{totalProducts}</td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-800">
                        {formatCurrency(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {sortedData.length > 20 && (
            <p className="text-xs text-gray-400 text-center">
              Showing all {sortedData.length} firms with linked products. Click a column header to sort.
            </p>
          )}
        </div>
      )}
    </div>
  );
}