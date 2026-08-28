import React, { useMemo } from "react";
import { GitCompare, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { effectiveFinalScore, effectiveAdjustedPrimary } from "@/components/templates/scoringWeightLogic";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300"
};

function DiffPill({ diff }) {
  if (diff == null || diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
        <Minus className="w-3 h-3" /> 0
      </span>
    );
  }
  const up = diff > 0;
  const intensity = Math.min(Math.abs(diff) / 4, 1);
  const bg = up ? `rgba(34, 197, 94, ${0.15 + intensity * 0.35})` : `rgba(239, 68, 68, ${0.15 + intensity * 0.35})`;
  const text = up ? "text-green-800" : "text-red-800";
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${text}`}
      style={{ background: bg }}
      title={up ? "Increased" : "Decreased"}
    >
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}{diff}
    </span>
  );
}

function ScoreBadge({ value }) {
  if (value == null) return <span className="text-xs text-gray-300">—</span>;
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${SCORE_COLORS[value] || "border-gray-200"}`}>
      {value}
    </span>
  );
}

/**
 * Compact summary of every criterion whose score changed across the review
 * phases — Primary → Team Recommendation → Final IC result — with the exact
 * point differences highlighted. Criteria with no change at any phase are
 * omitted so the reviewer can focus on what moved.
 */
