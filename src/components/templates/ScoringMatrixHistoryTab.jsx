import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, History, TrendingUp, Calendar, GitBranch, Lock, FileText, Search, X, Layers, AlertTriangle, Check } from "lucide-react";
import { format, parseISO, differenceInDays, isWithinInterval } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import { createRescoreFromPrior } from "./rescoreLogic";
import { toast } from "@/components/ui/use-toast";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300"
};

/**
 * History tab showing how an entity's final scores change over time.
 * Fetches all ScoringMatrixScore records for the same product + template,
 * ordered by version, and visualizes the evaluation progress with a trend chart.
 *
 * Also provides a cross-product search bar to filter ALL past evaluations by firm
 * name, product name, or date range, plus a bulk re-scoring feature to select
 * multiple closed scores and start new scoring cycles for them at once.
 *
 * Props:
 *   score - the current ScoringMatrixScore record
 *   onOpenScore - callback(scoreId) to open a different score version
 */
export default function ScoringMatrixHistoryTab({ score, onOpenScore }) {
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState(null);

  // Search / filter state
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // Current product's history (for the trend chart + per-criterion table)
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["scoringMatrixHistory", score?.product_id, score?.template_id],
    queryFn: () =>
      base44.entities.ScoringMatrixScore.filter({
        product_id: score.product_id,
        template_id: score.template_id
      }, "-scoring_start_date", 100),
    enabled: !!score?.product_id && !!score?.template_id
  });

  // ALL scores across all products/firms (for cross-product search)
  const { data: allScores = [], isLoading: allScoresLoading } = useQuery({
    queryKey: ["scoringMatrixAllScores"],
    queryFn: () => base44.entities.ScoringMatrixScore.list("-scoring_start_date", 500),
    enabled: isSearchActive
  });

  // Sort by version_number ascending for the chart
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => (a.version_number || 1) - (b.version_number || 1));
  }, [history]);

  // Build chart data: one data point per scoring version, showing weighted final score
  const chartData = useMemo(() => {
    return sortedHistory.map((s) => {
      const blocks = s.scoring_blocks || [];
      let total = 0;
      let totalWeight = 0;
      blocks.forEach((block) => {
        const blockWeight = (block.weight || 0) / 100;
        (block.criteria || []).forEach((crit) => {
          if (crit.final_score != null) {
            total += crit.final_score * blockWeight;
            totalWeight += blockWeight;
          }
        });
      });
      const weightedFinal = totalWeight > 0 ? parseFloat((total / totalWeight).toFixed(2)) : null;

      return {
        version: `v${s.version_number || 1}`,
        versionNum: s.version_number || 1,
        date: s.scoring_start_date || format(new Date(s.created_date), "yyyy-MM-dd"),
        weightedFinal,
        status: s.status,
        isClosed: s.is_closed,
        id: s.id
      };
    });
  }, [sortedHistory]);

  // Per-criterion trend data (for the detailed breakdown)
  const criterionTrend = useMemo(() => {
    if (sortedHistory.length === 0) return [];
    const firstScore = sortedHistory[0];
    const criteria = [];
    (firstScore.scoring_blocks || []).forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        criteria.push({
          id: crit.id,
          name: crit.name,
          blockName: block.name,
          scores: sortedHistory.map((s) => {
            const b = (s.scoring_blocks || []).find((bl) => bl.id === block.id);
            const c = b?.criteria?.find((cr) => cr.id === crit.id);
            return c?.final_score ?? null;
          })
        });
      });
    });
    return criteria;
  }, [sortedHistory]);

  // Filter all scores by search text + date range
  const filteredScores = useMemo(() => {
    if (!isSearchActive) return [];
    const q = searchText.trim().toLowerCase();
    const from = dateFrom ? parseISO(dateFrom) : null;
    const to = dateTo ? parseISO(dateTo) : null;

    return allScores.filter((s) => {
      // Text filter: firm name or product name
      if (q) {
        const firm = (s.firm_name || "").toLowerCase();
        const product = (s.product_name || "").toLowerCase();
        if (!firm.includes(q) && !product.includes(q)) return false;
      }
      // Date range filter: scoring_start_date within [from, to]
      if (s.scoring_start_date) {
        const d = parseISO(s.scoring_start_date);
        if (from && d < from) return false;
        if (to && d > to) return false;
      } else if (from || to) {
        return false; // no date, exclude when date filtering is active
      }
      return true;
    });
  }, [allScores, isSearchActive, searchText, dateFrom, dateTo]);

  // Toggle selection for a single score
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select / deselect all filtered closed scores
  const toggleSelectAll = () => {
    const closableIds = filteredScores.filter((s) => s.is_closed).map((s) => s.id);
    const allSelected = closableIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        closableIds.forEach((id) => next.delete(id));
      } else {
        closableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Bulk re-score mutation
  const bulkRescoreMutation = useMutation({
    mutationFn: async (scoresToRescore) => {
      const results = [];
      for (const prior of scoresToRescore) {
        // Fetch existing scores for this product+template to compute next version
        const existing = await base44.entities.ScoringMatrixScore.filter(
          { product_id: prior.product_id, template_id: prior.template_id },
          "-version_number", 100
        );
        const newScore = await createRescoreFromPrior(prior, existing);
        results.push(newScore);
      }
      return results;
    },
    onSuccess: (newScores) => {
      queryClient.invalidateQueries({ queryKey: ["scoringMatrixAllScores"] });
      // Invalidate each affected product's history
      const productTemplateKeys = new Set();
      newScores.forEach((s) => {
        productTemplateKeys.add(`${s.product_id}-${s.template_id}`);
      });
      productTemplateKeys.forEach((key) => {
        const [pid, tid] = key.split("-");
        queryClient.invalidateQueries({ queryKey: ["scoringMatrixHistory", pid, tid] });
      });
      toast({
        title: "Bulk re-scoring started",
        description: `${newScores.length} new scoring cycle${newScores.length !== 1 ? "s" : ""} created. Prior scores carried over as baselines.`
      });
      setSelectedIds(new Set());
      setBulkConfirmOpen(false);
    },
    onError: (err) => {
      toast({ title: "Bulk re-scoring failed", description: err?.message, variant: "destructive" });
    }
  });

  const handleSearch = () => {
    if (searchText.trim() || dateFrom || dateTo) {
      setIsSearchActive(true);
      setSelectedIds(new Set());
    } else {
      setIsSearchActive(false);
    }
  };

  const handleClearSearch = () => {
    setSearchText("");
    setDateFrom("");
    setDateTo("");
    setIsSearchActive(false);
    setSelectedIds(new Set());
  };

  const hasActiveFilters = searchText.trim() || dateFrom || dateTo;

  // Selected closed scores for bulk re-scoring
  const selectedScores = useMemo(() => {
    return filteredScores.filter((s) => selectedIds.has(s.id) && s.is_closed);
  }, [filteredScores, selectedIds]);

  const allFilteredClosableSelected = filteredScores.filter((s) => s.is_closed).length > 0 &&
    filteredScores.filter((s) => s.is_closed).every((s) => selectedIds.has(s.id));

  // ── Loading state ──
  if (isLoading && !isSearchActive) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Search / filter bar (always visible at top) ──
  const searchBar = (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600">Search Past Evaluations</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Text search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Filter by firm name or product..."
            className="w-full pl-8 pr-3 h-8 rounded-lg bg-white border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
          />
        </div>
        {/* Date from */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
          />
        </div>
        {/* Date to */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
          />
        </div>
        {/* Search / Clear buttons */}
        <Button size="sm" variant="default" className="h-8 bg-indigo-600 hover:bg-indigo-700" onClick={handleSearch}>
          <Search className="w-3.5 h-3.5" /> Search
        </Button>
        {hasActiveFilters && (
          <Button size="sm" variant="ghost" className="h-8 text-gray-500" onClick={handleClearSearch}>
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>
    </div>
  );

  // ── Search results mode ──
  if (isSearchActive) {
    return (
      <div className="space-y-4">
        {searchBar}

        {allScoresLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filteredScores.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            No evaluations match your search criteria.
          </div>
        ) : (
          <>
            {/* Bulk action bar */}
            <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-2.5 bg-white sticky top-0 z-10">
              <Checkbox
                checked={allFilteredClosableSelected}
                onCheckedChange={toggleSelectAll}
                disabled={filteredScores.filter((s) => s.is_closed).length === 0}
              />
              <span className="text-xs text-gray-600">
                {selectedScores.length > 0
                  ? `${selectedScores.length} selected for bulk re-scoring`
                  : `Select closed evaluations to re-score`}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {filteredScores.length} result{filteredScores.length !== 1 ? "s" : ""}
                </Badge>
                <Button
                  size="sm"
                  className="h-8 bg-indigo-600 hover:bg-indigo-700"
                  disabled={selectedScores.length === 0 || bulkRescoreMutation.isPending}
                  onClick={() => setBulkConfirmOpen(true)}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {bulkRescoreMutation.isPending
                    ? "Re-scoring..."
                    : `Bulk Re-score${selectedScores.length > 0 ? ` (${selectedScores.length})` : ""}`}
                </Button>
              </div>
            </div>

            {/* Search results list */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredScores.map((s) => {
                const isSelected = selectedIds.has(s.id);
                const canRescore = s.is_closed;
                // Compute weighted final for this version
                let weightedFinal = null;
                let totalWeight = 0;
                let totalScore = 0;
                (s.scoring_blocks || []).forEach((block) => {
                  const bw = (block.weight || 0) / 100;
                  (block.criteria || []).forEach((crit) => {
                    if (crit.final_score != null) {
                      totalScore += crit.final_score * bw;
                      totalWeight += bw;
                    }
                  });
                });
                if (totalWeight > 0) weightedFinal = (totalScore / totalWeight).toFixed(2);

                return (
                  <div
                    key={s.id}
                    className={`border rounded-lg p-3 transition-colors flex items-center gap-3 ${
                      isSelected ? "border-indigo-300 bg-indigo-50/50" : "border-gray-200 bg-white hover:bg-gray-50"
                    } ${!canRescore ? "opacity-60" : ""}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => canRescore && toggleSelect(s.id)}
                      disabled={!canRescore}
                    />
                    {/* Version badge */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 bg-gray-100 border-gray-300 text-gray-600">
                        v{s.version_number || 1}
                      </div>
                      {s.is_closed && <Lock className="w-3 h-3 text-gray-400" />}
                    </div>
                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{s.product_name || "—"}</span>
                        <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                        {!canRescore && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Not closed</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="truncate">{s.firm_name || "—"}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {s.scoring_start_date ? format(parseISO(s.scoring_start_date), "MMM d, yyyy") : "—"}
                          {s.scoring_end_date && <> → {format(parseISO(s.scoring_end_date), "MMM d, yyyy")}</>}
                        </span>
                        {weightedFinal != null && (
                          <span className="flex items-center gap-1 font-medium text-gray-700">
                            Final: <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border ${SCORE_COLORS[Math.round(weightedFinal)] || "border-gray-200"}`}>{weightedFinal}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Open button */}
                    {onOpenScore && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => onOpenScore(s.id)}
                      >
                        <FileText className="w-3.5 h-3.5" /> Open
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Bulk re-score confirmation dialog */}
        {bulkConfirmOpen && (
          <BulkRescoreConfirmDialog
            selectedScores={selectedScores}
            onConfirm={() => bulkRescoreMutation.mutate(selectedScores)}
            onCancel={() => setBulkConfirmOpen(false)}
            isPending={bulkRescoreMutation.isPending}
          />
        )}
      </div>
    );
  }

  // ── Default mode: single product history (existing view) ──
  if (sortedHistory.length === 0) {
    return (
      <div className="space-y-4">
        {searchBar}
        <div className="text-center py-8 text-sm text-gray-400">
          No scoring history available.
        </div>
      </div>
    );
  }

  const currentVersion = score.version_number || 1;

  return (
    <div className="space-y-4">
      {searchBar}

      {/* Summary header */}
      <div className="flex items-center gap-2 border-b pb-2">
        <History className="w-4 h-4 text-indigo-500" />
        <h4 className="text-sm font-semibold">Scoring History — {score.product_name}</h4>
        <Badge variant="secondary" className="text-xs ml-auto">
          {sortedHistory.length} version{sortedHistory.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium">Weighted Final Score Trend</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="version" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value, name) => [value != null ? value : "Not scored", name === "weightedFinal" ? "Weighted Final" : name]}
                labelFormatter={(label) => {
                  const item = chartData.find((d) => d.version === label);
                  return item ? `${label} — ${item.date}` : label;
                }}
              />
              <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="2 2" label={{ value: "Avg (3)", fontSize: 10, fill: "#94a3b8" }} />
              <Line
                type="monotone"
                dataKey="weightedFinal"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 5, fill: "#8b5cf6" }}
                activeDot={{ r: 7 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Version timeline */}
      <div className="space-y-2">
        {[...sortedHistory].reverse().map((s) => {
          const isCurrent = s.id === score.id;
          const vNum = s.version_number || 1;
          const daysElapsed = s.scoring_start_date && s.scoring_end_date
            ? differenceInDays(parseISO(s.scoring_end_date), parseISO(s.scoring_start_date))
            : null;

          // Compute weighted final for this version
          let weightedFinal = null;
          let totalWeight = 0;
          let totalScore = 0;
          (s.scoring_blocks || []).forEach((block) => {
            const bw = (block.weight || 0) / 100;
            (block.criteria || []).forEach((crit) => {
              if (crit.final_score != null) {
                totalScore += crit.final_score * bw;
                totalWeight += bw;
              }
            });
          });
          if (totalWeight > 0) weightedFinal = (totalScore / totalWeight).toFixed(2);

          return (
            <div
              key={s.id}
              className={`border rounded-lg p-3 transition-colors ${
                isCurrent ? "border-indigo-300 bg-indigo-50/50" : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Version badge */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      isCurrent ? "bg-indigo-100 border-indigo-400 text-indigo-700" : "bg-gray-100 border-gray-300 text-gray-600"
                    }`}>
                      v{vNum}
                    </div>
                    {s.is_closed && <Lock className="w-3 h-3 text-gray-400" />}
                  </div>

                  {/* Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {s.is_closed ? "Finalized Scoring" : "In Progress"}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                      {isCurrent && <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-700">Current View</Badge>}
                      {s.prior_score_id && (
                        <Badge variant="outline" className="text-[10px] flex items-center gap-0.5">
                          <GitBranch className="w-2.5 h-2.5" /> Re-scored from v{sortedHistory.find((h) => h.id === s.prior_score_id)?.version_number || "?"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {s.scoring_start_date ? format(parseISO(s.scoring_start_date), "MMM d, yyyy") : "—"}
                        {s.scoring_end_date && (
                          <> → {format(parseISO(s.scoring_end_date), "MMM d, yyyy")}</>
                        )}
                      </span>
                      {daysElapsed != null && (
                        <span className="text-gray-400">({daysElapsed} day{daysElapsed !== 1 ? "s" : ""})</span>
                      )}
                      {weightedFinal != null && (
                        <span className="flex items-center gap-1 font-medium text-gray-700">
                          Final: <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border ${SCORE_COLORS[Math.round(weightedFinal)] || "border-gray-200"}`}>{weightedFinal}</span>
                        </span>
                      )}
                    </div>
                    {s.primary_analyst_name && (
                      <p className="text-xs text-gray-400 mt-0.5">Analyst: {s.primary_analyst_name}</p>
                    )}
                  </div>
                </div>

                {/* Open button */}
                {!isCurrent && onOpenScore && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onOpenScore(s.id)}
                  >
                    <FileText className="w-3.5 h-3.5" /> Open
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-criterion trend table */}
      {criterionTrend.length > 0 && sortedHistory.length > 1 && (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <div className="px-3 py-2 bg-gray-50 border-b">
            <span className="text-sm font-medium">Per-Criterion Final Score Evolution</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="border-b">
                <th className="text-left p-2 font-medium text-gray-600 min-w-[200px]">Criterion</th>
                {sortedHistory.map((s) => (
                  <th key={s.id} className="text-center p-2 font-medium text-gray-600">
                    v{s.version_number || 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criterionTrend.map((crit) => (
                <tr key={crit.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <div className="font-medium">{crit.name}</div>
                    <div className="text-gray-400 text-[10px]">{crit.blockName}</div>
                  </td>
                  {crit.scores.map((s, i) => (
                    <td key={i} className="p-2 text-center">
                      {s != null ? (
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${SCORE_COLORS[s] || "border-gray-200"}`}>
                          {s}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk re-score confirmation dialog (also reachable from default mode if selections existed) */}
      {bulkConfirmOpen && (
        <BulkRescoreConfirmDialog
          selectedScores={selectedScores}
          onConfirm={() => bulkRescoreMutation.mutate(selectedScores)}
          onCancel={() => setBulkConfirmOpen(false)}
          isPending={bulkRescoreMutation.isPending}
        />
      )}
    </div>
  );
}

/**
 * Confirmation dialog for bulk re-scoring. Shows the list of selected scores
 * and warns that each will get a new version with prior scores as baseline.
 */
function BulkRescoreConfirmDialog({ selectedScores, onConfirm, onCancel, isPending }) {
  if (selectedScores.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Bulk Re-Scoring</h3>
            <p className="text-xs text-gray-500">
              Start {selectedScores.length} new scoring cycle{selectedScores.length !== 1 ? "s" : ""} at once
            </p>
          </div>
        </div>

        {/* Selected scores list */}
        <div className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-50 max-h-48 overflow-y-auto">
          <div className="space-y-1.5">
            {selectedScores.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <Badge variant="secondary" className="text-[10px]">v{s.version_number || 1}</Badge>
                <span className="font-medium truncate flex-1">{s.product_name}</span>
                <span className="text-gray-400 truncate">{s.firm_name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* What happens explanation */}
        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-700">
            This will create <span className="font-semibold">{selectedScores.length} new scoring version{selectedScores.length !== 1 ? "s" : ""}</span>, each with:
          </p>
          <ul className="space-y-1.5 text-xs text-gray-600 ml-1">
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span>Prior final scores and notes carried over as a <strong>starting baseline</strong> for the primary analyst to adjust.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span>All workflow flags reset — each new scoring starts at the primary scoring phase.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span>A new scoring start date set to today.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span>Prior scorings remain <strong>closed and unchanged</strong> for historical tracking.</span>
            </li>
          </ul>
        </div>

        {/* Warning */}
        <div className="border border-amber-200 rounded-lg p-3 mb-4 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              {selectedScores.length} manager product{selectedScores.length !== 1 ? "s" : ""} will be re-evaluated. Make sure you intend to re-score all of them before proceeding.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Re-scoring {selectedScores.length}...</>
            ) : (
              <><Layers className="w-3.5 h-3.5" /> Start {selectedScores.length} Re-Score{selectedScores.length !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}