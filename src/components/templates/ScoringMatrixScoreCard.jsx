import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, CheckCircle2, Circle, ChevronDown, ChevronRight, Sparkles, Loader2, FileText, Download, Brain, History, GitBranch, Lock, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip
} from "recharts";
import { format } from "date-fns";
import ScoringMatrixComparisonTable from "@/components/templates/ScoringMatrixComparisonTable";
import ScoringMatrixAuditPanel from "@/components/templates/ScoringMatrixAuditPanel";
import ScoringMatrixHistoryTab from "@/components/templates/ScoringMatrixHistoryTab";
import RescoreConfirmDialog from "@/components/templates/RescoreConfirmDialog";
import ClosedScoringEditWarning from "@/components/templates/ClosedScoringEditWarning";
import { exportScoringMatrixComparisonPdf } from "@/components/templates/scoringMatrixComparisonPdf";

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

  return (
    <ResponsiveContainer width="100%" height={350}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 9 }} />
        <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
        {columns.map((col) => (
          <Radar key={col.key} name={col.label} dataKey={col.key} stroke={col.color} fill={col.color} fillOpacity={0.15} />
        ))}
        <Legend />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export default function ScoringMatrixScoreCard({ scoreId, dueDiligence, template, currentUser, onBack, onOpenScore }) {
  const queryClient = useQueryClient();
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [activeTab, setActiveTab] = useState("scoring");
  // Tabs: scoring | chart | comparison | audit | history
  const [showRescoreDialog, setShowRescoreDialog] = useState(false);
  const [showClosedWarning, setShowClosedWarning] = useState(false);
  const [editReopened, setEditReopened] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const { data: score, isLoading } = useQuery({
    queryKey: ["scoringMatrixScore", scoreId],
    queryFn: () => base44.entities.ScoringMatrixScore.get(scoreId),
    enabled: !!scoreId
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

  // Whether the scoring is closed (finalized + is_closed) and not yet reopened for editing
  const isClosed = score?.is_closed === true && !editReopened;

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!score) return <div className="text-center py-8 text-sm text-gray-400">Score record not found.</div>;

  const blocks = score.scoring_blocks || [];
  const isPrimaryAnalyst = currentUser?.linked_contact_id === score.primary_analyst_contact_id;
  const isSecondaryAnalyst = currentUser?.linked_contact_id === score.secondary_analyst_contact_id;

  const updateCriterion = (blockId, critId, updates) => {
    const newBlocks = blocks.map((b) => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        criteria: (b.criteria || []).map((c) => (c.id === critId ? { ...c, ...updates } : c))
      };
    });
    updateMutation.mutate({ scoring_blocks: newBlocks });
  };

  const updateAllCriteria = (updates) => {
    const newBlocks = blocks.map((b) => ({
      ...b,
      criteria: (b.criteria || []).map((c) => ({ ...c, ...updates(c) }))
    }));
    updateMutation.mutate({ scoring_blocks: newBlocks });
  };

  // Phase transitions
  const finalizePrimary = () => {
    updateMutation.mutate({
      primary_score_finalized: true,
      status: score.secondary_scoring_enabled ? "secondary_scoring" : "team_review",
      team_review_status: score.secondary_scoring_enabled ? "not_started" : "not_started"
    });
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
    updateMutation.mutate({
      team_review_status: "completed",
      adjusted_primary_finalized: true,
      status: "ic_review"
    });
    toast({ title: "Team review completed — adjusted primary scores finalized" });
  };

  const finalizeICReview = () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    updateMutation.mutate({
      ic_review_status: "completed",
      final_score_finalized: true,
      status: "finalized",
      scoring_end_date: todayStr,
      is_closed: true
    });
    setEditReopened(false);
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

  // Compute weighted totals
  const computeTotals = (scoreField) => {
    let total = 0;
    let totalWeight = 0;
    blocks.forEach((block) => {
      const blockWeight = (block.weight || 0) / 100;
      (block.criteria || []).forEach((crit) => {
        const s = crit[scoreField];
        if (s != null) {
          total += s * blockWeight;
          totalWeight += blockWeight;
        }
      });
    });
    return totalWeight > 0 ? (total / totalWeight).toFixed(2) : "—";
  };

  const columns = [
    { key: "primary_score", label: "Primary", color: "#3b82f6", getValue: (c) => c.primary_score },
    { key: "team_score", label: "Team", color: "#f59e0b", getValue: (c) => c.team_score },
    { key: "adjusted_primary_score", label: "Adj. Primary", color: "#8b5cf6", getValue: (c) => c.adjusted_primary_score },
    { key: "ic_score", label: "IC", color: "#ec4899", getValue: (c) => c.ic_score },
    { key: "final_score", label: "Final", color: "#10b981", getValue: (c) => c.final_score }
  ];

  const showSecondary = score.secondary_scoring_enabled;
  const showTeam = score.primary_score_finalized;
  const showAdjustedPrimary = score.team_review_status === "in_progress" || score.team_review_status === "completed" || score.adjusted_primary_finalized;
  const showIC = score.adjusted_primary_finalized;
  const showFinal = score.ic_review_status === "in_progress" || score.ic_review_status === "completed" || score.final_score_finalized;

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
          {isClosed && (
            <Button variant="outline" size="sm" onClick={() => setShowRescoreDialog(true)} className="text-indigo-600 border-indigo-300 hover:bg-indigo-50">
              <GitBranch className="w-3.5 h-3.5" /> Re-Score
            </Button>
          )}
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
              <Button size="sm" onClick={finalizePrimary} disabled={updateMutation.isPending}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Finalize Primary Scores
              </Button>
            )}
            {isPrimaryAnalyst && score.primary_score_finalized && !score.secondary_scoring_enabled && !showIC && (
              <Button size="sm" variant="outline" onClick={initTeamScores}>
                Start Team Review
              </Button>
            )}
            {isPrimaryAnalyst && showTeam && score.team_review_status === "in_progress" && (
              <Button size="sm" onClick={finalizeTeamReview} disabled={updateMutation.isPending}>
                Finalize Adjusted Primary (End Team Review)
              </Button>
            )}
            {isPrimaryAnalyst && score.adjusted_primary_finalized && !score.final_score_finalized && (
              <Button size="sm" variant="outline" onClick={initICScores}>
                Start IC Review
              </Button>
            )}
            {isPrimaryAnalyst && showIC && score.ic_review_status === "in_progress" && (
              <Button size="sm" onClick={finalizeICReview} disabled={updateMutation.isPending}>
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
                  <th className="text-left p-2 font-medium text-gray-600 min-w-[150px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <React.Fragment key={block.id}>
                    <tr className="bg-gray-100 cursor-pointer hover:bg-gray-200" onClick={() => toggleBlock(block.id)}>
                      <td colSpan={showFinal ? 11 : showIC ? 9 : showAdjustedPrimary ? 7 : showTeam ? 5 : showSecondary ? 4 : 3} className="p-2 font-semibold text-gray-700">
                        <div className="flex items-center gap-1.5">
                          {expandedBlocks[block.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          {block.name} <span className="text-gray-400 font-normal">({block.weight}%)</span>
                        </div>
                      </td>
                    </tr>
                    {expandedBlocks[block.id] && (block.criteria || []).map((crit) => (
                      <tr key={crit.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div className="font-medium">{crit.name}</div>
                          {crit.category && <div className="text-gray-400 text-[10px]">{crit.category}</div>}
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
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${crit.adjusted_primary_score ? SCORE_COLORS[crit.adjusted_primary_score] : "border-gray-200"}`}>
                                {crit.adjusted_primary_score || "—"}
                              </span>
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
                              <DeviationCell baseScore={crit.adjusted_primary_score ?? crit.primary_score} compareScore={crit.ic_score} />
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
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${crit.final_score ? SCORE_COLORS[crit.final_score] : "border-gray-200"}`}>
                                {crit.final_score || "—"}
                              </span>
                            )}
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
          <ScoringMatrixComparisonTable blocks={blocks} showSecondary={showSecondary} showTeam={showTeam} showAdjustedPrimary={showAdjustedPrimary} showIC={showIC} showFinal={showFinal} />
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