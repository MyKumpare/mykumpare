import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search, X, Users, BarChart3, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  computeWeightedScoreMulti,
  effectiveFinalScore,
  effectiveAdjustedPrimary,
} from "@/components/templates/scoringWeightLogic";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300",
};

const PHASES = [
  { key: "final_score", label: "Final Score", getValue: effectiveFinalScore },
  { key: "primary_score", label: "Primary Score", getValue: (c) => c.primary_score },
  { key: "adjusted_primary_score", label: "Adjusted Primary", getValue: effectiveAdjustedPrimary },
];

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return (Math.round(n * 100) / 100).toString();
}

function round1(n) {
  if (n == null || isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function statsFor(values) {
  const vals = values.filter((v) => v != null && !isNaN(v));
  if (!vals.length) return { high: null, low: null, mean: null, median: null, count: 0 };
  const sum = vals.reduce((a, b) => a + b, 0);
  return {
    high: Math.max(...vals),
    low: Math.min(...vals),
    mean: sum / vals.length,
    median: median(vals),
    count: vals.length,
  };
}

function StatCell({ value, highlight }) {
  if (value == null) return <span className="text-gray-300 text-[11px]">—</span>;
  const rounded = round1(value);
  const colorIdx = Math.round(value);
  const color = SCORE_COLORS[colorIdx] || "border-gray-200";
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2rem] px-1.5 h-6 rounded-full text-[11px] font-semibold border ${color} ${highlight ? "ring-1 ring-indigo-400" : ""}`}
    >
      {rounded}
    </span>
  );
}

/**
 * Peer Scoring Insights panel.
 *
 * Lets the analyst select specific manager products (that have scoring
 * matrices on the same template) and compare the peer group's scoring at the
 * total, section (block), and individual-criterion levels — showing High,
 * Low, Mean, and Median alongside the analyst's own score for the chosen
 * scoring phase.
 */
export default function ScoringPeerInsightsPanel({ score, template }) {
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [phaseKey, setPhaseKey] = useState("final_score");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedBlocks, setExpandedBlocks] = useState({});

  const phase = PHASES.find((p) => p.key === phaseKey) || PHASES[0];

  // Fetch all scoring matrices for this template (peers + current)
  const { data: peerScores = [], isLoading } = useQuery({
    queryKey: ["peerScoringScores", score?.template_id],
    queryFn: () =>
      base44.entities.ScoringMatrixScore.filter(
        { template_id: score.template_id },
        "-created_date",
        500
      ),
    enabled: !!score?.template_id,
  });

  // Build the list of selectable peer products (exclude the current product)
  const peerProducts = useMemo(() => {
    const map = new Map();
    for (const s of peerScores) {
      if (!s.product_id || s.product_id === score.product_id) continue;
      if (map.has(s.product_id)) continue;
      map.set(s.product_id, {
        product_id: s.product_id,
        product_name: s.product_name || "Untitled",
        firm_name: s.firm_name || "",
        status: s.status,
        is_finalized: s.status === "finalized",
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      a.product_name.localeCompare(b.product_name)
    );
  }, [peerScores, score.product_id]);

  // Pick one representative score per selected product (latest finalized, else latest)
  const representativeScores = useMemo(() => {
    const byProduct = new Map();
    for (const s of peerScores) {
      if (!selectedProductIds.includes(s.product_id)) continue;
      const existing = byProduct.get(s.product_id);
      if (!existing) {
        byProduct.set(s.product_id, s);
        continue;
      }
      const rank = (x) => (x.status === "finalized" ? 2 : 1);
      if (rank(s) > rank(existing) || (rank(s) === rank(existing) && (s.version_number || 1) > (existing.version_number || 1))) {
        byProduct.set(s.product_id, s);
      }
    }
    return Array.from(byProduct.values());
  }, [peerScores, selectedProductIds]);

  // Per-criterion peer values for the chosen phase
  const criterionPeerValues = useMemo(() => {
    const map = new Map(); // critId -> number[]
    for (const s of representativeScores) {
      (s.scoring_blocks || []).forEach((block) => {
        (block.criteria || []).forEach((crit) => {
          const v = phase.getValue(crit);
          if (v != null) {
            if (!map.has(crit.id)) map.set(crit.id, []);
            map.get(crit.id).push(v);
          }
        });
      });
    }
    return map;
  }, [representativeScores, phase]);

  // Per-block weighted totals for each peer (for section + overall stats)
  const peerBlockTotals = useMemo(() => {
    // returns { peerIndex -> { blockId -> weightedTotal }, overall -> weightedTotal }
    return representativeScores.map((s) => {
      const blocks = s.scoring_blocks || [];
      const blockTotals = {};
      blocks.forEach((block) => {
        const val = computeWeightedScoreMulti([block], phase.key, {
          applyBonusPenalty: phase.key === "final_score",
          mode: "perCriterion",
          getValue: phase.getValue,
        });
        blockTotals[block.id] = val;
      });
      const overall = computeWeightedScoreMulti(blocks, phase.key, {
        applyBonusPenalty: phase.key === "final_score",
        mode: "perCriterion",
        getValue: phase.getValue,
      });
      return { blockTotals, overall };
    });
  }, [representativeScores, phase]);

  const blocks = score.scoring_blocks || [];

  // Section (block) aggregated stats across peers
  const blockStats = useMemo(() => {
    const map = {};
    blocks.forEach((block) => {
      const vals = peerBlockTotals
        .map((p) => p.blockTotals[block.id])
        .filter((v) => v != null);
      map[block.id] = statsFor(vals);
    });
    return map;
  }, [blocks, peerBlockTotals]);

  // Overall total stats across peers
  const overallStats = useMemo(() => {
    const vals = peerBlockTotals.map((p) => p.overall).filter((v) => v != null);
    return statsFor(vals);
  }, [peerBlockTotals]);

  // Current firm's own totals for comparison
  const ownTotals = useMemo(() => {
    const blockMap = {};
    blocks.forEach((block) => {
      blockMap[block.id] = computeWeightedScoreMulti([block], phase.key, {
        applyBonusPenalty: phase.key === "final_score",
        mode: "perCriterion",
        getValue: phase.getValue,
      });
    });
    return {
      blocks: blockMap,
      overall: computeWeightedScoreMulti(blocks, phase.key, {
        applyBonusPenalty: phase.key === "final_score",
        mode: "perCriterion",
        getValue: phase.getValue,
      }),
    };
  }, [blocks, phase]);

  const toggleBlock = (id) => setExpandedBlocks((p) => ({ ...p, [id]: !p[id] }));

  const toggleProduct = (id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredPeers = peerProducts.filter((p) =>
    `${p.product_name} ${p.firm_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasPeers = representativeScores.length > 0;

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="flex items-start gap-2 border border-indigo-200 rounded-lg p-3 bg-indigo-50">
        <Users className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-indigo-900">Peer Scoring Insights</p>
          <p className="text-[11px] text-indigo-700 mt-0.5">
            Select manager products scored on the same template to see how the peer group
            scored each item, section, and the overall total — High, Low, Mean, and Median —
            alongside your own score for the selected phase.
          </p>
        </div>
      </div>

      {/* Controls: phase + product multi-select */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500">Scoring Phase</label>
          <select
            value={phaseKey}
            onChange={(e) => setPhaseKey(e.target.value)}
            className="h-9 rounded-md border border-gray-300 bg-white text-xs px-2"
          >
            {PHASES.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[280px]">
          <label className="text-[11px] font-medium text-gray-500">
            Peer Products ({selectedProductIds.length} selected)
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              className="w-full h-9 flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 text-xs"
            >
              <span className="text-gray-500 truncate">
                {selectedProductIds.length === 0
                  ? "Select peer products to compare…"
                  : `${selectedProductIds.length} product${selectedProductIds.length > 1 ? "s" : ""} selected`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {searchOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-auto">
                <div className="sticky top-0 bg-white p-2 border-b">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200">
                    <Search className="w-3.5 h-3.5 text-gray-400" />
                    <input
                      autoFocus
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search products…"
                      className="flex-1 text-xs outline-none bg-transparent"
                    />
                  </div>
                </div>
                {isLoading ? (
                  <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                  </div>
                ) : filteredPeers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-gray-400">
                    No other products scored on this template yet.
                  </div>
                ) : (
                  filteredPeers.map((p) => {
                    const checked = selectedProductIds.includes(p.product_id);
                    return (
                      <button
                        key={p.product_id}
                        type="button"
                        onClick={() => toggleProduct(p.product_id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-indigo-50 ${checked ? "bg-indigo-50/60" : ""}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                            {checked && <span className="text-white text-[9px]">✓</span>}
                          </span>
                          <span className="truncate">
                            <span className="font-medium">{p.product_name}</span>
                            {p.firm_name && <span className="text-gray-400"> — {p.firm_name}</span>}
                          </span>
                        </span>
                        {p.is_finalized ? (
                          <Badge variant="outline" className="text-[9px] text-green-600 border-green-300 bg-green-50 shrink-0">Finalized</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-gray-500 shrink-0">{p.status || "In Process"}</Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {/* Selected chips */}
          {selectedProductIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedProductIds.map((id) => {
                const p = peerProducts.find((x) => x.product_id === id);
                if (!p) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px]">
                    {p.product_name}
                    <button type="button" onClick={() => toggleProduct(id)} className="hover:text-indigo-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!hasPeers ? (
        <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-xs text-gray-400">
          <BarChart3 className="w-6 h-6 mx-auto mb-2 text-gray-300" />
          Select one or more peer products above to see how they were scored.
        </div>
      ) : (
        <>
          {/* Overall total summary card */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="text-[11px] text-gray-500">Your {phase.label}</div>
              <p className="text-lg font-bold mt-0.5">{fmt(ownTotals.overall)}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="text-[11px] text-gray-500">Peer High</div>
              <p className="text-lg font-bold mt-0.5 text-green-600">{fmt(overallStats.high)}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="text-[11px] text-gray-500">Peer Low</div>
              <p className="text-lg font-bold mt-0.5 text-red-600">{fmt(overallStats.low)}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="text-[11px] text-gray-500">Peer Mean</div>
              <p className="text-lg font-bold mt-0.5 text-indigo-600">{fmt(overallStats.mean)}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="text-[11px] text-gray-500">Peer Median</div>
              <p className="text-lg font-bold mt-0.5 text-violet-600">{fmt(overallStats.median)}</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            Based on {representativeScores.length} peer score{representativeScores.length > 1 ? "s" : ""} ·
            weighted totals use the same multiplier logic as the scorecard.
          </p>

          {/* Section + item breakdown table */}
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-gray-600 min-w-[220px]">Criterion / Section</th>
                  <th className="text-center p-2 font-medium text-gray-600 bg-blue-50">Your Score</th>
                  <th className="text-center p-2 font-medium text-gray-600 bg-green-50">Peer High</th>
                  <th className="text-center p-2 font-medium text-gray-600 bg-red-50">Peer Low</th>
                  <th className="text-center p-2 font-medium text-gray-600 bg-indigo-50">Peer Mean</th>
                  <th className="text-center p-2 font-medium text-gray-600 bg-violet-50">Peer Median</th>
                </tr>
              </thead>
              <tbody>
                {/* Overall total row */}
                <tr className="bg-gray-100 border-b-2 font-semibold">
                  <td className="p-2">Overall Weighted Total</td>
                  <td className="p-2 text-center bg-blue-50/60"><StatCell value={ownTotals.overall} highlight /></td>
                  <td className="p-2 text-center bg-green-50/40"><StatCell value={overallStats.high} /></td>
                  <td className="p-2 text-center bg-red-50/40"><StatCell value={overallStats.low} /></td>
                  <td className="p-2 text-center bg-indigo-50/40"><StatCell value={overallStats.mean} /></td>
                  <td className="p-2 text-center bg-violet-50/40"><StatCell value={overallStats.median} /></td>
                </tr>
                {blocks.map((block) => {
                  const expanded = !!expandedBlocks[block.id];
                  const bStats = blockStats[block.id] || { high: null, low: null, mean: null, median: null };
                  return (
                    <React.Fragment key={block.id}>
                      <tr
                        className="bg-gray-50 cursor-pointer hover:bg-gray-100 border-b"
                        onClick={() => toggleBlock(block.id)}
                      >
                        <td className="p-2 font-semibold text-gray-700">
                          <div className="flex items-center gap-1.5">
                            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            {block.name} <span className="text-gray-400 font-normal">({block.weight}%)</span>
                          </div>
                        </td>
                        <td className="p-2 text-center bg-blue-50/40"><StatCell value={ownTotals.blocks[block.id]} /></td>
                        <td className="p-2 text-center"><StatCell value={bStats.high} /></td>
                        <td className="p-2 text-center"><StatCell value={bStats.low} /></td>
                        <td className="p-2 text-center"><StatCell value={bStats.mean} /></td>
                        <td className="p-2 text-center"><StatCell value={bStats.median} /></td>
                      </tr>
                      {expanded && (block.criteria || []).map((crit) => {
                        const peerVals = criterionPeerValues.get(crit.id) || [];
                        const cStats = statsFor(peerVals);
                        const ownVal = phase.getValue(crit);
                        return (
                          <tr key={crit.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 pl-7">
                              <div className="font-medium">{crit.name}</div>
                              {crit.category && <div className="text-gray-400 text-[10px]">{crit.category}</div>}
                            </td>
                            <td className="p-2 text-center"><StatCell value={ownVal} /></td>
                            <td className="p-2 text-center"><StatCell value={cStats.high} /></td>
                            <td className="p-2 text-center"><StatCell value={cStats.low} /></td>
                            <td className="p-2 text-center"><StatCell value={cStats.mean} /></td>
                            <td className="p-2 text-center"><StatCell value={cStats.median} /></td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}