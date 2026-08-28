import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
  ChevronRight,
  StickyNote,
  Check
} from "lucide-react";
import ScoringBulkActionsBar from "@/components/templates/ScoringBulkActionsBar";

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

/** A single firm row with an inline, auto-saving qualitative notes field. */
function FirmRow({ firm, rank, medalColors, onFirmClick, selected, onToggleSelect }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(firm.reviewNotes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Keep local state in sync if the underlying record changes (e.g. refetch).
  useEffect(() => {
    setNote(firm.reviewNotes || "");
  }, [firm.scoreId, firm.reviewNotes]);

  const persistNote = async () => {
    if (note === (firm.reviewNotes || "")) return;
    setSaving(true);
    setSaved(false);
    try {
      await base44.entities.ScoringMatrixScore.update(firm.scoreId, { review_notes: note });
      setSaved(true);
      setSaving(false);
      queryClient.invalidateQueries({ queryKey: ["topScoredFirmsSummary"] });
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setSaving(false);
      // Revert on failure so the user sees it didn't save.
      setNote(firm.reviewNotes || "");
    }
  };

  const isUp = (firm.delta ?? 0) > 0;
  const isDown = (firm.delta ?? 0) < 0;
  const deltaColor = isUp ? "text-green-600" : isDown ? "text-red-600" : "text-gray-500";
  const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div className={`px-4 py-2.5 hover:bg-gray-50 transition-colors group ${selected ? "bg-indigo-50/40" : ""}`}>
      <div className="flex items-center gap-3">
        {/* Bulk selection checkbox */}
        <button
          type="button"
          onClick={() => onToggleSelect?.(firm.scoreId)}
          className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${selected ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300 hover:border-indigo-400"}`}
          title={selected ? "Remove from bulk selection" : "Add to bulk selection"}
        >
          {selected ? <Check className="w-3 h-3" /> : null}
        </button>
        {/* Rank / medal */}
        <div className="flex-shrink-0 w-7 flex items-center justify-center">
          {rank < 3 ? (
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: medalColors[rank] }}
            >
              {rank + 1}
            </span>
          ) : (
            <span className="text-xs font-semibold text-gray-400">{rank + 1}</span>
          )}
        </div>

        {/* Firm name + template — clickable to open the firm profile */}
        <button
          type="button"
          onClick={() => onFirmClick?.(firm.firmId)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="text-sm font-medium text-gray-800 truncate group-hover:text-primary">
            {firm.firmName}
          </div>
          <div className="text-[11px] text-gray-400 truncate">
            {firm.templateName ? `${firm.templateName} · ` : ""}v{firm.version}
            {firm.latestDate ? ` · ${firm.latestDate}` : ""}
          </div>
        </button>

        {/* Latest score */}
        <div className="flex-shrink-0 text-right">
          <div className="text-base font-bold text-gray-800 leading-none">
            {firm.latestScore.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">latest</div>
        </div>

        {/* Performance shift */}
        <div className={`flex-shrink-0 flex items-center gap-1 ${deltaColor} min-w-[64px] justify-end`}>
          {firm.delta != null ? (
            <>
              <DeltaIcon className="w-3.5 h-3.5" />
              <span className="text-sm font-semibold">
                {isUp ? "+" : ""}{firm.delta.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
      </div>

      {/* Inline qualitative notes field — auto-saves on blur */}
      <div className="mt-2 flex items-start gap-2 pl-10">
        <StickyNote className="w-3.5 h-3.5 text-gray-400 mt-1.5 flex-shrink-0" />
        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          onBlur={persistNote}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.target.blur(); } }}
          placeholder="Add qualitative feedback for this firm… (auto-saves on blur)"
          rows={1}
          className="flex-1 min-h-[32px] text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-white transition-colors"
        />
        <div className="flex items-center gap-1 mt-1.5 flex-shrink-0 w-12">
          {saving && <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />}
          {saved && <Check className="w-3.5 h-3.5 text-green-500" />}
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard summary card highlighting the top 5 firms based on their latest
 * finalized scoring matrix, with a quick view of the performance shift
 * (delta vs the prior scoring version) and an inline qualitative notes field
 * per firm for documenting review feedback.
 */
export default function TopScoredFirmsSummary({ onFirmClick }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
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
          scoreId: rec.id,
          productId: rec.product_id,
          templateId: rec.template_id,
          templateName: rec.template_name,
          latestScore: weighted,
          latestDate: rec.scoring_end_date || rec.scoring_start_date,
          version: rec.version_number || 1,
          reviewNotes: rec.review_notes || "",
          priorScore: null,
          priorDate: null
        };
      }
    });

    // Second pass: find the prior version for each firm's latest score.
    (scores || []).forEach((rec) => {
      const fid = rec.firm_id;
      const entry = byFirm[fid];
      if (!entry) return;
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

  const toggleSelect = (scoreId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(scoreId)) next.delete(scoreId);
      else next.add(scoreId);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectedScores = topFirms.filter((f) => selectedIds.has(f.scoreId));

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
        <>
          {selectedScores.length > 0 && (
            <div className="px-4 pt-3">
              <ScoringBulkActionsBar
                selectedScores={selectedScores}
                onClear={clearSelection}
                invalidateKeys={[["topScoredFirmsSummary"]]}
              />
            </div>
          )}
          <div className="divide-y divide-gray-100">
            {topFirms.map((f, i) => (
              <FirmRow
                key={f.firmId}
                firm={f}
                rank={i}
                medalColors={medalColors}
                onFirmClick={onFirmClick}
                selected={selectedIds.has(f.scoreId)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}