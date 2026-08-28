import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { computeWeightedScore } from "./scoringSnapshotUtils";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300"
};

/**
 * Side-by-side comparison of two ScoringMatrixSnapshot records.
 * Renders a criteria-level table showing the final_score (and primary_score)
 * from each snapshot, with the delta highlighted. Blocks are collapsible.
 *
 * Props:
 *   snapA      - older snapshot
 *   snapB      - newer snapshot
 *   liveScore  - the current ScoringMatrixScore (optional, shown as a third column when present)
 *   onClose    - callback to close the comparison
 */
export default function ScoringMatrixSnapshotCompare({ snapA, snapB, liveScore, onClose }) {
  const [expandedBlocks, setExpandedBlocks] = React.useState({});

  // Build a lookup of criteria by id for each snapshot
  const critMapA = useMemo(() => buildCritMap(snapA.scoring_blocks), [snapA]);
  const critMapB = useMemo(() => buildCritMap(snapB.scoring_blocks), [snapB]);
  const critMapLive = useMemo(() => (liveScore ? buildCritMap(liveScore.scoring_blocks) : {}), [liveScore]);

  // Use snapB's block structure as the reference (newer); fall back to snapA
  const blocks = useMemo(() => {
    const bl = (snapB.scoring_blocks && snapB.scoring_blocks.length ? snapB.scoring_blocks : snapA.scoring_blocks) || [];
    return bl.map((b) => ({ ...b, criteria: b.criteria || [] }));
  }, [snapA, snapB]);

  const weightedA = snapA.weighted_final_score ?? computeWeightedScore(snapA.scoring_blocks, "final_score");
  const weightedB = snapB.weighted_final_score ?? computeWeightedScore(snapB.scoring_blocks, "final_score");
  const weightedLive = liveScore ? computeWeightedScore(liveScore.scoring_blocks, "final_score") : null;

  const toggleBlock = (id) => setExpandedBlocks((p) => ({ ...p, [id]: !p[id] }));

  const formatScore = (score) => {
    if (score == null) return <span className="text-gray-300">—</span>;
    return (
      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${SCORE_COLORS[score] || "border-gray-200"}`}>
        {score}
      </span>
    );
  };

  const formatDelta = (a, b) => {
    if (a == null || b == null) return <span className="text-gray-300 text-[10px]">—</span>;
    const diff = Math.round((b - a) * 100) / 100;
    if (diff === 0) return <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Minus className="w-2.5 h-2.5" />0</span>;
    return (
      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${diff > 0 ? "text-green-600" : "text-red-600"}`}>
        {diff > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
        {diff > 0 ? "+" : ""}{diff}
      </span>
    );
  };

  const headerA = snapA.label || "Snapshot A";
  const headerB = snapB.label || "Snapshot B";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800">Snapshot Comparison</h3>
            <span className="text-xs text-gray-400">— side-by-side review versions</span>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Summary cards */}
        <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-3">
          <CompareSummaryCard label={headerA} date={snapA.created_date} weighted={weightedA} phase={snapA.phase_summary} accent="border-blue-200 bg-blue-50/50" />
          <CompareSummaryCard label={headerB} date={snapB.created_date} weighted={weightedB} phase={snapB.phase_summary} accent="border-teal-200 bg-teal-50/50" />
          {liveScore && (
            <CompareSummaryCard label="Live Score" date={null} weighted={weightedLive} phase={liveScore.status} accent="border-amber-200 bg-amber-50/50" />
          )}
        </div>

        {/* Comparison table */}
        <div className="overflow-auto flex-1 p-4">
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-gray-600 min-w-[200px]">Criterion</th>
                  <th className="text-center p-2 font-medium text-gray-600 bg-blue-50/50">{headerA}<div className="text-[9px] font-normal text-gray-400">Final</div></th>
                  <th className="text-center p-2 font-medium text-gray-600 bg-teal-50/50">{headerB}<div className="text-[9px] font-normal text-gray-400">Final</div></th>
                  <th className="text-center p-2 font-medium text-gray-600">Δ Final</th>
                  {liveScore && <th className="text-center p-2 font-medium text-gray-600 bg-amber-50/50">Live<div className="text-[9px] font-normal text-gray-400">Final</div></th>}
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <React.Fragment key={block.id}>
                    <tr className="bg-gray-100 cursor-pointer hover:bg-gray-200" onClick={() => toggleBlock(block.id)}>
                      <td colSpan={liveScore ? 5 : 4} className="p-2 font-semibold text-gray-700">
                        <div className="flex items-center gap-1.5">
                          {expandedBlocks[block.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          {block.name} <span className="text-gray-400 font-normal">({block.weight}%)</span>
                        </div>
                      </td>
                    </tr>
                    {expandedBlocks[block.id] && block.criteria.map((crit) => {
                      const a = critMapA[crit.id] || {};
                      const b = critMapB[crit.id] || {};
                      const live = critMapLive[crit.id] || {};
                      return (
                        <tr key={crit.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <div className="font-medium">{crit.name}</div>
                            {crit.category && <div className="text-gray-400 text-[10px]">{crit.category}</div>}
                          </td>
                          <td className="p-2 text-center bg-blue-50/30">{formatScore(a.final_score)}</td>
                          <td className="p-2 text-center bg-teal-50/30">{formatScore(b.final_score)}</td>
                          <td className="p-2 text-center">{formatDelta(a.final_score, b.final_score)}</td>
                          {liveScore && (
                            <td className="p-2 text-center bg-amber-50/30">{formatScore(live.final_score)}</td>
                          )}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-5 py-3 border-t flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function buildCritMap(blocks) {
  const map = {};
  (blocks || []).forEach((block) => {
    (block.criteria || []).forEach((c) => {
      map[c.id] = c;
    });
  });
  return map;
}

function CompareSummaryCard({ label, date, weighted, phase, accent }) {
  return (
    <div className={`border rounded-lg p-3 ${accent}`}>
      <div className="text-xs font-semibold text-gray-700 truncate">{label}</div>
      {date && <div className="text-[10px] text-gray-400">{format(new Date(date), "MMM d, yyyy h:mm a")}</div>}
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-xl font-bold text-gray-800">{weighted != null ? weighted : "—"}</span>
        <span className="text-[10px] text-gray-400">weighted final</span>
      </div>
      {phase && <Badge variant="outline" className="text-[9px] mt-1">{phase}</Badge>}
    </div>
  );
}