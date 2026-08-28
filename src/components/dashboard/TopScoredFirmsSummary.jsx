import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
  ChevronRight
} from "lucide-react";

/**
 * Compute the weighted final score for a single ScoringMatrixScore record.
 * Mirrors the logic in ScoreTrendAnalyticsTab: block-weighted average of
 * per-criterion final_score values.
 */
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

/**
 * Dashboard summary card highlighting the top 5 firms based on their latest
 * finalized scoring matrix, with a quick view of the performance shift
 * (delta vs the prior scoring version for the same product + template).
 */
export default function TopScoredFirmsSummary({ onFirmClick, forceExpanded }) {
  const { data: scores = [], isLoading, error } = useQuery({
    queryKey: ["topScoredFirmsSummary"],
    queryFn: async () => {
      const res = await base44.entities.ScoringMatrixScore.list("-scoring_end_date", 500);
      return (res || []).filter((s) => s.status === "finalized");
    },
    staleTime: 5 * 60 * 1000,
  });

  // For each firm, keep only the latest finalized score (records are sorted desc
  // by scoring_end_date), then find the prior version to compute the shift.
  const topFirms = useMemo(() => {
    const byFirm = {}; // firm_id -> { latest, prior }
    (scores || []).forEach((rec) => {
      const fid = rec.firm_id;
      if (!fid) return;
      const weighted = computeWeightedFinal(rec);
      if (weighted == null) return;
      if (!byFirm[fid]) {
        byFirm[fid] = {
          firmId: fid,
          firmName: rec.firm_name || "Unknown",
          productId: rec.product_id,
          templateId: rec.template_id,
          templateName: rec.template_name,
          latestScore: weighted,
          latestDate: rec.scoring_end_date || rec.scoring_start_date,
          version: rec.version_number || 1,
          priorScore: null,
          priorDate: null
        };
      }
    });

    // Second pass: find the prior version for each firm's latest score.
    // Prior = the most recent finalized score for the same firm + product +
    // template whose version is lower (or whose id matches latest.prior_score_id).
    const latestKeys = new Set(Object.values(byFirm).map((f) => `${f.firmId}|${f.productId}|${f.templateId}|${f.version}`));
    (scores || []).forEach((rec) => {
      const fid = rec.firm_id;
      const entry = byFirm[fid];
      if (!entry) return;
      // Must match same product + template and be a different (earlier) version.
      if (rec.product_id !== entry.productId || rec.template_id !== entry.templateId) return;
      if ((rec.version_number || 1) >= entry.version) return;
      const weighted = computeWeightedFinal(rec);
      if (weighted == null) return;
      const recDate = rec.scoring_end_date || rec.scoring_start_date;
      if (entry.priorScore == null || (recDate && recDate > (entry.priorDate || ""))) {
        entry.priorScore = weighted;
        entry.priorDate = recDate;
      }
    });

    return Object.values(byFirm)
      .map((f) => {
        const delta = f.priorScore != null
          ? Math.round((f.latestScore - f.priorScore) * 100) / 100
          : null;
        return { ...f, delta };
      })
      .sort((a, b) => b.latestScore - a.latestScore)
      .slice(0, 5);
  }, [scores]);

  const medalColors = ["#d4a017", "#9ca3af", "#b45309"]; // gold, silver, bronze

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4 px-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading top scored firms…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 py-4 px-4">
        <AlertCircle className="w-4 h-4" /> Failed to load top scored firms.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-800">Top 5 Firms by Latest Score</h3>
          <span className="text-xs text-gray-400">(finalized scoring matrix)</span>
        </div>
      </div>

      {topFirms.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          No finalized scoring records found yet.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {topFirms.map((f, i) => {
            const isUp = (f.delta ?? 0) > 0;
            const isDown = (f.delta ?? 0) < 0;
            const isFlat = f.delta === 0;
            const deltaColor = isUp ? "text-green-600" : isDown ? "text-red-600" : "text-gray-500";
            const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
            return (
              <button
                key={f.firmId}
                type="button"
                onClick={() => onFirmClick?.(f.firmId)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left group"
              >
                {/* Rank / medal */}
                <div className="flex-shrink-0 w-7 flex items-center justify-center">
                  {i < 3 ? (
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: medalColors[i] }}
                    >
                      {i + 1}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400">{i + 1}</span>
                  )}
                </div>

                {/* Firm name + template */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate group-hover:text-primary">
                    {f.firmName}
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">
                    {f.templateName ? `${f.templateName} · ` : ""}v{f.version}
                    {f.latestDate ? ` · ${f.latestDate}` : ""}
                  </div>
                </div>

                {/* Latest score */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-base font-bold text-gray-800 leading-none">
                    {f.latestScore.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">latest</div>
                </div>

                {/* Performance shift */}
                <div className={`flex-shrink-0 flex items-center gap-1 ${deltaColor} min-w-[64px] justify-end`}>
                  {f.delta != null ? (
                    <>
                      <DeltaIcon className="w-3.5 h-3.5" />
                      <span className="text-sm font-semibold">
                        {isUp ? "+" : ""}{f.delta.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}