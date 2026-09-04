import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ChevronDown, ChevronRight, Building2, Package, Briefcase, ClipboardList, User } from "lucide-react";

// Aggregates every primary/secondary assignment an analyst holds across firms,
// products, portfolios, and due diligence records into a single per-analyst
// breakdown so management can see total coverage burden at a glance.
export default function CoverageBurdenSummary({ analystBurden = [] }) {
  const [expanded, setExpanded] = useState(null); // analyst id expanded for detail
  const [sortKey, setSortKey] = useState("total");

  const sorted = useMemo(() => {
    const arr = [...analystBurden];
    arr.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
    return arr;
  }, [analystBurden, sortKey]);

  const totals = useMemo(() => {
    if (!analystBurden.length) return null;
    return analystBurden.reduce(
      (acc, a) => ({
        firmsPrimary: acc.firmsPrimary + a.firmsPrimary,
        firmsSecondary: acc.firmsSecondary + a.firmsSecondary,
        productsPrimary: acc.productsPrimary + a.productsPrimary,
        productsSecondary: acc.productsSecondary + a.productsSecondary,
        portfoliosPrimary: acc.portfoliosPrimary + a.portfoliosPrimary,
        portfoliosSecondary: acc.portfoliosSecondary + a.portfoliosSecondary,
        ddPrimary: acc.ddPrimary + a.ddPrimary,
        ddSecondary: acc.ddSecondary + a.ddSecondary,
        total: acc.total + a.total,
      }),
      { firmsPrimary: 0, firmsSecondary: 0, productsPrimary: 0, productsSecondary: 0, portfoliosPrimary: 0, portfoliosSecondary: 0, ddPrimary: 0, ddSecondary: 0, total: 0 }
    );
  }, [analystBurden]);

  const maxTotal = useMemo(() => Math.max(1, ...analystBurden.map((a) => a.total)), [analystBurden]);

  if (!analystBurden.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" /> Coverage Burden Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-400 italic py-6 text-center">No analyst assignments to aggregate.</p>
        </CardContent>
      </Card>
    );
  }

  const columns = [
    { key: "firmsPrimary", label: "Firms (P)", icon: Building2, color: "text-blue-600" },
    { key: "firmsSecondary", label: "Firms (S)", icon: Building2, color: "text-violet-600" },
    { key: "productsPrimary", label: "Products (P)", icon: Package, color: "text-blue-600" },
    { key: "productsSecondary", label: "Products (S)", icon: Package, color: "text-violet-600" },
    { key: "portfoliosPrimary", label: "Portfolios (P)", icon: Briefcase, color: "text-blue-600" },
    { key: "portfoliosSecondary", label: "Portfolios (S)", icon: Briefcase, color: "text-violet-600" },
    { key: "ddPrimary", label: "DD (P)", icon: ClipboardList, color: "text-blue-600" },
    { key: "ddSecondary", label: "DD (S)", icon: ClipboardList, color: "text-violet-600" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" /> Coverage Burden Summary
          <span className="text-xs text-gray-400 font-normal">
            (all primary + secondary assignments across firms, products, portfolios & due diligence)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Per-analyst breakdown table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3 font-medium cursor-pointer select-none" onClick={() => setSortKey("name")}>
                  Analyst
                </th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`py-2 px-1.5 font-medium cursor-pointer select-none text-center ${sortKey === c.key ? "text-indigo-600" : ""}`}
                    onClick={() => setSortKey(c.key)}
                    title={`Sort by ${c.label}`}
                  >
                    {c.label}
                  </th>
                ))}
                <th
                  className={`py-2 pl-1.5 font-medium cursor-pointer select-none text-center ${sortKey === "total" ? "text-indigo-600" : ""}`}
                  onClick={() => setSortKey("total")}
                >
                  Total
                </th>
              </tr>
            </thead>
            {sorted.map((a) => {
              const isOpen = expanded === a.id;
              const pct = (a.total / maxTotal) * 100;
              return (
                <tbody key={a.id} className="align-top">
                  <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : a.id)}
                          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                          title={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        {a.contact?.photo_url ? (
                          <img src={a.contact.photo_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-3 h-3 text-indigo-400" />
                          </div>
                        )}
                        <span className="font-medium text-gray-800 truncate max-w-[160px]" title={a.name}>{a.name}</span>
                      </div>
                    </td>
                    {columns.map((c) => {
                      const v = a[c.key] || 0;
                      return (
                        <td key={c.key} className="py-2 px-1.5 text-center">
                          {v > 0 ? <span className={`text-xs font-medium ${c.color}`}>{v}</span> : <span className="text-gray-300">—</span>}
                        </td>
                      );
                    })}
                    <td className="py-2 pl-1.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-16 h-4 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] flex-shrink-0">{a.total}</Badge>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50/60">
                      <td colSpan={columns.length + 2} className="py-2.5 px-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <BurdenDetail icon={Building2} label="Firms" primary={a.firmsPrimary} secondary={a.firmsSecondary} ids={[...a.firms.primary, ...a.firms.secondary]} />
                          <BurdenDetail icon={Package} label="Products" primary={a.productsPrimary} secondary={a.productsSecondary} ids={[...a.products.primary, ...a.products.secondary]} />
                          <BurdenDetail icon={Briefcase} label="Portfolios" primary={a.portfoliosPrimary} secondary={a.portfoliosSecondary} ids={[...a.portfolios.primary, ...a.portfolios.secondary]} />
                          <BurdenDetail icon={ClipboardList} label="Due Diligence" primary={a.ddPrimary} secondary={a.ddSecondary} ids={[...a.dueDiligence.primary, ...a.dueDiligence.secondary]} />
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
            {totals && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 text-xs font-semibold text-gray-700">
                  <td className="py-2 pr-3">Totals</td>
                  {columns.map((c) => (
                    <td key={c.key} className="py-2 px-1.5 text-center">{totals[c.key]}</td>
                  ))}
                  <td className="py-2 pl-1.5 text-center">
                    <Badge className="bg-indigo-600 text-white text-[10px]">{totals.total}</Badge>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function BurdenDetail({ icon: Icon, label, primary, secondary, ids }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-gray-700 font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-blue-600">{primary} primary</span>
        <span className="text-gray-300">·</span>
        <span className="text-violet-600">{secondary} secondary</span>
      </div>
      <p className="text-[10px] text-gray-400 mt-0.5">{ids.length} unique record{ids.length === 1 ? "" : "s"}</p>
    </div>
  );
}