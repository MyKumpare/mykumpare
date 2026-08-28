import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, CheckCircle2, Circle, ChevronDown, ChevronRight, Sparkles, Loader2, FileText, Download, Brain, History, GitBranch, Lock, Calendar, AlertTriangle, PlusCircle, MinusCircle, Info, ToggleLeft, ToggleRight, Camera, Paperclip, Award, Star } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip
} from "recharts";
import { format } from "date-fns";
import ScoringMatrixComparisonTable from "@/components/templates/ScoringMatrixComparisonTable";
import ScoringMatrixAuditPanel from "@/components/templates/ScoringMatrixAuditPanel";
import ScoringMatrixHistoryTab from "@/components/templates/ScoringMatrixHistoryTab";
import ScoringMatrixSnapshotsTab from "@/components/templates/ScoringMatrixSnapshotsTab";
import ScoringAttachmentsManager from "@/components/templates/ScoringAttachmentsManager";
import { computeOverallRating } from "@/components/templates/scoringRatingLogic";
import { computeWeightedScoreMulti, effectiveAdjustedPrimary, effectiveFinalScore } from "@/components/templates/scoringWeightLogic";
import RescoreConfirmDialog from "@/components/templates/RescoreConfirmDialog";
import ClosedScoringEditWarning from "@/components/templates/ClosedScoringEditWarning";
import FinalizeGuardDialog from "@/components/templates/FinalizeGuardDialog";
import { exportScoringMatrixComparisonPdf } from "@/components/templates/scoringMatrixComparisonPdf";
import { exportScoringMatrixScorecardPdf } from "@/components/templates/scoringMatrixScorecardPdf";
import { createScoringNotification } from "@/components/templates/scoringNotificationHelper";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300"
};

