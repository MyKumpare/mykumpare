import React, { useMemo } from "react";
import {
  ExternalLink,
  Building,
  Calendar,
  MapPin,
  Globe,
  DollarSign,
  Package,
  TrendingUp,
  Activity,
  ShieldCheck,
} from "lucide-react";

export const FIRM_COLORS = [
  "#4f46e5",
  "#059669",
  "#d97706",
  "#e11d48",
  "#0891b2",
  "#7c3aed",
];

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtCurrency(n) {
  if (n === null || n === undefined) return "—";
  const v = Math.round(toNumber(n));
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return v ? `$${v.toLocaleString()}` : "—";
}

function getLatestAum(firm) {
  const hist = firm?.aum_history || [];
  if (!hist.length) return { aum: null, netFlow: null, date: null };
  const latest = [...hist].sort((a, b) =>
    (b.month_end_date || "").localeCompare(a.month_end_date || "")
  )[0];
  return {
    aum: latest.firm_aum,
    netFlow: latest.net_asset_flows,
    date: latest.month_end_date,
  };
}

/**
 * Side-by-side key metrics table for multiple firms.
 * Each row is a metric; each column is a firm. Best numeric values are highlighted.
 */
export default function FirmMetricsTable({ firms = [], products = [], dueDiligences = [] }) {
  const metrics = useMemo(() => {
    return firms.map((firm) => {
      const latest = getLatestAum(firm);
      const firmProducts = products.filter(
        (p) => p.firm_id === firm.id && !p.deleted_at
      );
      const types = firm.firm_types?.length
        ? firm.firm_types
        : firm.firm_type
        ? [firm.firm_type]
        : [];
      return {
        firm,
        types: types.join(", ") || "—",
        yearFounded: firm.year_founded || "—",
        region: firm.geographic_region || "Undefined",
        location: firm.location || "—",
        website: firm.website || "",
        aum: latest.aum,
        netFlow: latest.netFlow,
        aumDate: latest.date,
        productCount: firmProducts.length,
        fundingStatus: firm.funding_status || "—",
        aumDataPoints: (firm.aum_history || []).length,
        ddStatus: (() => {
          const firmDds = dueDiligences.filter((d) => d.firm_id === firm.id);
          if (!firmDds.length) return "—";
          const latest = firmDds[0];
          return firmDds.length === 1
            ? latest.status || "—"
            : `${firmDds.length} · ${latest.status || "—"}`;
        })(),
      };
    });
  }, [firms, products, dueDiligences]);

  const rows = [
    { label: "Firm Type", icon: Building, key: "types" },
    { label: "Year Founded", icon: Calendar, key: "yearFounded" },
    { label: "Geographic Region", icon: MapPin, key: "region" },
    { label: "Location", icon: MapPin, key: "location" },
    { label: "Website", icon: Globe, key: "website", isLink: true },
    {
      label: "Total AUM (latest)",
      icon: DollarSign,
      key: "aum",
      format: fmtCurrency,
      highlight: "max",
    },
    {
      label: "Latest Net Flow",
      icon: TrendingUp,
      key: "netFlow",
      format: fmtCurrency,
      highlight: "max",
    },
    {
      label: "Products",
      icon: Package,
      key: "productCount",
      highlight: "max",
    },
    { label: "Funding Status", icon: Activity, key: "fundingStatus" },
    { label: "Due Diligence Status", icon: ShieldCheck, key: "ddStatus" },
    {
      label: "AUM Data Points",
      icon: TrendingUp,
      key: "aumDataPoints",
      highlight: "max",
    },
  ];

  const bestValues = useMemo(() => {
    const bv = {};
    for (const row of rows) {
      if (!row.highlight) continue;
      const vals = metrics.map((m) => toNumber(m[row.key]));
      const max = Math.max(...vals);
      bv[row.key] = max;
    }
    return bv;
  }, [metrics]);

  if (firms.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 min-w-[160px]">
                Metric
              </th>
              {metrics.map((m, i) => (
                <th key={m.firm.id} className="text-left px-4 py-3 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: FIRM_COLORS[i % FIRM_COLORS.length],
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {m.firm.name}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {m.region}
                      </p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={row.label}
                className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
              >
                <td className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide sticky left-0 z-10 bg-inherit">
                  <div className="flex items-center gap-1.5">
                    <row.icon className="w-3.5 h-3.5 text-gray-400" />
                    {row.label}
                  </div>
                </td>
                {metrics.map((m) => {
                  const rawValue = m[row.key];
                  const value = row.format ? row.format(rawValue) : rawValue || "—";
                  const isBest =
                    row.highlight === "max" &&
                    bestValues[row.key] > 0 &&
                    toNumber(rawValue) === bestValues[row.key];
                  return (
                    <td
                      key={m.firm.id}
                      className="px-4 py-2.5 text-sm text-gray-700"
                    >
                      {row.isLink && rawValue ? (
                        <a
                          href={rawValue}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 truncate"
                        >
                          <span className="truncate">
                            {rawValue.replace(/^https?:\/\//, "")}
                          </span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span
                          className={
                            isBest ? "font-semibold text-emerald-700" : ""
                          }
                        >
                          {value}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}