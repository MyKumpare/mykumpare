import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { StickyNote, Loader2, Check } from "lucide-react";

/**
 * Inline qualitative feedback field shown alongside the quantitative comparison
 * table. Auto-saves to the `review_notes` field on the ScoringMatrixScore record
 * on blur (or Cmd/Ctrl+Enter). Lets the analyst document context, rationale, or
 * observations that the numeric scores alone don't capture.
 */
export default function ScoringMatrixReviewNotes({ scoreId, reviewNotes }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(reviewNotes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Keep local state in sync if the underlying record changes (e.g. refetch).
  useEffect(() => {
    setNote(reviewNotes || "");
  }, [scoreId, reviewNotes]);

  const persistNote = async () => {
    if (!scoreId) return;
    if (note === (reviewNotes || "")) return;
    setSaving(true);
    setSaved(false);
    try {
      await base44.entities.ScoringMatrixScore.update(scoreId, { review_notes: note });
      setSaved(true);
      setSaving(false);
      queryClient.invalidateQueries({ queryKey: ["scoringMatrixScore", scoreId] });
      queryClient.invalidateQueries({ queryKey: ["topScoredFirmsSummary"] });
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setSaving(false);
      // Revert on failure so the user sees it didn't save.
      setNote(reviewNotes || "");
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <StickyNote className="w-4 h-4 text-amber-500" />
        <h4 className="text-sm font-semibold text-gray-700">Review Notes</h4>
        <span className="text-xs text-gray-400">— qualitative feedback for this scoring</span>
        <div className="ml-auto flex items-center gap-1">
          {saving && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
      </div>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        onBlur={persistNote}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.target.blur();
          }
        }}
        placeholder="Document specific qualitative feedback alongside the quantitative scores (auto-saves on blur, or press Cmd/Ctrl+Enter)…"
        rows={3}
        className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-white transition-colors"
      />
    </div>
  );
}