function ScoreCell({ score, onChange, disabled, placeholder = "—" }) {
  return (
    <Select value={score?.toString() || ""} onValueChange={(v) => onChange(parseInt(v))} disabled={disabled}>
      <SelectTrigger className="h-8 w-16 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {[1, 2, 3, 4, 5].map((n) => (
          <SelectItem key={n} value={n.toString()}>
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold border ${SCORE_COLORS[n]}`}>{n}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BonusPenaltyCell({ criterion, templateCriteria, isPrimaryAnalyst, isClosed, onUpdate }) {
  const [showGuidance, setShowGuidance] = useState(false);
  const templateCrit = templateCriteria?.[criterion.id];

  if (!templateCrit?.bonus_penalty_enabled) return null;

  const range = templateCrit.bonus_penalty_range || { min: -1, max: 1 };
  const isActive = criterion.bonus_penalty_active;
  const value = criterion.bonus_penalty_value;
  const guidance = templateCrit.bonus_penalty_guidance || "";

  const clampValue = (v) => {
    if (v == null || isNaN(v)) return 0;
    return Math.max(range.min, Math.min(range.max, v));
  };

  const handleToggle = () => {
    if (isClosed || !isPrimaryAnalyst) return;
    onUpdate({ bonus_penalty_active: !isActive, bonus_penalty_value: !isActive ? 0 : criterion.bonus_penalty_value });
  };

  const handleValueChange = (v) => {
    const clamped = clampValue(parseFloat(v));
    onUpdate({ bonus_penalty_value: clamped });
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isClosed || !isPrimaryAnalyst}
          className={`p-0.5 rounded text-xs ${isActive ? "text-indigo-600 bg-indigo-50 border border-indigo-200" : "text-gray-400 border border-gray-200"} ${(isClosed || !isPrimaryAnalyst) ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-100"}`}
          title={isActive ? "Deactivate bonus/penalty" : "Activate bonus/penalty"}
        >
          {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        </button>
        {isActive && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleValueChange((value || 0) - 0.5)}
              disabled={isClosed || !isPrimaryAnalyst}
              className="p-0.5 rounded hover:bg-red-100 text-red-500 disabled:opacity-30"
              title="Decrease"
            >
              <MinusCircle className="w-3.5 h-3.5" />
            </button>
            <Input
              type="number"
              step="0.5"
              value={value ?? 0}
              onChange={(e) => handleValueChange(e.target.value)}
              disabled={isClosed || !isPrimaryAnalyst}
              className="h-7 w-14 text-xs text-center"
            />
            <button
              type="button"
              onClick={() => handleValueChange((value || 0) + 0.5)}
              disabled={isClosed || !isPrimaryAnalyst}
              className="p-0.5 rounded hover:bg-green-100 text-green-500 disabled:opacity-30"
              title="Increase"
            >
              <PlusCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowGuidance(!showGuidance)}
          className="p-0.5 text-gray-400 hover:text-indigo-600"
          title="Show guidance"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
      {showGuidance && guidance && (
        <div className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded p-1.5 max-w-[200px] mt-0.5">
          {guidance}
        </div>
      )}
      {isActive && (
        <div className="text-[10px] font-medium mt-0.5" style={{ color: (value || 0) > 0 ? "#166534" : (value || 0) < 0 ? "#991b1b" : "#6b7280" }}>
          {(value || 0) > 0 ? "+" : ""}{value || 0}
        </div>
      )}
    </div>
  );
}

function DeviationCell({ baseScore, compareScore }) {
  if (compareScore == null || baseScore == null) return <span className="text-xs text-gray-300">—</span>;
  const diff = compareScore - baseScore;
  if (diff === 0) return <span className="text-xs text-gray-500">{compareScore}</span>;
  const intensity = Math.min(Math.abs(diff) / 4, 1);
  const bg = diff > 0 ? `rgba(34, 197, 94, ${0.15 + intensity * 0.35})` : `rgba(239, 68, 68, ${0.15 + intensity * 0.35})`;
  const text = diff > 0 ? "text-green-800" : "text-red-800";
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${text}`} style={{ background: bg }}>
      {compareScore} ({diff > 0 ? "+" : ""}{diff})
    </span>
  );
}

function ScoreRadarChart({ blocks, columns }) {
  const [visible, setVisible] = useState(() => new Set(columns.map((c) => c.key)));

  const data = useMemo(() => {
    const criteria = [];
    blocks.forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        const point = { criterion: crit.name || `#${crit.number}` };
        columns.forEach((col) => {
          point[col.key] = col.getValue(crit) || 0;
        });
        criteria.push(point);
      });
    });
    return criteria;
  }, [blocks, columns]);

  // Keep the visible set in sync when the available columns change (phase toggles)
  useEffect(() => {
    setVisible((prev) => {
      const valid = new Set(columns.map((c) => c.key));
      const kept = new Set([...prev].filter((k) => valid.has(k)));
      return kept.size > 0 ? kept : new Set(columns.map((c) => c.key));
    });
  }, [columns]);

  const visibleCols = columns.filter((c) => visible.has(c.key));

  const toggle = (key) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // always keep at least one series
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Difference mode: exactly two series selected → show what changed between them.
  // The later series (by column order) is compared against the earlier one.
  const diffMode = visibleCols.length === 2;
  const [fromCol, toCol] = visibleCols;

  const diffData = useMemo(() => {
    if (!diffMode) return null;
    return data.map((d) => {
      const diff = (d[toCol.key] || 0) - (d[fromCol.key] || 0);
      return {
        ...d,
        diff,
        diffPos: Math.max(0, diff),      // green spike magnitude (increase)
        diffNegAbs: Math.max(0, -diff),  // red spike magnitude (decrease, plotted as absolute)
      };
    });
  }, [data, diffMode, fromCol, toCol]);

  return (
    <div>
      <ResponsiveContainer width="100%" height={380}>
        <RadarChart data={diffMode ? diffData : data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 9 }} />
          <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
          {!diffMode && visibleCols.map((col) => (
            <Radar key={col.key} name={col.label} dataKey={col.key} stroke={col.color} fill={col.color} fillOpacity={0.15} />
          ))}
          {diffMode && (
            <>
              <Radar key={fromCol.key} name={fromCol.label} dataKey={fromCol.key} stroke={fromCol.color} fill={fromCol.color} fillOpacity={0.05} strokeOpacity={0.5} />
              <Radar key={toCol.key} name={toCol.label} dataKey={toCol.key} stroke={toCol.color} fill={toCol.color} fillOpacity={0.05} strokeOpacity={0.5} />
              <Radar name="Increase" dataKey="diffPos" stroke="#10b981" fill="#10b981" fillOpacity={0.45} />
              <Radar name="Decrease" dataKey="diffNegAbs" stroke="#ef4444" fill="#ef4444" fillOpacity={0.45} />
            </>
          )}
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>

      {/* Clickable legend — click a series to show/hide it; select exactly two to compare */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
        {columns.map((col) => {
          const on = visible.has(col.key);
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => toggle(col.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition ${
                on
                  ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  : "border-gray-200 bg-gray-50 text-gray-400 line-through"
              }`}
              title={on ? `Hide ${col.label}` : `Show ${col.label}`}
            >
              <span className="w-3 h-3 rounded-sm" style={{ background: on ? col.color : "#cbd5e1" }} />
              {col.label}
            </button>
          );
        })}
      </div>

      {diffMode && (
        <div className="flex flex-wrap items-center justify-center gap-4 mt-2 text-xs">
          <span className="text-gray-500">
            Difference ({toCol.label} − {fromCol.label}):
          </span>
          <span className="inline-flex items-center gap-1 text-green-700">
            <span className="w-3 h-3 rounded-sm bg-green-500" /> Increased
          </span>
          <span className="inline-flex items-center gap-1 text-red-700">
            <span className="w-3 h-3 rounded-sm bg-red-500" /> Decreased
          </span>
        </div>
      )}
    </div>
  );
}

export default function ScoringMatrixScoreCard({ scoreId, dueDiligence, template, currentUser, onBack, onOpenScore }) {
  const queryClient = useQueryClient();
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [activeTab, setActiveTab] = useState("scoring");
  // Tabs: scoring | chart | comparison | audit | history
  const [showRescoreDialog, setShowRescoreDialog] = useState(false);
  const [showClosedWarning, setShowClosedWarning] = useState(false);
  // Pre-finalize guard: { scoreField, label, phase } | null
  const [finalizeGuard, setFinalizeGuard] = useState(null);
  const [editReopened, setEditReopened] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingScorecard, setIsExportingScorecard] = useState(false);

  const { data: score, isLoading } = useQuery({
    queryKey: ["scoringMatrixScore", scoreId],
    queryFn: () => base44.entities.ScoringMatrixScore.get(scoreId),
    enabled: !!scoreId
  });

  // Fetch peer benchmark (average historic final scores from similar investment managers)
  const { data: benchmark, isLoading: isLoadingBenchmark } = useQuery({
    queryKey: ["benchmarkScores", score?.product_id, score?.template_id],
    queryFn: () => base44.functions.invoke("getBenchmarkScores", {
      product_id: score.product_id,
      template_id: score.template_id,
      firm_id: score.firm_id
    }),
    enabled: !!score?.product_id && !!score?.template_id && activeTab === "comparison"
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ScoringMatrixScore.update(scoreId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoringMatrixScore", scoreId] });
      queryClient.invalidateQueries({ queryKey: ["scoringMatrixHistory", score?.product_id, score?.template_id] });
    },
    onError: (err) => toast({ title: "Save failed", description: err?.message, variant: "destructive" })
  });

  const toggleBlock = (id) => setExpandedBlocks((p) => ({ ...p, [id]: !p[id] }));

  // Build a lookup of template criteria (by id) to access bonus/penalty config
  const templateCriteria = useMemo(() => {
    const map = {};
    (template?.scoring_blocks || []).forEach((block) => {
      (block.criteria || []).forEach((c) => {
        map[c.id] = c;
      });
    });
    return map;
  }, [template]);

  // Whether the scoring is closed (finalized + is_closed) and not yet reopened for editing
  const isClosed = score?.is_closed === true && !editReopened;

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!score) return <div className="text-center py-8 text-sm text-gray-400">Score record not found.</div>;

  const blocks = score.scoring_blocks || [];
  const isPrimaryAnalyst = currentUser?.linked_contact_id === score.primary_analyst_contact_id;
  const isSecondaryAnalyst = currentUser?.linked_contact_id === score.secondary_analyst_contact_id;

  const updateCriterion = (blockId, critId, updates) => {
    const block = blocks.find((b) => b.id === blockId);
    const crit = block?.criteria?.find((c) => c.id === critId);
    const newBlocks = blocks.map((b) => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        criteria: (b.criteria || []).map((c) => (c.id === critId ? { ...c, ...updates } : c))
      };
    });
    updateMutation.mutate({ scoring_blocks: newBlocks });

    // Create a notification when a score value (not notes) is changed
    const scoreFields = ["primary_score", "secondary_score", "team_score", "ic_score", "final_score", "adjusted_primary_score"];
    const changedScoreField = scoreFields.find((f) => updates[f] !== undefined);
    if (changedScoreField && crit) {
      const phaseLabel = changedScoreField === "primary_score" ? "Primary"
        : changedScoreField === "secondary_score" ? "Secondary"
        : changedScoreField === "team_score" ? "Team Review"
        : changedScoreField === "ic_score" ? "IC Review"
        : changedScoreField === "adjusted_primary_score" ? "Adjusted Primary"
        : "Final";
      createScoringNotification(score, "score_updated", currentUser, {
        phase: phaseLabel,
        criterionName: crit.name || `#${crit.number}`,
        description: `${phaseLabel} score updated for "${crit.name || `#${crit.number}`}" on ${score.product_name}`,
      }).catch(() => {});
    }
  };

  const updateAllCriteria = (updates) => {
    const newBlocks = blocks.map((b) => ({
      ...b,
      criteria: (b.criteria || []).map((c) => ({ ...c, ...updates(c) }))
    }));
    updateMutation.mutate({ scoring_blocks: newBlocks });
  };

  // Confirm the finalize after the guard dialog verifies all items are scored
  const confirmFinalizeGuard = () => {
    const phase = finalizeGuard?.phase;
    const fn = phase === "primary" ? finalizePrimary
      : phase === "team" ? finalizeTeamReview
      : phase === "ic" ? finalizeICReview
      : null;
    setFinalizeGuard(null);
    fn?.();
  };

  // Phase transitions
  const finalizePrimary = () => {
    updateMutation.mutate({
      primary_score_finalized: true,
      status: score.secondary_scoring_enabled ? "secondary_scoring" : "team_review",
      team_review_status: score.secondary_scoring_enabled ? "not_started" : "not_started"
    });
    createScoringNotification(score, "phase_finalized", currentUser, { phase: "Primary" }).catch(() => {});
    toast({ title: "Primary scores finalized" });
  };

  const enableSecondaryScoring = (secondaryContactId, secondaryName) => {
    updateMutation.mutate({
      secondary_analyst_contact_id: secondaryContactId,
      secondary_analyst_name: secondaryName,
      secondary_scoring_enabled: true,
      secondary_scoring_status: "pending"
    });
    // Create notification for secondary analyst
    base44.entities.DdNotification.create({
      contact_id: secondaryContactId,
      type: "coverage_assignment",
      title: "Scoring Matrix Assignment",
      message: `You have been assigned to score ${score.product_name} using the ${score.template_name} scoring matrix.`,
      due_diligence_id: score.due_diligence_id,
      firm_name: score.firm_name,
      product_name: score.product_name
    });
    toast({ title: "Secondary analyst notified" });
  };

  const finalizeTeamReview = () => {
    // Auto-populate adjusted_primary_score for every criterion:
    //  - accepted team rec → team_score
    //  - no accepted adjustment → primary analyst's score
    const newBlocks = blocks.map((b) => ({
      ...b,
      criteria: (b.criteria || []).map((c) => ({
        ...c,
        adjusted_primary_score: c.team_status === "accepted"
          ? (c.team_score ?? c.primary_score)
          : (c.adjusted_primary_score ?? c.primary_score)
      }))
    }));
    updateMutation.mutate({
      scoring_blocks: newBlocks,
      team_review_status: "completed",
      adjusted_primary_finalized: true,
      status: "ic_review"
    });
    createScoringNotification(score, "phase_finalized", currentUser, { phase: "Team Review" }).catch(() => {});
    toast({ title: "Team review completed — adjusted primary scores finalized" });
  };

  const finalizeICReview = () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    // Auto-populate adjusted_primary_score and final_score for every criterion:
    //  - adjusted primary = accepted team rec ? team_score : primary score
    //  - final = accepted IC rec ? ic_score : adjusted primary
    const newBlocks = blocks.map((b) => ({
      ...b,
      criteria: (b.criteria || []).map((c) => {
        const adjPrimary = c.team_status === "accepted"
          ? (c.team_score ?? c.primary_score)
          : (c.adjusted_primary_score ?? c.primary_score);
        const final = c.ic_status === "accepted"
          ? (c.ic_score ?? adjPrimary)
          : (c.final_score ?? adjPrimary);
        return { ...c, adjusted_primary_score: adjPrimary, final_score: final };
      })
    }));
    const wfNum = computeWeightedScoreMulti(newBlocks, "final_score", {
      applyBonusPenalty: true,
      mode: "perCriterion"
    });
    const rating = computeOverallRating(wfNum, template?.rating_config);
    updateMutation.mutate({
      scoring_blocks: newBlocks,
      ic_review_status: "completed",
      final_score_finalized: true,
      status: "finalized",
      scoring_end_date: todayStr,
      is_closed: true,
      overall_rating: rating.ratingLabel,
      overall_pass_fail: rating.passFail,
      rating_assigned_at: new Date().toISOString()
    });
    setEditReopened(false);
    createScoringNotification(score, "scoring_completed", currentUser, { phase: "Final" }).catch(() => {});
    // Real-time threshold check: raise an alert if this firm's weighted final
    // score falls below its configured per-firm threshold.
    base44.functions.invoke("checkScoringThresholds", { score_id: scoreId }).catch(() => {});
    toast({ title: "Scoring matrix finalized", description: `Scoring closed on ${todayStr}. Use "Start Re-Scoring" to create a new version.` });
  };

  // Reopen a closed scoring for editing (with warning already confirmed)
  const reopenClosedScoring = () => {
    updateMutation.mutate({
      is_closed: false,
      status: "ic_review",
      ic_review_status: "in_progress",
      final_score_finalized: false,
      scoring_end_date: ""
    });
    setEditReopened(true);
    setShowClosedWarning(false);
    createScoringNotification(score, "scoring_reopened", currentUser, { phase: "IC Review" }).catch(() => {});
    toast({ title: "Scoring reopened", description: "The closed scoring is now editable. Re-finalize to close it again.", variant: "destructive" });
  };

  // Start re-scoring from this closed scoring
  const handleRescoreCreated = (newScoreId) => {
    setShowRescoreDialog(false);
    if (onOpenScore) {
      onOpenScore(newScoreId);
    } else {
      // Fallback: invalidate and switch to the new score
      queryClient.invalidateQueries({ queryKey: ["scoringMatrixScore", newScoreId] });
    }
  };

  // Export comparison table as PDF
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportScoringMatrixComparisonPdf({
        score,
        blocks,
        showFlags: { showSecondary, showTeam, showAdjustedPrimary, showIC, showFinal }
      });
      toast({ title: "PDF exported", description: "The scoring matrix comparison has been downloaded." });
    } catch (err) {
      toast({ title: "PDF export failed", description: err?.message, variant: "destructive" });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export individual firm scorecard as PDF (includes bonus/penalty adjustments)
  const handleExportScorecardPdf = async () => {
    setIsExportingScorecard(true);
    try {
      await exportScoringMatrixScorecardPdf({
        score,
        blocks,
        template,
        showFlags: { showSecondary, showTeam, showAdjustedPrimary, showIC, showFinal }
      });
      toast({ title: "Scorecard exported", description: "The firm scorecard PDF has been downloaded." });
    } catch (err) {
      toast({ title: "PDF export failed", description: err?.message, variant: "destructive" });
    } finally {
      setIsExportingScorecard(false);
    }
  };

  // Initialize team scores from primary scores
  const initTeamScores = () => {
    updateAllCriteria((c) => ({
      team_score: c.team_score ?? c.primary_score,
      team_status: c.team_status || "pending"
    }));
    updateMutation.mutate({ team_review_status: "in_progress" });
    toast({ title: "Team review started — scores initialized from primary" });
  };

  // Initialize IC scores from adjusted primary scores
  const initICScores = () => {
    updateAllCriteria((c) => ({
      ic_score: c.ic_score ?? c.adjusted_primary_score ?? c.primary_score,
      ic_status: c.ic_status || "pending"
    }));
    updateMutation.mutate({ ic_review_status: "in_progress" });
    toast({ title: "IC review started — scores initialized from adjusted primary" });
  };

  const acceptTeamScore = (blockId, critId) => {
    const block = blocks.find((b) => b.id === blockId);
    const crit = block?.criteria?.find((c) => c.id === critId);
    updateCriterion(blockId, critId, {
      team_status: "accepted",
      adjusted_primary_score: crit?.team_score,
      adjusted_primary_notes: crit?.team_notes || "Accepted team recommendation."
    });
  };

  const rejectTeamScore = (blockId, critId) => {
    const block = blocks.find((b) => b.id === blockId);
    const crit = block?.criteria?.find((c) => c.id === critId);
    updateCriterion(blockId, critId, {
      team_status: "rejected",
      adjusted_primary_score: crit?.primary_score,
      adjusted_primary_notes: "Kept primary score."
    });
  };

  const acceptICScore = (blockId, critId) => {
    const block = blocks.find((b) => b.id === blockId);
    const crit = block?.criteria?.find((c) => c.id === critId);
    updateCriterion(blockId, critId, {
      ic_status: "accepted",
      final_score: crit?.ic_score,
      final_notes: crit?.ic_notes || "Accepted IC recommendation."
    });
  };

  const rejectICScore = (blockId, critId) => {
    const block = blocks.find((b) => b.id === blockId);
    const crit = block?.criteria?.find((c) => c.id === critId);
    updateCriterion(blockId, critId, {
      ic_status: "rejected",
      final_score: crit?.adjusted_primary_score ?? crit?.primary_score,
      final_notes: "Kept adjusted primary score."
    });
  };

  // Compute weighted totals, applying bonus/penalty adjustments to the final
  // score and honoring optional block/criterion multiplier factors (normalized
  // to 100% total). Multipliers default to 1, so templates without them behave
  // exactly as before.
  const computeTotals = (scoreField) => {
    const opts = { applyBonusPenalty: scoreField === "final_score", mode: "perCriterion" };
    if (scoreField === "adjusted_primary_score") opts.getValue = effectiveAdjustedPrimary;
    if (scoreField === "final_score") opts.getValue = effectiveFinalScore;
    const val = computeWeightedScoreMulti(blocks, scoreField, opts);
    return val != null ? val.toFixed(2) : "—";
  };

  // Numeric weighted final score (with bonus/penalty applied) for rating auto-assignment
  const computeWeightedFinalScoreNum = () =>
    computeWeightedScoreMulti(blocks, "final_score", {
      applyBonusPenalty: true,
      mode: "perCriterion",
      getValue: effectiveFinalScore
    });

  const columns = [
    { key: "primary_score", label: "Primary", color: "#3b82f6", getValue: (c) => c.primary_score },
    { key: "team_score", label: "Team", color: "#f59e0b", getValue: (c) => c.team_score },
    { key: "adjusted_primary_score", label: "Adj. Primary", color: "#8b5cf6", getValue: effectiveAdjustedPrimary },
    { key: "ic_score", label: "IC", color: "#ec4899", getValue: (c) => c.ic_score },
    { key: "final_score", label: "Final", color: "#10b981", getValue: effectiveFinalScore }
  ];

  const showSecondary = score.secondary_scoring_enabled;
  const showTeam = score.primary_score_finalized;
  const showAdjustedPrimary = score.team_review_status === "in_progress" || score.team_review_status === "completed" || score.adjusted_primary_finalized;
  const showIC = score.adjusted_primary_finalized;
  const showFinal = score.ic_review_status === "in_progress" || score.ic_review_status === "completed" || score.final_score_finalized;

  // Overall rating auto-assigned from the weighted final score + template rating config
  const weightedFinalScoreNum = computeWeightedFinalScoreNum();
  const overallRating = computeOverallRating(weightedFinalScoreNum, template?.rating_config);
  const ratingConfig = template?.rating_config;
  const hasRatingConfig = !!(ratingConfig && (ratingConfig.pass_fail_enabled || ratingConfig.rating_enabled));

  // Update the attachments array on the score record
  const updateAttachments = (newAttachments) => {
    updateMutation.mutate({ attachments: newAttachments });
  };
  const canEditAttachments = isPrimaryAnalyst && !isClosed;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{score.template_name}</h3>
            <Badge variant="secondary" className="text-xs">v{score.version_number || 1}</Badge>
            {isClosed && (
              <Badge variant="outline" className="text-xs text-gray-500 border-gray-300 flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> Closed
              </Badge>
            )}
            {score.prior_score_id && (
              <Badge variant="outline" className="text-xs flex items-center gap-0.5">
                <GitBranch className="w-2.5 h-2.5" /> Re-scored
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">{score.firm_name} — {score.product_name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">Status: {score.status}</Badge>
            {score.scoring_start_date && (
              <Badge variant="outline" className="text-xs text-gray-500 flex items-center gap-0.5">
                <Calendar className="w-2.5 h-2.5" /> {format(new Date(score.scoring_start_date), "MMM d, yyyy")}
                {score.scoring_end_date && <> → {format(new Date(score.scoring_end_date), "MMM d, yyyy")}</>}
              </Badge>
            )}
            {score.primary_analyst_name && <Badge variant="secondary" className="text-xs">Primary: {score.primary_analyst_name}</Badge>}
            {showSecondary && score.secondary_analyst_name && (
              <Badge variant="secondary" className="text-xs">Secondary: {score.secondary_analyst_name} ({score.secondary_scoring_status})</Badge>
            )}
          </div>
          {hasRatingConfig && (showFinal || score.final_score_finalized) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {ratingConfig.pass_fail_enabled && (
                <Badge
                  variant="outline"
                  className={`text-xs flex items-center gap-1 ${overallRating.passFail === "Pass" ? "border-green-300 text-green-700 bg-green-50" : overallRating.passFail === "Fail" ? "border-red-300 text-red-700 bg-red-50" : "text-gray-400"}`}
                >
                  <Award className="w-3 h-3" />
                  {overallRating.passFail || "—"}
                </Badge>
              )}
              {ratingConfig.rating_enabled && (
                <Badge
                  variant="outline"
                  className="text-xs flex items-center gap-1"
                  style={overallRating.ratingColor ? { borderColor: overallRating.ratingColor, color: overallRating.ratingColor, backgroundColor: `${overallRating.ratingColor}15` } : undefined}
                >
                  <Star className="w-3 h-3" />
                  {overallRating.ratingLabel || "—"}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs text-gray-500">
                Weighted Final: {weightedFinalScoreNum != null ? weightedFinalScoreNum.toFixed(2) : "—"}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => setActiveTab("scoring")}>Scoring</Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab("chart")}>Radar Chart</Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab("comparison")}>Comparison</Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab("audit")} className="text-purple-600 border-purple-200 hover:bg-purple-50">
            <Brain className="w-3.5 h-3.5" /> AI Audit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab("history")} className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
            <History className="w-3.5 h-3.5" /> History
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab("snapshots")} className="text-teal-600 border-teal-200 hover:bg-teal-50">
            <Camera className="w-3.5 h-3.5" /> Snapshots
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab("attachments")} className="text-cyan-600 border-cyan-200 hover:bg-cyan-50">
            <Paperclip className="w-3.5 h-3.5" /> Attachments
          </Button>
          {isClosed && (
            <Button variant="outline" size="sm" onClick={() => setShowRescoreDialog(true)} className="text-indigo-600 border-indigo-300 hover:bg-indigo-50">
              <GitBranch className="w-3.5 h-3.5" /> Re-Score
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportScorecardPdf} disabled={isExportingScorecard} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            {isExportingScorecard ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
            ) : (
              <><FileText className="w-3.5 h-3.5" /> Export Scorecard</>
            )}
          </Button>
          {onBack && <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>}
        </div>
      </div>

      {/* Closed scoring warning banner */}
      {isClosed && (
        <div className="border border-amber-200 rounded-lg p-3 bg-amber-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">This scoring is finalized and closed</p>
              <p className="text-xs text-amber-600">
                Editing is locked. Use "Re-Score" to create a new version from this baseline, or reopen to edit directly.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowClosedWarning(true)} className="border-amber-400 text-amber-700 hover:bg-amber-100 text-xs">
              <AlertTriangle className="w-3 h-3" /> Reopen to Edit
            </Button>
          </div>
        </div>
      )}

      {/* Scoring Tab */}
      {activeTab === "scoring" && (
        <div className="space-y-3">
          {/* Phase action buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            {isPrimaryAnalyst && !score.primary_score_finalized && (
              <Button size="sm" onClick={() => setFinalizeGuard({ scoreField: "primary_score", label: "Primary", phase: "primary" })} disabled={updateMutation.isPending}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Finalize Primary Scores
              </Button>
            )}
            {isPrimaryAnalyst && score.primary_score_finalized && !score.secondary_scoring_enabled && !showIC && (
              <Button size="sm" variant="outline" onClick={initTeamScores}>
                Start Team Review
              </Button>
            )}
            {isPrimaryAnalyst && showTeam && score.team_review_status === "in_progress" && (
              <Button size="sm" onClick={() => setFinalizeGuard({ scoreField: "adjusted_primary_score", label: "Adjusted Primary", phase: "team" })} disabled={updateMutation.isPending}>
                Finalize Adjusted Primary (End Team Review)
              </Button>
            )}
            {isPrimaryAnalyst && score.adjusted_primary_finalized && !score.final_score_finalized && (
              <Button size="sm" variant="outline" onClick={initICScores}>
                Start IC Review
              </Button>
            )}
            {isPrimaryAnalyst && showIC && score.ic_review_status === "in_progress" && (
              <Button size="sm" onClick={() => setFinalizeGuard({ scoreField: "final_score", label: "Final", phase: "ic" })} disabled={updateMutation.isPending}>
                Finalize Scoring Matrix
              </Button>
            )}
          </div>

          {/* Scoring table */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-gray-600 min-w-[200px]">Criterion</th>
                  <th className="text-center p-2 font-medium text-gray-600">Primary</th>
                  {showSecondary && <th className="text-center p-2 font-medium text-gray-600">Secondary</th>}
                  {showTeam && <th className="text-center p-2 font-medium text-gray-600">Team Rec.</th>}
                  {showTeam && <th className="text-center p-2 font-medium text-gray-600">Δ</th>}
                  {showAdjustedPrimary && <th className="text-center p-2 font-medium text-gray-600">Adj. Primary</th>}
                  {showIC && <th className="text-center p-2 font-medium text-gray-600">IC Rec.</th>}
                  {showIC && <th className="text-center p-2 font-medium text-gray-600">Δ</th>}
                  {showFinal && <th className="text-center p-2 font-medium text-gray-600">Final</th>}
                  {showFinal && <th className="text-center p-2 font-medium text-gray-600">Bonus/Penalty</th>}
                  <th className="text-left p-2 font-medium text-gray-600 min-w-[150px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <React.Fragment key={block.id}>
                    <tr className="bg-gray-100 cursor-pointer hover:bg-gray-200" onClick={() => toggleBlock(block.id)}>
                      <td colSpan={showFinal ? 12 : showIC ? 9 : showAdjustedPrimary ? 7 : showTeam ? 5 : showSecondary ? 4 : 3} className="p-2 font-semibold text-gray-700">
                        <div className="flex items-center gap-1.5">
                          {expandedBlocks[block.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          {block.name} <span className="text-gray-400 font-normal">({block.weight}%)</span>
                        </div>
                      </td>
                    </tr>
                    {expandedBlocks[block.id] && (block.criteria || []).map((crit) => (
                      <tr key={crit.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div className="flex items-start gap-1">
                            <div className="flex-1">
                              <div className="font-medium">{crit.name}</div>
                              {crit.category && <div className="text-gray-400 text-[10px]">{crit.category}</div>}
                            </div>
                            <ScoringAttachmentsManager
                              attachments={score.attachments}
                              scope={crit.id}
                              canEdit={canEditAttachments}
                              onUpdate={updateAttachments}
                              compact
                              userName={currentUser?.full_name}
                            />
                          </div>
                        </td>
                        {/* Primary score */}
                        <td className="p-2 text-center">
                          <ScoreCell
                            score={crit.primary_score}
                            onChange={(v) => updateCriterion(block.id, crit.id, { primary_score: v })}
                            disabled={!isPrimaryAnalyst || score.primary_score_finalized}
                          />
                        </td>
                        {/* Secondary score */}
                        {showSecondary && (
                          <td className="p-2 text-center">
                            <ScoreCell
                              score={crit.secondary_score}
                              onChange={(v) => updateCriterion(block.id, crit.id, { secondary_score: v })}
                              disabled={!isSecondaryAnalyst || score.secondary_scoring_status === "completed"}
                            />
                          </td>
                        )}
                        {/* Team recommended score */}
                        {showTeam && (
                          <>
                            <td className="p-2 text-center">
                              {isPrimaryAnalyst ? (
                                <ScoreCell
                                  score={crit.team_score}
                                  onChange={(v) => updateCriterion(block.id, crit.id, { team_score: v })}
                                  disabled={score.team_review_status === "completed"}
                                />
                              ) : (
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${crit.team_score ? SCORE_COLORS[crit.team_score] : "border-gray-200"}`}>
                                  {crit.team_score || "—"}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <DeviationCell baseScore={crit.primary_score} compareScore={crit.team_score} />
                            </td>
                          </>
                        )}
                        {/* Adjusted primary */}
                        {showAdjustedPrimary && (
                          <td className="p-2 text-center">
                            {isPrimaryAnalyst && score.team_review_status === "in_progress" ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => acceptTeamScore(block.id, crit.id)} className="p-1 rounded hover:bg-green-100 text-green-600" title="Accept team score">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => rejectTeamScore(block.id, crit.id)} className="p-1 rounded hover:bg-red-100 text-red-600" title="Reject team score">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              (() => {
                                const adj = effectiveAdjustedPrimary(crit);
                                return (
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${adj ? SCORE_COLORS[adj] : "border-gray-200"}`}>
                                    {adj || "—"}
                                  </span>
                                );
                              })()
                            )}
                            {crit.team_status === "accepted" && <div className="text-[10px] text-green-600 mt-0.5">accepted</div>}
                            {crit.team_status === "rejected" && <div className="text-[10px] text-red-600 mt-0.5">rejected</div>}
                          </td>
                        )}
                        {/* IC recommended score */}
                        {showIC && (
                          <>
                            <td className="p-2 text-center">
                              {isPrimaryAnalyst ? (
                                <ScoreCell
                                  score={crit.ic_score}
                                  onChange={(v) => updateCriterion(block.id, crit.id, { ic_score: v })}
                                  disabled={score.ic_review_status === "completed"}
                                />
                              ) : (
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${crit.ic_score ? SCORE_COLORS[crit.ic_score] : "border-gray-200"}`}>
                                  {crit.ic_score || "—"}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <DeviationCell baseScore={effectiveAdjustedPrimary(crit)} compareScore={crit.ic_score} />
                            </td>
                          </>
                        )}
                        {/* Final score */}
                        {showFinal && (
                          <td className="p-2 text-center">
                            {isPrimaryAnalyst && score.ic_review_status === "in_progress" ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => acceptICScore(block.id, crit.id)} className="p-1 rounded hover:bg-green-100 text-green-600" title="Accept IC score">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => rejectICScore(block.id, crit.id)} className="p-1 rounded hover:bg-red-100 text-red-600" title="Reject IC score">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              (() => {
                                const fin = effectiveFinalScore(crit);
                                return (
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${fin ? SCORE_COLORS[fin] : "border-gray-200"}`}>
                                    {fin || "—"}
                                  </span>
                                );
                              })()
                            )}
                          </td>
                        )}
                        {/* Bonus / Penalty adjustment */}
                        {showFinal && (
                          <td className="p-2 text-center">
                            <BonusPenaltyCell
                              criterion={crit}
                              templateCriteria={templateCriteria}
                              isPrimaryAnalyst={isPrimaryAnalyst}
                              isClosed={isClosed}
                              onUpdate={(updates) => updateCriterion(block.id, crit.id, updates)}
                            />
                          </td>
                        )}
                        {/* Notes */}
                        <td className="p-2">
                          <NotesCell
                            criterion={crit}
                            isPrimary={isPrimaryAnalyst}
                            isSecondary={isSecondaryAnalyst}
                            showTeam={showTeam}
                            showIC={showIC}
                            showFinal={showFinal}
                            onUpdate={(updates) => updateCriterion(block.id, crit.id, updates)}
                          />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr className="border-t-2 font-semibold">
                  <td className="p-2">Weighted Average</td>
                  <td className="p-2 text-center">{computeTotals("primary_score")}</td>
                  {showSecondary && <td className="p-2 text-center">{computeTotals("secondary_score")}</td>}
                  {showTeam && <td className="p-2 text-center">{computeTotals("team_score")}</td>}
                  {showTeam && <td></td>}
                  {showAdjustedPrimary && <td className="p-2 text-center">{computeTotals("adjusted_primary_score")}</td>}
                  {showIC && <td className="p-2 text-center">{computeTotals("ic_score")}</td>}
                  {showIC && <td></td>}
                  {showFinal && <td className="p-2 text-center">{computeTotals("final_score")}</td>}
                  {showFinal && <td className="p-2 text-center text-xs text-gray-500">{(() => {
                    let adj = 0, count = 0;
                    blocks.forEach(b => b.criteria?.forEach(c => {
                      if (c.bonus_penalty_active && c.bonus_penalty_value) { adj += c.bonus_penalty_value; count++; }
                    }));
                    return count > 0 ? `${adj > 0 ? "+" : ""}${adj.toFixed(1)} (${count})` : "—";
                  })()}</td>}
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Radar Chart Tab */}
      {activeTab === "chart" && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3">Score Comparison Radar Chart</h4>
          <ScoreRadarChart blocks={blocks} columns={columns.filter((c) => {
            if (c.key === "secondary_score") return showSecondary;
            if (c.key === "team_score") return showTeam;
            if (c.key === "adjusted_primary_score") return showAdjustedPrimary;
            if (c.key === "ic_score") return showIC;
            if (c.key === "final_score") return showFinal;
            return true;
          })} />
        </div>
      )}

      {/* Comparison Tab */}
      {activeTab === "comparison" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isExportingPdf}>
              {isExportingPdf ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating PDF...</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Export PDF</>
              )}
            </Button>
          </div>
          <ScoringMatrixComparisonTable blocks={blocks} showSecondary={showSecondary} showTeam={showTeam} showAdjustedPrimary={showAdjustedPrimary} showIC={showIC} showFinal={showFinal} benchmark={benchmark} scoreId={scoreId} reviewNotes={score.review_notes} />
        </div>
      )}

      {/* AI Audit Tab */}
      {activeTab === "audit" && (
        <ScoringMatrixAuditPanel scoreId={scoreId} score={score} />
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <ScoringMatrixHistoryTab score={score} onOpenScore={onOpenScore} />
      )}

      {/* Snapshots Tab */}
      {activeTab === "snapshots" && (
        <ScoringMatrixSnapshotsTab score={score} />
      )}

      {/* Attachments Tab */}
      {activeTab === "attachments" && (
        <div className="space-y-4 border border-gray-200 rounded-lg p-4">
          <div>
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-cyan-600" /> Overall Scoring Matrix Attachments
            </h4>
            <p className="text-xs text-gray-500 mb-2">Supporting documents and analysis for the overall scoring matrix.</p>
            <ScoringAttachmentsManager
              attachments={score.attachments}
              scope="overall"
              canEdit={canEditAttachments}
              onUpdate={updateAttachments}
              userName={currentUser?.full_name}
            />
          </div>
          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-1">Per-Criterion Attachments</h4>
            <p className="text-xs text-gray-500 mb-2">Supporting documents scoped to individual scoring items.</p>
            <div className="space-y-3">
              {blocks.map((block) => (
                <div key={block.id} className="border border-gray-100 rounded-md">
                  <div className="bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-700 rounded-t-md">
                    {block.name} <span className="text-gray-400 font-normal">({block.weight}%)</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {(block.criteria || []).map((crit) => {
                      const critAtts = (score.attachments || []).filter((a) => (a.scope || "overall") === crit.id);
                      return (
                        <div key={crit.id} className="px-2 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{crit.name}</span>
                            {critAtts.length > 0 && <Badge variant="secondary" className="text-[10px]">{critAtts.length}</Badge>}
                          </div>
                          <ScoringAttachmentsManager
                            attachments={score.attachments}
                            scope={crit.id}
                            canEdit={canEditAttachments}
                            onUpdate={updateAttachments}
                            userName={currentUser?.full_name}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Re-score dialog */}
      {showRescoreDialog && (
        <RescoreConfirmDialog
          priorScore={score}
          onCreated={handleRescoreCreated}
          onClose={() => setShowRescoreDialog(false)}
        />
      )}

      {/* Closed scoring edit warning */}
      <ClosedScoringEditWarning
        open={showClosedWarning}
        versionNumber={score.version_number}
        onConfirm={reopenClosedScoring}
        onCancel={() => setShowClosedWarning(false)}
      />

      {/* Pre-finalize guard: unscored items + overall rating preview */}
      <FinalizeGuardDialog
        open={!!finalizeGuard}
        onClose={() => setFinalizeGuard(null)}
        blocks={blocks}
        scoreField={finalizeGuard?.scoreField}
        label={finalizeGuard?.label}
        template={template}
        updateCriterion={updateCriterion}
        onConfirm={confirmFinalizeGuard}
        isPending={updateMutation.isPending}
      />
    </div>
  );
}

function NotesCell({ criterion, isPrimary, isSecondary, showTeam, showIC, showFinal, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");

  const activeNotes = criterion.final_notes || criterion.adjusted_primary_notes || criterion.ic_notes || criterion.team_notes || criterion.primary_notes || "";
  const notesLabel = showFinal ? "Final Notes" : showIC ? "IC Notes" : showTeam ? "Team Notes" : "Primary Notes";
  const notesField = showFinal ? "final_notes" : showIC ? "ic_notes" : showTeam ? "team_notes" : "primary_notes";

  if (editing) {
    return (
      <div className="space-y-1">
        <Textarea
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-xs min-h-[60px]"
          placeholder={`Justify your ${notesLabel.toLowerCase()}...`}
          defaultValue={activeNotes}
        />
        <div className="flex gap-1">
          <Button size="sm" className="h-6 text-xs" onClick={() => { onUpdate({ [notesField]: notes }); setEditing(false); }}>Save</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="cursor-pointer hover:bg-gray-100 rounded p-1 min-h-[40px]" onClick={() => { setNotes(activeNotes); setEditing(true); }}>
      {activeNotes ? (
        <span className="text-xs text-gray-600">{activeNotes}</span>
      ) : (
        <span className="text-xs text-gray-300 italic">Add {notesLabel.toLowerCase()}...</span>
      )}
    </div>
  );
}