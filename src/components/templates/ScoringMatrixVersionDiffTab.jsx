import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { GitCompare, ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { computeWeightedScoreMulti, effectiveAdjustedPrimary, effectiveFinalScore } from "@/components/templates/scoringWeightLogic";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300",
};

function ScorePill({ value, dim }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${SCORE_COLORS[value] || "border-gray-200"} ${dim ? "opacity-40" : ""}`}>
      {value}
    </span>
  );
}

/**
 * Version History tab for a single ScoringMatrixScore.
 *
 * Highlights the differences between the primary analyst's initial entry
 * (primary_score) and the final adjusted score (effective final) per criterion,
 * preserving a clear trail of how each score moved through the review phases:
 * Primary → Team Rec → Adjusted Primary → IC Rec → Final.
 *
 * Props:
 *   score - the current ScoringMatrixScore record
 */
export default function ScoringMatrixVersionDiffTab({ score }) {
  const blocks = score?.scoring_blocks || [];

  // Flatten criteria with their phase values + computed delta
  const rows = useMemo(() => {
    const out = [];
    blocks.forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        const primary = crit.primary_score;
        const teamRec = crit.team_score;
        const adjPrimary = effectiveAdjustedPrimary(crit);
        const icRec = crit.ic_score;
        const final = effectiveFinalScore(crit);
        const delta = primary != null && final != null ? final - primary : null;
        out.push({
          blockId: block.id,
          blockName: block.name,
          blockWeight: block.weight,
          critId: crit.id,
          name: crit.name,
          category: crit.category,
          primary,
          teamRec,
          adjPrimary,
          icRec,
          final,
          delta,
          teamStatus: crit.team_status,
          icStatus: crit.ic_status,
          primaryNotes: crit.primary_notes,
          finalNotes: crit.final_notes || crit.adjusted_primary_notes || crit.ic_notes,
        });
      });
    });
    return out;
  }, [blocks]);

  const changedRows = rows.filter((r) => r.delta != null && r.delta !== 0);
  const increased = rows.filter((r) => r.delta > 0);
  const decreased = rows.filter((r) => r.delta < 0);
  const unchanged = rows.filter((r) => r.delta === 0);

  const weightedPrimary = useMemo(
    () => computeWeightedScoreMulti(blocks, "primary_score", { getValue: (c) => c.primary_score }),
    [blocks]
  );
  const weightedFinal = useMemo(
    () => computeWeightedScoreMulti(blocks, "final_score", {
      applyBonusPenalty: true,
      getValue: (c) => effectiveFinalScore(c),
    }),
    [blocks]
  );
  const overallDelta = weightedPrimary != null && weightedFinal != null ? weightedFinal - weightedPrimary : null;

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No scoring criteria found for this matrix.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-2">
        <GitCompare className="w-4 h-4 text-amber-500" />
        <h4 className="text-sm font-semibold">Version History — Primary vs Final</h4>
        <Badge variant="secondary" className="text-xs ml-auto">
          v{score.version_number || 1}
        </Badge>
      </div>

      <p className="text-xs text-gray-500">
        Tracks how each criterion moved from the primary analyst's initial entry to the final adjusted score,
        preserving a clear trail of changes through the team and IC review phases.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SummaryCard
          icon={<Scale className="w-4 h-4 text-gray-500" />}
          label="Weighted Primary"
          value={weightedPrimary != null ? weightedPrimary.toFixed(2) : "—"}
        />
        <SummaryCard
          icon={<Scale className="w-4 h-4 text-amber-500" />}
          label="Weighted Final"
          value={weightedFinal != null ? weightedFinal.toFixed(2) : "—"}
          accent={overallDelta > 0 ? "text-green-600" : overallDelta < 0 ? "text-red-600" : "text-gray-700"}
          sub={overallDelta != null ? `${overallDelta > 0 ? "+" : ""}${overallDelta.toFixed(2)} net` : null}
        />
        <SummaryCard
          icon={<ArrowUp className="w-4 h-4 text-green-500" />}
          label="Increased"
          value={increased.length}
          accent="text-green-600"
        />
        <SummaryCard
          icon={<ArrowDown className="w-4 h-4 text-red-500" />}
          label="Decreased"
          value={decreased.length}
          accent="text-red-600"
        />
      </div>

      {/* Per-criterion diff table */}
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="border-b">
              <th className="text-left p-2 font-medium text-gray-600 min-w-[200px]">Criterion</th>
              <th className="text-center p-2 font-medium text-gray-600">Primary (Initial)</th>
              <th className="text-center p-2 font-medium text-gray-400">Team Rec</th>
              <th className="text-center p-2 font-medium text-gray-500">Adj. Primary</th>
              <th className="text-center p-2 font-medium text-gray-400">IC Rec</th>
              <th className="text-center p-2 font-medium text-gray-700">Final</th>
              <th className="text-center p-2 font-medium text-gray-600">Δ</th>
              <th className="text-left p-2 font-medium text-gray-600 min-w-[180px]">Change Trail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const changed = r.delta != null && r.delta !== 0;
              return (
                <tr key={r.critId} className={`border-b hover:bg-gray-50 ${changed ? "bg-amber-50/40" : ""}`}>
                  <td className="p-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-gray-400 text-[10px]">{r.blockName} · {r.blockWeight}%</div>
                  </td>
                  <td className="p-2 text-center"><ScorePill value={r.primary} /></td>
                  <td className="p-2 text-center"><ScorePill value={r.teamRec} dim /></td>
                  <td className="p-2 text-center"><ScorePill value={r.adjPrimary} dim /></td>
                  <td className="p-2 text-center"><ScorePill value={r.icRec} dim /></td>
                  <td className="p-2 text-center"><ScorePill value={r.final} /></td>
                  <td className="p-2 text-center">
                    <DeltaBadge delta={r.delta} />
                  </td>
                  <td className="p-2">
                    <ChangeTrail row={r} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Notes trail for changed criteria */}
      {changedRows.length > 0 && (
        <div className="border border-gray-200 rounded-lg">
          <div className="px-3 py-2 bg-gray-50 border-b">
            <span className="text-sm font-medium">Justification for Changed Scores</span>
          </div>
          <div className="divide-y divide-gray-100">
            {changedRows.map((r) => (
              <div key={r.critId} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{r.name}</span>
                  <DeltaBadge delta={r.delta} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 font-medium">Primary: </span>
                    <span className="text-gray-600">{r.primaryNotes || <em className="text-gray-300">No notes</em>}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium">Final: </span>
                    <span className="text-gray-600">{r.finalNotes || <em className="text-gray-300">No notes</em>}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {changedRows.length === 0 && (
        <div className="text-center py-4 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          <Minus className="w-4 h-4 inline mr-1" />
          No changes between primary entry and final scores — the final scores match the initial entries.
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, accent, sub }) {
  return (
    <div className="border border-gray-200 rounded-lg p-2.5 bg-white">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] text-gray-500">{label}</span>
      </div>
      <div className={`text-lg font-bold ${accent || "text-gray-800"}`}>{value}</div>
      {sub && <div className={`text-[10px] ${accent || "text-gray-400"}`}>{sub}</div>}
    </div>
  );
}

function DeltaBadge({ delta }) {
  if (delta == null) return <span className="text-gray-300">—</span>;
  if (delta === 0) return <span className="inline-flex items-center text-gray-400"><Minus className="w-3 h-3" /></span>;
  const positive = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {positive ? "+" : ""}{delta}
    </span>
  );
}

function ChangeTrail({ row }) {
  const steps = [];
  // Primary → Team Rec
  if (row.teamRec != null && row.teamStatus === "accepted") {
    steps.push({ label: "Team rec accepted", tone: "green" });
  } else if (row.teamRec != null && row.teamStatus === "rejected") {
    steps.push({ label: "Team rec rejected", tone: "red" });
  }
  // Adjusted primary differs from primary
  if (row.adjPrimary != null && row.primary != null && row.adjPrimary !== row.primary && row.teamStatus !== "accepted") {
    steps.push({ label: "Primary adjusted", tone: "amber" });
  }
  // IC Rec
  if (row.icRec != null && row.icStatus === "accepted") {
    steps.push({ label: "IC rec accepted", tone: "green" });
  } else if (row.icRec != null && row.icStatus === "rejected") {
    steps.push({ label: "IC rec rejected", tone: "red" });
  }
  // Final override
  if (row.final != null && row.icRec != null && row.final !== row.icRec && row.icStatus !== "accepted") {
    steps.push({ label: "Final override", tone: "amber" });
  }

  if (steps.length === 0) {
    return <span className="text-[10px] text-gray-400">No review changes</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {steps.map((s, i) => (
        <span
          key={i}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            s.tone === "green" ? "bg-green-50 text-green-700 border border-green-200"
            : s.tone === "red" ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}