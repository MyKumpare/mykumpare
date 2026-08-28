import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MONTHS_BACK = 6;

/** Compute the weighted final score for a single ScoringMatrixScore record. */
function computeWeightedFinal(score) {
  const blocks = score.scoring_blocks || [];
  let totalWeight = 0;
  let weightedSum = 0;
  blocks.forEach((block) => {
    const w = block.weight || 0;
    const crits = block.criteria || [];
    const scored = crits.filter((c) => c.final_score != null);
    if (!scored.length) return;
    const blockAvg = scored.reduce((s, c) => s + c.final_score, 0) / scored.length;
    weightedSum += blockAvg * w;
    totalWeight += w;
  });
  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });

/** Build ordered list of the last N month labels (e.g. "Apr 26") ending at the given date. */
function lastNMonths(fromDate, n) {
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(fromDate.getFullYear(), fromDate.getMonth() - i, 1);
    months.push(MONTH_FMT.format(ref));
  }
  return months;
}

/** Map a date string (YYYY-MM-DD) to a month label matching lastNMonths output. */
function dateToMonthLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return MONTH_FMT.format(d);
}

export default function FirmScoreTrend6mo({ onFirmClick }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["firmScoreTrend6mo", MONTHS_BACK],
    queryFn: async () => {
      const res = await base44.entities.ScoringMatrixScore.list("-scoring_end_date", 500);
      return (res || []).filter(
        (s) => s.status === "finalized" && (s.scoring_end_date || s.scoring_start_date)
      );
    },
    staleTime: 5 * 60 * 1000,
  });

  const monthLabels = useMemo(() => lastNMonths(new Date(), MONTHS_BACK), []);

  // Group records by firm → month → latest weighted final score
  const firmMonthMap = useMemo(() => {
    const map = {};
    (data || []).forEach((rec) => {
      const m = dateToMonthLabel(rec.scoring_end_date || rec.scoring_start_date);
      if (!m || !monthLabels.includes(m)) return;
      const weighted = computeWeightedFinal(rec);
      if (weighted == null) return;
      const fid = rec.firm_id || rec.product_id;
      if (!fid) return;
      if (!map[fid]) {
        map[fid] = { firmId: fid, firmName: rec.firm_name || rec.product_name || "Unknown", months: {} };
      }
      // records are sorted desc by scoring_end_date, so first seen per month is the latest
      if (map[fid].months[m] == null) {
        map[fid].months[m] = weighted;
      }
    });
    return map;
  }, [data, monthLabels]);

  // Chart data: one row per month, one series per firm
  const trendData = useMemo(() => {
    return monthLabels.map((m) => {
      const row = { month: m };
      Object.values(firmMonthMap).forEach((f) => {
        if (f.months[m] != null) row[f.firmName] = f.months[m];
      });
      return row;
    });
  }, [monthLabels, firmMonthMap]);

  // Per-firm trend summary (improving / declining / stable)
  const firmSummaries = useMemo(() => {
    return Object.values(firmMonthMap)
      .map((f) => {
        const scores = monthLabels.map((m) => f.months[m]).filter((s) => s != null);
        const dataPoints = scores.length;
        const first = scores[0];
        const last = scores[scores.length - 1];
        const delta = first != null && last != null ? Math.round((last - first) * 100) / 100 : null;
        let slope = 0;
        if (dataPoints >= 2) {
          const n = dataPoints;
          const xs = scores.map((_, i) => i);
          const sumX = xs.reduce((a, b) => a + b, 0);
          const sumY = scores.reduce((a, b) => a + b, 0);
          const sumXY = xs.reduce((a, x, i) => a + x * scores[i], 0);
          const sumXX = xs.reduce((a, x) => a + x * x, 0);
          const denom = n * sumXX - sumX * sumX;
          if (denom !== 0) slope = (n * sumXY - sumX * sumY) / denom;
        }
        const consistentlyImproving = dataPoints >= 2 && slope > 0.05 && (last ?? 0) >= (first ?? 0);
        const consistentlyDeclining = dataPoints >= 2 && slope < -0.05 && (last ?? 0) <= (first ?? 0);
        return {
          ...f,
          dataPoints,
          firstScore: first,
          lastScore: last,
          delta,
          slope: Math.round(slope * 100) / 100,
          consistentlyImproving,
          consistentlyDeclining,
        };
      })
      .filter((f) => f.dataPoints >= 1)
      .sort((a, b) => (b.slope || 0) - (a.slope || 0));
  }, [firmMonthMap, monthLabels]);

  const improvingFirms = firmSummaries.filter((f) => f.consistentlyImproving);
  const decliningFirms = firmSummaries.filter((f) => f.consistentlyDeclining);
  const palette = [
    "#2563eb", "#16a34a", "#ea580c", "#9333ea", "#0891b2",
    "#db2777", "#65a30d", "#d97706", "#4f46e5", "#0d9488",
    "#dc2626", "#7c3aed", "#ca8a04", "#475569", "#be185d",
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading score trends…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-600">
        <AlertCircle className="w-5 h-5 mr-2" /> Failed to load score trends.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-rose-600" />
        <h3 className="text-base font-semibold text-gray-800">Firm Score Trends — Last 6 Months</h3>
        <span className="text-xs text-gray-500">({firmSummaries.length} firms)</span>
      </div>

      {improvingFirms.length > 0 && (
        <div className="border border-green-200 rounded-lg p-3 bg-green-50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800">Improving ({improvingFirms.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {improvingFirms.map((f) => (
              <button
                key={f.firmId}
                type="button"
                onClick={() => onFirmClick?.(f.firmId)}
                className="inline-flex items-center gap-1.5 bg-white border border-green-300 rounded-full px-3 py-1 text-xs font-medium text-green-800 hover:bg-green-100 transition-colors"
              >
                {f.firmName}
                <span className="text-green-700">{f.delta > 0 ? "+" : ""}{f.delta}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {decliningFirms.length > 0 && (
        <div className="border border-red-200 rounded-lg p-3 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <span className="text-sm font-semibold text-red-800">Declining ({decliningFirms.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {decliningFirms.map((f) => (
              <button
                key={f.firmId}
                type="button"
                onClick={() => onFirmClick?.(f.firmId)}
                className="inline-flex items-center gap-1.5 bg-white border border-red-300 rounded-full px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-100 transition-colors"
              >
                {f.firmName}
                <span className="text-red-700">{f.delta}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        {firmSummaries.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">
            No finalized scoring records found in the last {MONTHS_BACK} months.
          </div>
        ) : (
          <div style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                  formatter={(value, name) => (value == null ? ["—", name] : [value, name])}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {firmSummaries.map((f, i) => (
                  <Line
                    key={f.firmId}
                    type="monotone"
                    dataKey={f.firmName}
                    stroke={palette[i % palette.length]}
                    strokeWidth={f.consistentlyImproving ? 3 : f.consistentlyDeclining ? 2.5 : 1.5}
                    strokeDasharray={f.consistentlyDeclining ? "5 3" : undefined}
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {firmSummaries.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="text-left p-2 font-medium text-gray-600">Firm</th>
                <th className="text-center p-2 font-medium text-gray-600">Data Points</th>
                <th className="text-center p-2 font-medium text-gray-600">First</th>
                <th className="text-center p-2 font-medium text-gray-600">Latest</th>
                <th className="text-center p-2 font-medium text-gray-600">Δ</th>
                <th className="text-center p-2 font-medium text-gray-600">Trend</th>
              </tr>
            </thead>
            <tbody>
              {firmSummaries.map((f) => (
                <tr
                  key={f.firmId}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => onFirmClick?.(f.firmId)}
                >
                  <td className="p-2 font-medium text-gray-800">{f.firmName}</td>
                  <td className="p-2 text-center text-gray-500">{f.dataPoints}</td>
                  <td className="p-2 text-center">{f.firstScore ?? "—"}</td>
                  <td className="p-2 text-center font-semibold">{f.lastScore ?? "—"}</td>
                  <td
                    className="p-2 text-center font-medium"
                    style={{ color: (f.delta ?? 0) > 0 ? "#15803d" : (f.delta ?? 0) < 0 ? "#b91c1c" : "#4b5563" }}
                  >
                    {f.delta != null ? `${f.delta > 0 ? "+" : ""}${f.delta}` : "—"}
                  </td>
                  <td className="p-2 text-center">
                    {f.consistentlyImproving ? (
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-[10px]">
                        <TrendingUp className="w-3 h-3 mr-0.5" /> Improving
                      </Badge>
                    ) : f.consistentlyDeclining ? (
                      <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-[10px]">
                        <TrendingDown className="w-3 h-3 mr-0.5" /> Declining
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500 border-gray-300 bg-gray-50 text-[10px]">
                        <Minus className="w-3 h-3 mr-0.5" /> Stable
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}