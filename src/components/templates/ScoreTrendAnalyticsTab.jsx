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
  BarChart,
  Bar,
  Cell,
  LabelList
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Loader2,
  AlertCircle,
  Filter,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DateRangeFilter from "@/components/common/DateRangeFilter";
import { parseISO, isAfter, isBefore, startOfMonth, endOfMonth } from "date-fns";

const QUARTERS_BACK = 6; // last ~6 quarters

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

/** Map a date string (YYYY-MM-DD) to a quarter label like "Q1 2026". */
function dateToQuarter(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

/** Build ordered list of the last N quarter labels ending at the given date. */
function lastNQuarters(fromDate, n) {
  const d = new Date(fromDate);
  const quarters = [];
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(d.getFullYear(), d.getMonth() - i * 3, 1);
    const q = Math.floor(ref.getMonth() / 3) + 1;
    quarters.push(`Q${q} ${ref.getFullYear()}`);
  }
  return quarters;
}

export default function ScoreTrendAnalyticsTab({ onFirmClick }) {
  const [view, setView] = useState("trend"); // "trend" | "ranking"
  const [minScores, setMinScores] = useState(2); // min data points to include a firm
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const hasCustomRange = !!(dateRange.start || dateRange.end);

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoreTrendAnalytics", QUARTERS_BACK],
    queryFn: async () => {
      // Fetch finalized scoring records. We pull a generous window and filter client-side.
      const res = await base44.entities.ScoringMatrixScore.list("-scoring_end_date", 500);
      const records = (res || []).filter(
        (s) => s.status === "finalized" && (s.scoring_end_date || s.scoring_start_date)
      );
      return records;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filter records to the custom date range when set
  const filteredData = useMemo(() => {
    if (!hasCustomRange) return data || [];
    const fromD = dateRange.start ? startOfMonth(parseISO(dateRange.start)) : null;
    const toD = dateRange.end ? endOfMonth(parseISO(dateRange.end)) : null;
    return (data || []).filter((rec) => {
      const dStr = rec.scoring_end_date || rec.scoring_start_date;
      if (!dStr) return false;
      const d = parseISO(dStr);
      if (fromD && isBefore(d, fromD)) return false;
      if (toD && isAfter(d, toD)) return false;
      return true;
    });
  }, [data, dateRange, hasCustomRange]);

  // Build quarter labels: custom range derives from the filtered data's min/max;
  // default uses the last 6 quarters from today.
  const quarterLabels = useMemo(() => {
    if (!hasCustomRange) return lastNQuarters(new Date(), QUARTERS_BACK);
    if (!filteredData.length) return [];
    const dates = filteredData
      .map((r) => r.scoring_end_date || r.scoring_start_date)
      .filter(Boolean)
      .sort();
    if (!dates.length) return [];
    const startD = parseISO(dates[0]);
    const endD = parseISO(dates[dates.length - 1]);
    const labels = [];
    let y = startD.getFullYear();
    let q = Math.floor(startD.getMonth() / 3) + 1;
    const endY = endD.getFullYear();
    const endQ = Math.floor(endD.getMonth() / 3) + 1;
    while (y < endY || (y === endY && q <= endQ)) {
      labels.push(`Q${q} ${y}`);
      q += 1;
      if (q > 4) { q = 1; y += 1; }
    }
    return labels;
  }, [filteredData, hasCustomRange]);

  // Group records by firm → quarter → latest weighted final score
  const firmQuarterMap = useMemo(() => {
    const map = {}; // firm_id -> { name, quarters: { "Q1 2026": score }, recordCount }
    (filteredData || []).forEach((rec) => {
      const q = dateToQuarter(rec.scoring_end_date || rec.scoring_start_date);
      if (!q || !quarterLabels.includes(q)) return;
      const weighted = computeWeightedFinal(rec);
      if (weighted == null) return;
      const fid = rec.firm_id || rec.product_id;
      if (!fid) return;
      if (!map[fid]) {
        map[fid] = {
          firmId: fid,
          firmName: rec.firm_name || rec.product_name || "Unknown",
          quarters: {},
          recordCount: 0
        };
      }
      // Keep the most recent scoring_end_date per quarter (records are sorted desc)
      if (map[fid].quarters[q] == null) {
        map[fid].quarters[q] = weighted;
        map[fid].recordCount += 1;
      }
    });
    return map;
  }, [filteredData, quarterLabels]);

  // Build chart data: one row per quarter, one series per firm
  const trendData = useMemo(() => {
    return quarterLabels.map((q) => {
      const row = { quarter: q };
      Object.values(firmQuarterMap).forEach((f) => {
        if (f.quarters[q] != null) row[f.firmName] = f.quarters[q];
      });
      return row;
    });
  }, [quarterLabels, firmQuarterMap]);

  // Firm summary with trend direction
  const firmSummaries = useMemo(() => {
    return Object.values(firmQuarterMap)
      .map((f) => {
        const scores = quarterLabels
          .map((q) => f.quarters[q])
          .filter((s) => s != null);
        const dataPoints = scores.length;
        const first = scores[0];
        const last = scores[scores.length - 1];
        const delta = first != null && last != null ? Math.round((last - first) * 100) / 100 : null;
        // Linear regression slope to detect consistent improvement
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
        const avg = dataPoints ? Math.round((scores.reduce((a, b) => a + b, 0) / dataPoints) * 100) / 100 : null;
        // "Consistently improving": positive slope AND last >= first AND at least 2 data points
        const consistentlyImproving = dataPoints >= 2 && slope > 0.1 && (last ?? 0) >= (first ?? 0);
        const consistentlyDeclining = dataPoints >= 2 && slope < -0.1 && (last ?? 0) <= (first ?? 0);
        return {
          ...f,
          dataPoints,
          firstScore: first,
          lastScore: last,
          delta,
          slope: Math.round(slope * 100) / 100,
          avg,
          consistentlyImproving,
          consistentlyDeclining
        };
      })
      .filter((f) => f.dataPoints >= minScores)
      .sort((a, b) => (b.slope || 0) - (a.slope || 0));
  }, [firmQuarterMap, quarterLabels, minScores]);

  const improvingFirms = firmSummaries.filter((f) => f.consistentlyImproving);
  const decliningFirms = firmSummaries.filter((f) => f.consistentlyDeclining);
  const palette = [
    "#2563eb", "#16a34a", "#ea580c", "#9333ea", "#0891b2",
    "#db2777", "#65a30d", "#d97706", "#4f46e5", "#0d9488",
    "#dc2626", "#7c3aed", "#ca8a04", "#475569", "#be185d"
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
      {/* Header + controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-rose-600" />
          <h3 className="text-base font-semibold text-gray-800">Score Trend Analytics</h3>
          <span className="text-xs text-gray-500">
            ({firmSummaries.length} firms{hasCustomRange ? "" : ` · last ${QUARTERS_BACK} quarters`})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            label="Score trend period"
          />
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Filter className="w-3.5 h-3.5" />
            Min data points:
          </div>
          <select
            value={minScores}
            onChange={(e) => setMinScores(Number(e.target.value))}
            className="border border-gray-200 rounded-md text-xs px-2 py-1 bg-white"
          >
            <option value={1}>1+</option>
            <option value={2}>2+</option>
            <option value={3}>3+</option>
          </select>
          <div className="flex items-center gap-1 border border-gray-200 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setView("trend")}
              className={`px-2.5 py-1 rounded text-xs font-medium ${view === "trend" ? "bg-rose-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              Trend Lines
            </button>
            <button
              type="button"
              onClick={() => setView("ranking")}
              className={`px-2.5 py-1 rounded text-xs font-medium ${view === "ranking" ? "bg-rose-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              Firm Ranking
            </button>
          </div>
        </div>
      </div>

      {/* Highlight: consistently improving firms */}
      {improvingFirms.length > 0 && (
        <div className="border border-green-200 rounded-lg p-3 bg-green-50">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800">
              Consistently Improving Firms ({improvingFirms.length})
            </span>
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
                <span className="inline-flex items-center gap-0.5 text-green-700">
                  <ArrowUp className="w-3 h-3" />
                  {f.delta > 0 ? "+" : ""}{f.delta}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Highlight: consistently declining firms */}
      {decliningFirms.length > 0 && (
        <div className="border border-red-200 rounded-lg p-3 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <span className="text-sm font-semibold text-red-800">
              Consistently Declining Firms ({decliningFirms.length})
            </span>
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
                <span className="inline-flex items-center gap-0.5 text-red-700">
                  <ArrowDown className="w-3 h-3" />
                  {f.delta}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        {firmSummaries.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">
            {hasCustomRange
              ? "No finalized scoring records found in the selected date range."
              : `No finalized scoring records found in the last ${QUARTERS_BACK} quarters.`}
          </div>
        ) : view === "trend" ? (
          <div style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "#6b7280" }} />
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
        ) : (
          <div style={{ height: Math.max(280, firmSummaries.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={firmSummaries}
                layout="vertical"
                margin={{ top: 4, right: 48, bottom: 4, left: 4 }}
                barCategoryGap="15%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" domain={[-2, 2]} tick={{ fontSize: 10, fill: "#6b7280" }} />
                <YAxis type="category" dataKey="firmName" tick={{ fontSize: 10, fill: "#374151" }} width={150} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                  formatter={(value, name) => {
                    if (name === "slope") return [`${value} / quarter`, "Trend slope"];
                    return [value, name];
                  }}
                />
                <Bar dataKey="slope" name="slope" radius={[0, 3, 3, 0]}>
                  {firmSummaries.map((f, i) => (
                    <Cell
                      key={`s-${i}`}
                      fill={f.slope > 0.1 ? "#16a34a" : f.slope < -0.1 ? "#dc2626" : "#9ca3af"}
                    />
                  ))}
                  <LabelList
                    dataKey="slope"
                    position="right"
                    formatter={(v) => (v > 0 ? `+${v}` : `${v}`)}
                    style={{ fontSize: 10, fill: "#374151" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detail table */}
      {firmSummaries.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="text-left p-2 font-medium text-gray-600">Firm</th>
                <th className="text-center p-2 font-medium text-gray-600">Data Points</th>
                <th className="text-center p-2 font-medium text-gray-600">First Score</th>
                <th className="text-center p-2 font-medium text-gray-600">Latest Score</th>
                <th className="text-center p-2 font-medium text-gray-600">Avg</th>
                <th className="text-center p-2 font-medium text-gray-600">Δ (first→last)</th>
                <th className="text-center p-2 font-medium text-gray-600">Slope / qtr</th>
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
                  <td className="p-2 text-center text-gray-600">{f.avg ?? "—"}</td>
                  <td
                    className="p-2 text-center font-medium"
                    style={{ color: (f.delta ?? 0) > 0 ? "#15803d" : (f.delta ?? 0) < 0 ? "#b91c1c" : "#4b5563" }}
                  >
                    {f.delta != null ? `${f.delta > 0 ? "+" : ""}${f.delta}` : "—"}
                  </td>
                  <td
                    className="p-2 text-center"
                    style={{ color: f.slope > 0.1 ? "#15803d" : f.slope < -0.1 ? "#b91c1c" : "#4b5563" }}
                  >
                    {f.slope > 0 ? "+" : ""}{f.slope}
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