export default function ScoringMatrixChangeSummary({ blocks, showTeam, showIC, showFinal }) {
  const rows = useMemo(() => {
    const out = [];
    (blocks || []).forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        const primary = crit.primary_score ?? null;
        const team = showTeam ? (crit.team_score ?? null) : null;
        const final = showFinal ? effectiveFinalScore(crit) : null;
        const adjPrimary = effectiveAdjustedPrimary(crit);

        const diffTeam = primary != null && team != null ? team - primary : null;
        const diffFinalVsPrimary = primary != null && final != null ? final - primary : null;
        const diffFinalVsTeam = team != null && final != null ? final - team : null;

        const changed =
          (diffTeam != null && diffTeam !== 0) ||
          (diffFinalVsPrimary != null && diffFinalVsPrimary !== 0) ||
          (diffFinalVsTeam != null && diffFinalVsTeam !== 0);

        out.push({
          blockId: block.id,
          blockName: block.name,
          critId: crit.id,
          critNumber: crit.number,
          critName: crit.name || `#${crit.number}`,
          category: crit.category || "",
          primary,
          team,
          adjPrimary,
          final,
          diffTeam,
          diffFinalVsPrimary,
          diffFinalVsTeam,
          teamStatus: crit.team_status,
          icStatus: crit.ic_status,
          changed
        });
      });
    });
    return out;
  }, [blocks, showTeam, showIC, showFinal]);

  const changedRows = rows.filter((r) => r.changed);
  const unchangedCount = rows.length - changedRows.length;

  const summary = useMemo(() => {
    let upPrimaryFinal = 0, downPrimaryFinal = 0, unchangedFinal = 0;
    changedRows.forEach((r) => {
      if (r.diffFinalVsPrimary == null) return;
      if (r.diffFinalVsPrimary > 0) upPrimaryFinal++;
      else if (r.diffFinalVsPrimary < 0) downPrimaryFinal++;
      else unchangedFinal++;
    });
    const netPrimaryFinal = changedRows.reduce(
      (acc, r) => acc + (r.diffFinalVsPrimary || 0), 0
    );
    return { upPrimaryFinal, downPrimaryFinal, unchangedFinal, netPrimaryFinal };
  }, [changedRows]);

  const hasAnyTeam = showTeam;
  const hasAnyFinal = showFinal;

  if (!hasAnyTeam && !hasAnyFinal) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
        <GitCompare className="w-6 h-6 mx-auto mb-2 text-gray-300" />
        Score changes will appear here once the team review or IC review phase begins.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="border border-gray-200 rounded-lg p-2.5 bg-white">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Criteria Changed</div>
          <div className="text-lg font-bold text-gray-800">{changedRows.length}<span className="text-xs font-normal text-gray-400"> / {rows.length}</span></div>
        </div>
        <div className="border border-green-200 rounded-lg p-2.5 bg-green-50">
          <div className="text-[10px] uppercase tracking-wide text-green-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Up (Primary→Final)</div>
          <div className="text-lg font-bold text-green-700">{summary.upPrimaryFinal}</div>
        </div>
        <div className="border border-red-200 rounded-lg p-2.5 bg-red-50">
          <div className="text-[10px] uppercase tracking-wide text-red-600 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Down (Primary→Final)</div>
          <div className="text-lg font-bold text-red-700">{summary.downPrimaryFinal}</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-2.5 bg-white">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Net Change (Primary→Final)</div>
          <div className={`text-lg font-bold ${summary.netPrimaryFinal > 0 ? "text-green-700" : summary.netPrimaryFinal < 0 ? "text-red-700" : "text-gray-700"}`}>
            {summary.netPrimaryFinal > 0 ? "+" : ""}{summary.netPrimaryFinal}
          </div>
        </div>
      </div>

      {changedRows.length === 0 ? (
        <div className="border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
          <Minus className="w-5 h-5 mx-auto mb-2 text-gray-300" />
          No score changes detected — the team recommendation and final IC result match the primary analyst's scores across all criteria.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="border-b">
                <th className="text-left p-2 font-medium text-gray-600 min-w-[220px]">Criterion</th>
                <th className="text-center p-2 font-medium text-gray-600">Primary</th>
                {hasAnyTeam && <th className="text-center p-2 font-medium text-gray-600">Team Rec.</th>}
                {hasAnyTeam && <th className="text-center p-2 font-medium text-gray-600">Δ Team</th>}
                {hasAnyFinal && <th className="text-center p-2 font-medium text-gray-600">Final (IC)</th>}
                {hasAnyFinal && <th className="text-center p-2 font-medium text-gray-600">Δ Final vs Primary</th>}
                {hasAnyTeam && hasAnyFinal && <th className="text-center p-2 font-medium text-gray-600">Δ Final vs Team</th>}
                <th className="text-center p-2 font-medium text-gray-600">Decision</th>
              </tr>
            </thead>
            <tbody>
              {changedRows.map((r) => {
                const decisionLabel =
                  r.icStatus === "accepted" ? "IC accepted"
                  : r.icStatus === "rejected" ? "IC rejected"
                  : r.teamStatus === "accepted" ? "Team accepted"
                  : r.teamStatus === "rejected" ? "Team rejected"
                  : "Adjusted";
                const decisionColor =
                  r.icStatus === "accepted" ? "bg-green-100 text-green-700 border-green-300"
                  : r.icStatus === "rejected" ? "bg-red-100 text-red-700 border-red-300"
                  : r.teamStatus === "accepted" ? "bg-green-100 text-green-700 border-green-300"
                  : r.teamStatus === "rejected" ? "bg-red-100 text-red-700 border-red-300"
                  : "bg-gray-100 text-gray-600 border-gray-300";
                return (
                  <tr key={r.critId} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div className="font-medium">{r.critName}</div>
                      <div className="text-[10px] text-gray-400">{r.blockName}{r.category ? ` · ${r.category}` : ""}</div>
                    </td>
                    <td className="p-2 text-center"><ScoreBadge value={r.primary} /></td>
                    {hasAnyTeam && <td className="p-2 text-center"><ScoreBadge value={r.team} /></td>}
                    {hasAnyTeam && <td className="p-2 text-center"><DiffPill diff={r.diffTeam} /></td>}
                    {hasAnyFinal && <td className="p-2 text-center"><ScoreBadge value={r.final} /></td>}
                    {hasAnyFinal && <td className="p-2 text-center"><DiffPill diff={r.diffFinalVsPrimary} /></td>}
                    {hasAnyTeam && hasAnyFinal && <td className="p-2 text-center"><DiffPill diff={r.diffFinalVsTeam} /></td>}
                    <td className="p-2 text-center">
                      <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${decisionColor}`}>
                        {decisionLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {unchangedCount > 0 && (
        <p className="text-xs text-gray-400">
          {unchangedCount} criteri{unchangedCount === 1 ? "on" : "a"} had no score changes and are hidden from this summary.
        </p>
      )}
    </div>
  );
}