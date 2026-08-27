import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X, CheckCircle2, ChevronDown, ChevronRight, FlaskConical, RotateCcw, Lock, Unlock } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip
} from "recharts";

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

function buildMockScore(template) {
  const blocks = (template?.scoring_blocks || []).map((b) => ({
    id: b.id,
    name: b.name,
    weight: b.weight || 0,
    criteria: (b.criteria || []).map((c) => ({
      id: c.id,
      number: c.number,
      name: c.name,
      category: c.category || "",
      descriptors: c.descriptors || [],
      primary_score: null,
      primary_notes: "",
      team_score: null,
      team_notes: "",
      team_status: "pending",
      adjusted_primary_score: null,
      adjusted_primary_notes: "",
      ic_score: null,
      ic_notes: "",
      ic_status: "pending",
      final_score: null,
      final_notes: ""
    }))
  }));
  return {
    template_name: template?.name || "Test Template",
    firm_name: "Test Firm (Sample)",
    product_name: "Test Product (Sample)",
    status: "primary_scoring",
    primary_score_finalized: false,
    team_review_status: "not_started",
    adjusted_primary_finalized: false,
    ic_review_status: "not_started",
    final_score_finalized: false,
    is_closed: false,
    scoring_blocks: blocks
  };
}

export default function ScoringMatrixTestModeDialog({ open, onOpenChange, template }) {
  const [score, setScore] = useState(() => buildMockScore(template));
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [activeTab, setActiveTab] = useState("scoring");

  // Rebuild mock score when template changes or dialog reopens
  React.useEffect(() => {
    if (open) {
      setScore(buildMockScore(template));
      setExpandedBlocks({});
      setActiveTab("scoring");
    }
  }, [open, template]);

  const toggleBlock = (id) => setExpandedBlocks((p) => ({ ...p, [id]: !p[id] }));

  const blocks = score.scoring_blocks || [];

  const updateCriterion = (blockId, critId, updates) => {
    setScore((prev) => ({
      ...prev,
      scoring_blocks: prev.scoring_blocks.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          criteria: (b.criteria || []).map((c) => (c.id === critId ? { ...c, ...updates } : c))
        };
      })
    }));
  };

  const updateAllCriteria = (updatesFn) => {
    setScore((prev) => ({
      ...prev,
      scoring_blocks: prev.scoring_blocks.map((b) => ({
        ...b,
        criteria: (b.criteria || []).map((c) => ({ ...c, ...updatesFn(c) }))
      }))
    }));
  };

  // Phase transitions (local only)
  const finalizePrimary = () => {
    setScore((prev) => ({
      ...prev,
      primary_score_finalized: true,
      status: "team_review",
      team_review_status: "not_started"
    }));
    toast({ title: "✓ Primary scores finalized (test)" });
  };

  const initTeamScores = () => {
    updateAllCriteria((c) => ({
      team_score: c.team_score ?? c.primary_score,
      team_status: c.team_status || "pending"
    }));
    setScore((prev) => ({ ...prev, team_review_status: "in_progress", status: "team_review" }));
    toast({ title: "✓ Team review started (test)" });
  };

  const finalizeTeamReview = () => {
    setScore((prev) => ({
      ...prev,
      team_review_status: "completed",
      adjusted_primary_finalized: true,
      status: "ic_review"
    }));
    toast({ title: "✓ Team review completed (test)" });
  };

  const initICScores = () => {
    updateAllCriteria((c) => ({
      ic_score: c.ic_score ?? c.adjusted_primary_score ?? c.primary_score,
      ic_status: c.ic_status || "pending"
    }));
    setScore((prev) => ({ ...prev, ic_review_status: "in_progress", status: "ic_review" }));
    toast({ title: "✓ IC review started (test)" });
  };

  const finalizeICReview = () => {
    setScore((prev) => ({
      ...prev,
      ic_review_status: "completed",
      final_score_finalized: true,
      status: "finalized",
      is_closed: true
    }));
    toast({ title: "✓ Scoring matrix finalized (test)", description: "Nothing was saved — this is a test run." });
  };

  const resetTest = () => {
    setScore(buildMockScore(template));
    setExpandedBlocks({});
    setActiveTab("scoring");
    toast({ title: "Test reset", description: "All scores cleared." });
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

  const showTeam = score.primary_score_finalized;
  const showAdjustedPrimary = score.team_review_status === "in_progress" || score.team_review_status === "completed" || score.adjusted_primary_finalized;
  const showIC = score.adjusted_primary_finalized;
  const showFinal = score.ic_review_status === "in_progress" || score.ic_review_status === "completed" || score.final_score_finalized;

  const radarData = useMemo(() => {
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
  }, [blocks]);

  const visibleColumns = columns.filter((c) => {
    if (c.key === "team_score") return showTeam;
    if (c.key === "adjusted_primary_score") return showAdjustedPrimary;
    if (c.key === "ic_score") return showIC;
    if (c.key === "final_score") return showFinal;
    return true;
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <FlaskConical className="w-5 h-5 text-cyan-600" />
                <DialogTitle>Test Mode — Scoring Matrix</DialogTitle>
              </div>
            </div>
            <Badge variant="outline" className="text-xs text-cyan-700 border-cyan-400 bg-cyan-50 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Nothing is saved
            </Badge>
          </div>
        </DialogHeader>

        {/* Test mode banner */}
        <div className="border border-cyan-200 rounded-lg p-3 bg-cyan-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-cyan-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-cyan-900">You are testing this scoring matrix in a sandbox</p>
              <p className="text-xs text-cyan-700">
                All scores and workflow transitions are held in memory only. No data is saved, and no manager product is affected.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetTest} className="border-cyan-400 text-cyan-700 hover:bg-cyan-100 text-xs shrink-0">
            <RotateCcw className="w-3 h-3" /> Reset Test
          </Button>
        </div>

        {/* Header info */}
        <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold">{score.template_name}</h3>
            <p className="text-xs text-gray-500">{score.firm_name} — {score.product_name}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">Status: {score.status}</Badge>
              {score.is_closed && (
                <Badge variant="outline" className="text-xs text-gray-500 border-gray-300 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Closed
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => setActiveTab("scoring")}>Scoring</Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("chart")}>Radar Chart</Button>
          </div>
        </div>

        {/* Scoring Tab */}
        {activeTab === "scoring" && (
          <div className="space-y-3">
            {/* Phase action buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              {!score.primary_score_finalized && (
                <Button size="sm" onClick={finalizePrimary}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Finalize Primary Scores
                </Button>
              )}
              {score.primary_score_finalized && !showIC && score.team_review_status !== "completed" && (
                <Button size="sm" variant="outline" onClick={initTeamScores}>
                  Start Team Review
                </Button>
              )}
              {showTeam && score.team_review_status === "in_progress" && (
                <Button size="sm" onClick={finalizeTeamReview}>
                  Finalize Adjusted Primary (End Team Review)
                </Button>
              )}
              {score.adjusted_primary_finalized && !score.final_score_finalized && score.ic_review_status !== "in_progress" && (
                <Button size="sm" variant="outline" onClick={initICScores}>
                  Start IC Review
                </Button>
              )}
              {showIC && score.ic_review_status === "in_progress" && (
                <Button size="sm" onClick={finalizeICReview}>
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
                        <td colSpan={showFinal ? 10 : showIC ? 8 : showAdjustedPrimary ? 6 : showTeam ? 4 : 2} className="p-2 font-semibold text-gray-700">
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
                              disabled={score.primary_score_finalized}
                            />
                          </td>
                          {/* Team recommended score */}
                          {showTeam && (
                            <>
                              <td className="p-2 text-center">
                                <ScoreCell
                                  score={crit.team_score}
                                  onChange={(v) => updateCriterion(block.id, crit.id, { team_score: v })}
                                  disabled={score.team_review_status === "completed"}
                                />
                              </td>
                              <td className="p-2 text-center">
                                <DeviationCell baseScore={crit.primary_score} compareScore={crit.team_score} />
                              </td>
                            </>
                          )}
                          {/* Adjusted primary */}
                          {showAdjustedPrimary && (
                            <td className="p-2 text-center">
                              {score.team_review_status === "in_progress" ? (
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
                                <ScoreCell
                                  score={crit.ic_score}
                                  onChange={(v) => updateCriterion(block.id, crit.id, { ic_score: v })}
                                  disabled={score.ic_review_status === "completed"}
                                />
                              </td>
                              <td className="p-2 text-center">
                                <DeviationCell baseScore={crit.adjusted_primary_score ?? crit.primary_score} compareScore={crit.ic_score} />
                              </td>
                            </>
                          )}
                          {/* Final score */}
                          {showFinal && (
                            <td className="p-2 text-center">
                              {score.ic_review_status === "in_progress" ? (
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
                            <TestNotesCell
                              criterion={crit}
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

            {/* Level descriptors reference (collapsible) */}
            <DescriptorReference blocks={blocks} expandedBlocks={expandedBlocks} toggleBlock={toggleBlock} />
          </div>
        )}

        {/* Radar Chart Tab */}
        {activeTab === "chart" && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3">Score Comparison Radar Chart</h4>
            {radarData.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">No criteria to display.</p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
                  {visibleColumns.map((col) => (
                    <Radar key={col.key} name={col.label} dataKey={col.key} stroke={col.color} fill={col.color} fillOpacity={0.15} />
                  ))}
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TestNotesCell({ criterion, showTeam, showIC, showFinal, onUpdate }) {
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

function DescriptorReference({ blocks, expandedBlocks, toggleBlock }) {
  const [show, setShow] = useState(false);
  if (!show) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setShow(true)} className="text-xs text-gray-500">
        <ChevronRight className="w-3.5 h-3.5" /> Show Level Descriptors Reference
      </Button>
    );
  }
  return (
    <div className="border border-gray-200 rounded-lg p-2 space-y-1">
      <Button variant="ghost" size="sm" onClick={() => setShow(false)} className="text-xs text-gray-500">
        <ChevronDown className="w-3.5 h-3.5" /> Hide Level Descriptors Reference
      </Button>
      {blocks.map((block) => (
        <div key={block.id} className="border border-gray-100 rounded-md">
          <div className="bg-gray-50 px-2 py-1 cursor-pointer text-xs font-semibold" onClick={() => toggleBlock(block.id)}>
            {expandedBlocks[block.id] ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronRight className="w-3 h-3 inline" />} {block.name}
          </div>
          {expandedBlocks[block.id] && (block.criteria || []).map((crit) => (
            <div key={crit.id} className="p-2 border-t border-gray-100">
              <div className="text-xs font-medium mb-1">{crit.name}</div>
              <div className="grid grid-cols-1 gap-1 pl-3">
                {(crit.descriptors || []).map((desc) => (
                  <div key={desc.level} className="flex items-start gap-2">
                    <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      desc.level === 1 ? "bg-red-100 text-red-700" :
                      desc.level === 2 ? "bg-orange-100 text-orange-700" :
                      desc.level === 3 ? "bg-yellow-100 text-yellow-700" :
                      desc.level === 4 ? "bg-lime-100 text-lime-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {desc.level}
                    </span>
                    <span className="text-[11px] text-gray-600">{desc.text || <em className="text-gray-300">No descriptor</em>}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}