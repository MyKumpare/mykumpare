import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Legend
} from "recharts";
import { TrendingUp, Minus } from "lucide-react";
import { computeWeightedScoreMulti } from "@/components/templates/scoringWeightLogic";

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return (Math.round(n * 100) / 100).toString();
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Trend chart tracking how a product's weighted score has changed across
 * scoring cycles (versions), plotted against the peer group's High/Low band
 * and Mean/Median benchmark lines.
 *
 * Shows progress or decline of the product relative to its peer group over
 * time. Uses the same weighted-score logic as the scorecard so values match.
 */
export default function ScoringPeerTrendChart({ score, peerScores = [], representativeScores = [], phase }) {
  // All scoring versions for the current product on this template
  const productVersions = useMemo(() => {
    const versions = (peerScores || [])
      .filter((s) => s.product_id === score.product_id)
      .slice()
      .sort((a, b) => (a.version_number || 1) - (b.version_number || 1));
    return versions.map((s) => {
      const blocks = s.scoring_blocks || [];
      const val = computeWeightedScoreMulti(blocks, phase.key, {
        applyBonusPenalty: phase.key === "final_score",
        mode: "perCriterion",
        getValue: phase.getValue,
      });
      const date = s.scoring_end_date || s.scoring_start_date || s.created_date;
      return {
        label: `v${s.version_number || 1}`,
        version: s.version_number || 1,
        score: val,
        status: s.status,
        date,
        scoring_start_date: s.scoring_start_date,
        scoring_end_date: s.scoring_end_date,
      };
    });
  }, [peerScores, score.product_id, phase]);

  // Peer group benchmark stats from the representative (latest) peer scores
  const peerBenchmark = useMemo(() => {
    const vals = representativeScores
      .map((s) =>
        computeWeightedScoreMulti(s.scoring_blocks || [], phase.key, {
          applyBonusPenalty: phase.key === "final_score",
          mode: "perCriterion",
          getValue: phase.getValue,
        })
      )
      .filter((v) => v != null);
    if (!vals.length) return { high: null, low: null, mean: null, median: null };
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      high: Math.max(...vals),
      low: Math.min(...vals),
      mean: sum / vals.length,
      median: median(vals),
    };
  }, [representativeScores, phase]);

  const hasVersions = productVersions.length > 0;
  const hasBenchmark = peerBenchmark.mean != null;
  const scoredPoints = productVersions.filter((p) => p.score != null);
  const trend = useMemo(() => {
    if (scoredPoints.length < 2) return null;
    const first = scoredPoints[0].score;
    const last = scoredPoints[scoredPoints.length - 1].score;
    const diff = last - first;
    if (Math.abs(diff) < 0.05) return { dir: "flat", diff };
    return { dir: diff > 0 ? "up" : "down", diff };
  }, [scoredPoints]);

  if (!hasVersions) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 text-center text-xs text-gray-400">
        <TrendingUp className="w-6 h-6 mx-auto mb-2 text-gray-300" />
        No scoring history yet for this product. Once re-scored over time, the
        trend will appear here.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            Score Trend Over Time ({phase.label})
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5">
            This product's weighted {phase.label.toLowerCase()} across {productVersions.length} scoring
            cycle{productVersions.length > 1 ? "s" : ""}.
            {hasBenchmark ? " Peer group benchmark shown as a shaded band with mean & median lines." : ""}
          </p>
        </div>
        {trend && (
          <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
              trend.dir === "up"
                ? "bg-green-50 text-green-700 border-green-200"
                : trend.dir === "down"
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            {trend.dir === "up" ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : trend.dir === "down" ? (
              <TrendingUp className="w-3.5 h-3.5 rotate-180" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            {trend.dir === "up" ? "Improving" : trend.dir === "down" ? "Declining" : "Stable"}
            <span className="opacity-70">
              ({trend.diff > 0 ? "+" : ""}
              {fmt(trend.diff)})
            </span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={productVersions} margin={{ top: 10, right: 20, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            formatter={(value, name) => [fmt(value), name]}
            labelFormatter={(label, payload) => {
              const p = payload?.[0]?.payload;
              if (!p) return label;
              const parts = [`Version ${p.version}`];
              if (p.scoring_end_date) parts.push(`Finalized: ${p.scoring_end_date}`);
              else if (p.scoring_start_date) parts.push(`Started: ${p.scoring_start_date}`);
              parts.push(`Status: ${p.status || "—"}`);
              return parts.join(" · ");
            }}
          />
          {hasBenchmark && (
            <ReferenceArea
              y1={peerBenchmark.low}
              y2={peerBenchmark.high}
              fill="#6366f1"
              fillOpacity={0.06}
              stroke="#6366f1"
              strokeOpacity={0.15}
              strokeDasharray="3 3"
              label={{ value: "Peer range", position: "insideTopLeft", fontSize: 10, fill: "#6366f1" }}
            />
          )}
          {hasBenchmark && peerBenchmark.mean != null && (
            <ReferenceLine
              y={peerBenchmark.mean}
              stroke="#4f46e5"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{ value: `Peer mean ${fmt(peerBenchmark.mean)}`, position: "right", fontSize: 10, fill: "#4f46e5" }}
            />
          )}
          {hasBenchmark && peerBenchmark.median != null && (
            <ReferenceLine
              y={peerBenchmark.median}
              stroke="#7c3aed"
              strokeDasharray="2 2"
              strokeWidth={1.5}
              label={{ value: `Peer median ${fmt(peerBenchmark.median)}`, position: "right", fontSize: 10, fill: "#7c3aed" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="score"
            name="This product"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#2563eb" }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-gray-600">
          <span className="w-3 h-0.5 bg-blue-600" /> This product
        </span>
        {hasBenchmark && (
          <>
            <span className="inline-flex items-center gap-1.5 text-indigo-600">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-indigo-600" /> Peer mean ({fmt(peerBenchmark.mean)})
            </span>
            <span className="inline-flex items-center gap-1.5 text-violet-600">
              <span className="w-3 h-0.5 border-t-2 border-dotted border-violet-600" /> Peer median ({fmt(peerBenchmark.median)})
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-500">
              <span className="w-3 h-3 bg-indigo-500/10 border border-dashed border-indigo-300" /> Peer high/low range ({fmt(peerBenchmark.high)} – {fmt(peerBenchmark.low)})
            </span>
          </>
        )}
      </div>
    </div>
  );
}