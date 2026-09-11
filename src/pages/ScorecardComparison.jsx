import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, GitCompareArrows } from "lucide-react";
import ScorecardSummaryStats from "@/components/scoring/ScorecardSummaryStats";

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-600",
  primary_scoring: "bg-blue-100 text-blue-700",
  secondary_scoring: "bg-cyan-100 text-cyan-700",
  team_review: "bg-amber-100 text-amber-700",
  ic_review: "bg-purple-100 text-purple-700",
  finalized: "bg-emerald-100 text-emerald-700",
};

const REVIEW_STYLES = {
  not_started: "bg-gray-100 text-gray-500",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};

const fmt = (n) => (n == null || isNaN(n) ? "—" : Number(n).toFixed(2));

function FirmPicker({ label, firms, selectedId, onSelect, isLoading }) {
  const [search, setSearch] = useState("");
  const filtered = (firms || []).filter((f) =>
    !search.trim() || (f.name || "").toLowerCase().includes(search.trim().toLowerCase())
  );
  const selected = (firms || []).find((f) => f.id === selectedId);

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      {selected ? (
        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gray-800 truncate">{selected.name}</span>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-xs text-indigo-600 hover:underline shrink-0"
            >
              Change
            </button>
          </div>
          {selected.firm_type && (
            <Badge variant="secondary" className="mt-1 text-xs">{selected.firm_type}</Badge>
          )}
        </div>
      ) : (
        <div className="p-2">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search investment managers..."
              className="pl-8 h-8 text-sm"
            />
          </div>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {filtered.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelect(f.id)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 transition-colors"
                >
                  {f.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-4">No firms found.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScorecardPicker({ scores, selectedId, onSelect }) {
  if (!scores || scores.length <= 1) return null;
  return (
    <select
      value={selectedId || ""}
      onChange={(e) => onSelect(e.target.value)}
      className="w-full h-8 text-xs rounded-md border border-gray-200 bg-white px-2 text-gray-700"
    >
      {scores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.product_name || "Unknown product"} — {s.template_name || "Untitled"} (v{s.version_number || 1})
        </option>
      ))}
    </select>
  );
}

function StatusRow({ score }) {
  if (!score) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge className={`text-xs ${STATUS_STYLES[score.status] || "bg-gray-100 text-gray-600"}`}>
        {score.status?.replace(/_/g, " ") || "draft"}
      </Badge>
      {score.is_closed && (
        <Badge className="text-xs bg-emerald-100 text-emerald-700">closed</Badge>
      )}
      {score.overall_pass_fail === "Pass" && (
        <Badge className="text-xs bg-emerald-100 text-emerald-700">Pass</Badge>
      )}
      {score.overall_pass_fail === "Fail" && (
        <Badge className="text-xs bg-red-100 text-red-700">Fail</Badge>
      )}
      {score.overall_rating && (
        <Badge className="text-xs bg-indigo-100 text-indigo-700">{score.overall_rating}</Badge>
      )}
    </div>
  );
}

function ReviewStatusGrid({ score }) {
  if (!score) return null;
  const items = [
    { label: "Primary", done: score.primary_score_finalized },
    { label: "Team", status: score.team_review_status },
    { label: "IC", status: score.ic_review_status },
    { label: "Final", done: score.final_score_finalized },
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map((it) => {
        const done = it.done != null ? it.done : it.status === "completed";
        const inProgress = it.status === "in_progress";
        const cls = done
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : inProgress
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-gray-50 text-gray-400 border-gray-200";
        return (
          <div key={it.label} className={`text-center text-xs rounded-md border px-1 py-1.5 ${cls}`}>
            <div className="font-semibold">{it.label}</div>
            <div className="text-[10px]">{done ? "Done" : inProgress ? "In Progress" : "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

function FirmComparisonColumn({ firmId, accent, label }) {
  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["scorecardComparison", firmId],
    queryFn: () => base44.entities.ScoringMatrixScore.filter(
      { firm_id: firmId, deleted_at: null },
      "-updated_date",
      50
    ),
    enabled: !!firmId,
  });

  const [selectedScoreId, setSelectedScoreId] = useState(null);
  const sortedScores = useMemo(
    () => [...scores].sort((a, b) => {
      // Prefer finalized/closed, then most recent
      if (a.is_closed !== b.is_closed) return a.is_closed ? -1 : 1;
      return 0;
    }),
    [scores]
  );
  const activeScore = sortedScores.find((s) => s.id === selectedScoreId) || sortedScores[0];

  // Fetch the scoring matrix template so we can compute total max scores
  const { data: template } = useQuery({
    queryKey: ["templateForScorecard", activeScore?.template_id],
    queryFn: () => base44.entities.Template.get(activeScore.template_id),
    enabled: !!activeScore?.template_id,
  });

  if (!firmId) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg p-6 bg-gray-50/50 text-center text-sm text-gray-400 flex items-center justify-center min-h-[300px]">
        Select an investment manager to compare.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 bg-white flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (sortedScores.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 bg-white text-center text-sm text-gray-400 flex items-center justify-center min-h-[300px]">
        No scorecards found for this manager.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {activeScore && <StatusRow score={activeScore} />}
      </div>
      <ScorecardPicker scores={sortedScores} selectedId={activeScore?.id} onSelect={setSelectedScoreId} />
      {activeScore && (
        <>
          <div className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{activeScore.product_name || "—"}</span>
            {" — "}
            <span>{activeScore.template_name || "Untitled template"}</span>
            <span className="text-gray-400"> · v{activeScore.version_number || 1}</span>
          </div>
          <ReviewStatusGrid score={activeScore} />
          <ScorecardSummaryStats score={activeScore} template={template} accent={accent} />
        </>
      )}
    </div>
  );
}

export default function ScorecardComparison() {
  const [firmA, setFirmA] = useState(null);
  const [firmB, setFirmB] = useState(null);

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["firmsForScorecardComparison"],
    queryFn: () => base44.entities.Firm.list("-name", 500),
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="w-5 h-5 text-indigo-600" />
        <div>
          <h2 className="text-lg font-semibold">Scorecard Comparison</h2>
          <p className="text-sm text-gray-500">
            Select two investment managers to compare their scorecard metrics, status indicators, and total adjusted scores side by side.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FirmPicker
          label="Manager A"
          firms={firms}
          selectedId={firmA}
          onSelect={setFirmA}
          isLoading={isLoading}
        />
        <FirmPicker
          label="Manager B"
          firms={firms}
          selectedId={firmB}
          onSelect={setFirmB}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FirmComparisonColumn firmId={firmA} label="Manager A" accent="bg-indigo-50 border-indigo-200" />
        <FirmComparisonColumn firmId={firmB} label="Manager B" accent="bg-violet-50 border-violet-200" />
      </div>
    </div>
  );
}