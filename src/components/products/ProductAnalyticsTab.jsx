import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, BarChart2, Activity, Calendar } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function geometricCompound(returns) {
  return returns.reduce((acc, r) => acc * (1 + r / 100), 1) - 1;
}

function annualize(totalReturn, months) {
  if (months <= 0) return null;
  const years = months / 12;
  return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;
}

function stdDev(returns) {
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  return Math.sqrt(variance);
}

function maxDrawdown(returns) {
  let peak = 1, value = 1, maxDD = 0;
  for (const r of returns) {
    value *= 1 + r / 100;
    if (value > peak) peak = value;
    const dd = (peak - value) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return -maxDD * 100;
}

function formatPct(val, decimals = 2) {
  if (val == null || isNaN(val)) return "—";
  return (val >= 0 ? "+" : "") + val.toFixed(decimals) + "%";
}

function buildCumulativeData(monthly) {
  let cumulative = 1;
  return monthly.map((m) => {
    cumulative *= 1 + m.return_value / 100;
    return {
      date: m.date?.slice(0, 7) ?? "",
      cumulative: parseFloat(((cumulative - 1) * 100).toFixed(2)),
      monthly: parseFloat(m.return_value.toFixed(2)),
    };
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, positive, icon: Icon }) {
  const color =
    positive === true ? "text-emerald-600" :
    positive === false ? "text-red-500" :
    "text-gray-800";
  return (
    <div className="bg-white border rounded-lg p-3 flex flex-col gap-1 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <p className={`text-base font-semibold ${color}`}>{value}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value >= 0 ? "+" : ""}{p.value}%
        </p>
      ))}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function ProductAnalyticsTab({ productId }) {
  const { data: seriesList = [], isLoading } = useQuery({
    queryKey: ["return-series", productId],
    queryFn: () => base44.entities.ReturnSeries.filter({ product_id: productId }),
    enabled: !!productId,
  });

  // Pick first series with monthly returns
  const series = useMemo(() =>
    seriesList.find((s) => s.monthly_returns?.length > 0) ?? seriesList[0] ?? null,
    [seriesList]
  );

  const monthly = useMemo(() =>
    (series?.monthly_returns ?? [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date)),
    [series]
  );

  const returns = useMemo(() => monthly.map((m) => m.return_value), [monthly]);

  const stats = useMemo(() => {
    if (!returns.length) return null;
    const totalRaw = geometricCompound(returns);
    const annualRet = annualize(totalRaw, returns.length);
    const monthly_std = stdDev(returns);
    const annualVol = monthly_std != null ? monthly_std * Math.sqrt(12) : null;
    const sharpe = annualVol ? (annualRet / annualVol) : null;
    const dd = maxDrawdown(returns);
    const positive = returns.filter((r) => r > 0).length;
    const hitRate = (positive / returns.length) * 100;
    const ytd = (() => {
      const year = new Date().getFullYear();
      const ytdRets = returns.slice(
        monthly.findIndex((m) => m.date?.startsWith(String(year)))
      ).filter((_, i, arr) => i < arr.length);
      // recalculate from ytd months
      const ytdMonths = monthly.filter((m) => m.date?.startsWith(String(year)));
      return ytdMonths.length ? geometricCompound(ytdMonths.map((m) => m.return_value)) * 100 : null;
    })();
    return { totalRaw: totalRaw * 100, annualRet, annualVol, sharpe, dd, hitRate, ytd };
  }, [returns, monthly]);

  const chartData = useMemo(() => buildCumulativeData(monthly), [monthly]);

  // Trim X-axis labels
  const xTick = (tick) => tick?.slice(0, 7) ?? "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        Loading analytics...
      </div>
    );
  }

  if (!series || !monthly.length) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
        <BarChart2 className="w-8 h-8 opacity-40" />
        <p className="text-sm">No return data available yet.</p>
        <p className="text-xs">Upload returns in the Returns tab to see analytics.</p>
      </div>
    );
  }

  const seriesLabel = [
    series.composite_name,
    series.representative_portfolio_name,
    series.paper_portfolio_name,
    series.back_test_name,
  ].filter(Boolean).join(" / ") || (series.return_types ?? []).join(", ") || "Return Series";

  return (
    <div className="space-y-5 pb-2">
      {/* Series label */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Activity className="w-3.5 h-3.5" />
        <span className="font-medium text-gray-700">{seriesLabel}</span>
        <span>·</span>
        <Calendar className="w-3.5 h-3.5" />
        <span>{monthly[0]?.date?.slice(0, 7)} – {monthly[monthly.length - 1]?.date?.slice(0, 7)}</span>
        <span>·</span>
        <span>{monthly.length} months</span>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Ann. Return" value={formatPct(stats.annualRet)} positive={stats.annualRet > 0 ? true : stats.annualRet < 0 ? false : undefined} icon={TrendingUp} />
          <StatCard label="Ann. Volatility" value={formatPct(stats.annualVol)} icon={Activity} />
          <StatCard label="Sharpe Ratio" value={stats.sharpe != null ? stats.sharpe.toFixed(2) : "—"} positive={stats.sharpe > 1 ? true : stats.sharpe < 0 ? false : undefined} icon={BarChart2} />
          <StatCard label="Max Drawdown" value={formatPct(stats.dd)} positive={false} icon={TrendingDown} />
          <StatCard label="Total Return" value={formatPct(stats.totalRaw)} positive={stats.totalRaw > 0 ? true : stats.totalRaw < 0 ? false : undefined} icon={TrendingUp} />
          <StatCard label="YTD Return" value={stats.ytd != null ? formatPct(stats.ytd) : "—"} positive={stats.ytd > 0 ? true : stats.ytd < 0 ? false : undefined} icon={Calendar} />
          <StatCard label="Hit Rate" value={stats.hitRate.toFixed(1) + "%"} positive={stats.hitRate >= 50 ? true : false} icon={Activity} />
          <StatCard label="# Months" value={monthly.length} icon={Calendar} />
        </div>
      )}

      {/* Cumulative return chart */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cumulative Return (%)</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={xTick} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v + "%"} width={42} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#ccc" />
            <Line type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2} dot={false} name="Cumulative" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly bar chart */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly Returns (%)</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={xTick} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v + "%"} width={42} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#999" />
            <Bar
              dataKey="monthly"
              name="Monthly"
              fill="#6366f1"
              radius={[2, 2, 0, 0]}
              // color bars by sign
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}