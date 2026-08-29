import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from "recharts";
import { Wallet, PieChart as PieIcon, X, Building2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

const FUNDING_COLORS = {
  Funded: "#10b981",
  Terminated: "#ef4444",
  Unset: "#94a3b8",
};

function formatCompactCurrency(n) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function getLatestAum(record) {
  const history = record.aum_history || [];
  if (!history.length) return 0;
  const latest = [...history].sort(
    (a, b) => (b.month_end_date || "").localeCompare(a.month_end_date || "")
  )[0];
  return Number(latest?.firm_aum) || 0;
}

/**
 * Interactive funding breakdown: a bar chart of total market value by funding
 * status and a pie chart of firm counts by funding status. Clicking any bar
 * or slice opens a dialog listing the underlying firms.
 *
 * Props:
 *   firms - array of scoped firm records
 */
export default function FundingBreakdownCharts({ firms = [] }) {
  const [activeSegment, setActiveSegment] = useState(null); // { status, firms }

  const { marketValueData, countData } = useMemo(() => {
    const buckets = { Funded: { value: 0, count: 0, firms: [] }, Terminated: { value: 0, count: 0, firms: [] }, Unset: { value: 0, count: 0, firms: [] } };
    for (const f of firms) {
      const aum = getLatestAum(f);
      const status = f.funding_status || "Unset";
      buckets[status].value += aum;
      buckets[status].count += 1;
      buckets[status].firms.push(f);
    }
    const marketValueData = Object.entries(buckets)
      .filter(([, b]) => b.value > 0)
      .map(([name, b]) => ({ name, value: b.value, firms: b.firms }));
    const countData = Object.entries(buckets)
      .filter(([, b]) => b.count > 0)
      .map(([name, b]) => ({ name, value: b.count, firms: b.firms }));
    return { marketValueData, countData };
  }, [firms]);

  const handleBarClick = (seg) => {
    if (seg) setActiveSegment({ status: seg.name, firms: seg.firms, metric: "market value" });
  };

  const handleSliceClick = (seg) => {
    if (seg) setActiveSegment({ status: seg.name, firms: seg.firms, metric: "count" });
  };

  const totalMarketValue = marketValueData.reduce((s, d) => s + d.value, 0);
  const totalCount = countData.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Total Market Value by Funding Status — Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Market Value by Funding Status</h2>
              <p className="text-xs text-gray-400">Total: {formatCompactCurrency(totalMarketValue)} · click a bar to see firms</p>
            </div>
          </div>
          <div className="mt-3">
            {marketValueData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No market value data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={marketValueData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCompactCurrency(v)}
                  />
                  <Tooltip
                    formatter={(v) => formatCompactCurrency(v)}
                    cursor={{ fill: "#f9fafb", cursor: "pointer" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60} cursor="pointer">
                    {marketValueData.map((d) => (
                      <Cell key={d.name} fill={FUNDING_COLORS[d.name] || "#6366f1"} onClick={() => handleBarClick(d)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Firm Count by Funding Status — Pie */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <PieIcon className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Funding Count by Status</h2>
              <p className="text-xs text-gray-400">Total: {totalCount} firm{totalCount !== 1 ? "s" : ""} · click a slice to see firms</p>
            </div>
          </div>
          <div className="mt-3">
            {countData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No funding data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={countData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                    cursor="pointer"
                  >
                    {countData.map((d) => (
                      <Cell key={d.name} fill={FUNDING_COLORS[d.name] || "#6366f1"} onClick={() => handleSliceClick(d)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => `${v} firm${v !== 1 ? "s" : ""}`}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Drill-down dialog */}
      {activeSegment && (
        <FundingDetailDialog
          status={activeSegment.status}
          firms={activeSegment.firms}
          metric={activeSegment.metric}
          onClose={() => setActiveSegment(null)}
        />
      )}
    </>
  );
}

function FundingDetailDialog({ status, firms, metric, onClose }) {
  const sorted = [...firms].sort((a, b) => getLatestAum(b) - getLatestAum(a));
  const totalValue = sorted.reduce((s, f) => s + getLatestAum(f), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: FUNDING_COLORS[status] || "#6366f1" }}
            />
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {status === "Unset" ? "No funding status" : status} — {firms.length} firm{firms.length !== 1 ? "s" : ""}
              </h3>
              <p className="text-xs text-gray-400">
                {metric === "market value"
                  ? `Total market value: ${formatCompactCurrency(totalValue)}`
                  : `Click a firm to open its profile`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-md p-1 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-2 py-2 flex-1">
          {sorted.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No firms in this group</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {sorted.map((f) => {
                const aum = getLatestAum(f);
                const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
                return (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {f.logo_url ? (
                        <img src={f.logo_url} alt={f.name} className="w-full h-full object-contain p-0.5" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <Building2 className="w-4 h-4 text-indigo-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {types.join(", ") || "Uncategorized"}
                        {f.location ? ` · ${f.location}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {aum > 0 ? formatCompactCurrency(aum) : "—"}
                      </p>
                    </div>
                    <Link
                      to="/"
                      onClick={onClose}
                      className="text-indigo-500 hover:text-indigo-700 p-1 rounded-md hover:bg-indigo-50 flex-shrink-0"
                      title="Open firm"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}