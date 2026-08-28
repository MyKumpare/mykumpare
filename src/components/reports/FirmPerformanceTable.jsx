import React, { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

const formatCurrency = (v) => {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
};

const FUNDING_BADGE = {
  Funded: "bg-green-100 text-green-700 border-green-200",
  Terminated: "bg-red-100 text-red-700 border-red-200",
};

const TYPE_BADGE = "bg-indigo-50 text-indigo-700 border-indigo-200";

const COLUMNS = [
  { key: "name", label: "Firm", sortable: true, align: "left" },
  { key: "types", label: "Type", sortable: false, align: "left" },
  { key: "aum", label: "Latest AUM", sortable: true, align: "right" },
  { key: "productCount", label: "Products", sortable: true, align: "right" },
  { key: "contactCount", label: "Contacts", sortable: true, align: "right" },
  { key: "score", label: "Rating", sortable: true, align: "center" },
  { key: "fundingStatus", label: "Funding", sortable: true, align: "center" },
];

export default function FirmPerformanceTable({ firms }) {
  const [sortKey, setSortKey] = useState("aum");
  const [sortDir, setSortDir] = useState("desc");

  const sorted = useMemo(() => {
    const arr = [...firms];
    arr.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "types") {
        av = (av || []).join(", ");
        bv = (bv || []).join(", ");
      }
      if (sortKey === "aum") {
        av = av || 0;
        bv = bv || 0;
      }
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av == null || av === "") return 1;
      if (bv == null || bv === "") return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [firms, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-gray-200 rounded-lg">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50 z-10">
          <tr className="border-b border-gray-200">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-medium text-gray-600 whitespace-nowrap ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                } ${col.sortable ? "cursor-pointer hover:bg-gray-100 select-none" : ""}`}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                  {col.sortable && sortKey !== col.key && (
                    <ArrowUpDown className="w-3 h-3 text-gray-300" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((f) => (
            <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50/50">
              <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[200px]" title={f.name}>
                {f.name}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {(f.types || []).slice(0, 2).map((t) => (
                    <span key={t} className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${TYPE_BADGE}`}>
                      {t.length > 15 ? t.substring(0, 13) + "…" : t}
                    </span>
                  ))}
                  {(f.types || []).length === 0 && <span className="text-gray-300">—</span>}
                </div>
              </td>
              <td className="px-3 py-2 text-right font-medium text-gray-700">
                {f.aum != null ? formatCurrency(f.aum) : "—"}
              </td>
              <td className="px-3 py-2 text-right text-gray-600">{f.productCount || "—"}</td>
              <td className="px-3 py-2 text-right text-gray-600">{f.contactCount || "—"}</td>
              <td className="px-3 py-2 text-center">
                {f.score ? (
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                    {f.score}
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-center">
                {f.fundingStatus ? (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${FUNDING_BADGE[f.fundingStatus] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {f.fundingStatus}
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-gray-400">
                No firms to display
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}