import React, { useMemo } from "react";
import { DollarSign, TrendingUp, Package, Users, Award, BarChart3 } from "lucide-react";
import { toNumber, fmtCurrency, getLatestAum, calcGrowthPct, getFirmProducts } from "./firmPerfUtils";

export default function FirmPerfKpiCards({ firms = [], products = [], contacts = [] }) {
  const stats = useMemo(() => {
    if (!firms.length) return null;
    let totalAum = 0;
    let totalNetFlow = 0;
    let totalProducts = 0;
    let totalContacts = 0;
    let bestGrowth = { pct: -Infinity, firm: null };

    for (const firm of firms) {
      const latest = getLatestAum(firm);
      totalAum += toNumber(latest.aum);
      totalNetFlow += toNumber(latest.netFlow);
      totalProducts += getFirmProducts(firm, products).length;
      totalContacts += contacts.filter((c) => (c.firm_ids || []).includes(firm.id) && !c.deleted_at).length;
      const growth = calcGrowthPct(firm);
      if (growth !== null && growth > bestGrowth.pct) {
        bestGrowth = { pct: growth, firm };
      }
    }

    return {
      totalAum,
      avgAum: totalAum / firms.length,
      totalNetFlow,
      totalProducts,
      totalContacts,
      bestGrowth: bestGrowth.firm ? bestGrowth : null,
    };
  }, [firms, products, contacts]);

  if (!stats) return null;

  const cards = [
    { label: "Combined AUM", value: fmtCurrency(stats.totalAum), icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
    { label: "Average AUM / Firm", value: fmtCurrency(stats.avgAum), icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
    { label: "Total Net Flow", value: fmtCurrency(stats.totalNetFlow), icon: TrendingUp, color: stats.totalNetFlow >= 0 ? "text-emerald-600" : "text-rose-600", bg: stats.totalNetFlow >= 0 ? "bg-emerald-50" : "bg-rose-50", border: stats.totalNetFlow >= 0 ? "border-emerald-200" : "border-rose-200" },
    { label: "Total Products", value: stats.totalProducts, icon: Package, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
    { label: "Total Contacts", value: stats.totalContacts, icon: Users, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" },
    { label: "Top Grower", value: stats.bestGrowth ? `${stats.bestGrowth.firm.name.slice(0, 18)}${stats.bestGrowth.firm.name.length > 18 ? "…" : ""}` : "—", sub: stats.bestGrowth ? `${stats.bestGrowth.pct >= 0 ? "+" : ""}${stats.bestGrowth.pct.toFixed(1)}%` : "", icon: Award, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border ${c.border} ${c.bg} p-3`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{c.label}</span>
          </div>
          <p className="text-lg font-bold text-gray-800 leading-tight truncate">{c.value}</p>
          {c.sub && <p className={`text-xs font-semibold ${c.color} mt-0.5`}>{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}