import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { ShieldCheck, Loader2, Sparkles, ArrowRight, Check, AlertTriangle, Info, AlertOctagon, ListChecks } from "lucide-react";
import { applyChanges } from "./scoringRubricAuditApply";

const SEVERITY_STYLE = {
  high: { icon: AlertOctagon, className: "bg-red-100 text-red-700 border-red-200" },
  medium: { icon: AlertTriangle, className: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { icon: Info, className: "bg-blue-100 text-blue-700 border-blue-200" }
};

const CATEGORY_COLOR = {
  "Bias": "bg-pink-100 text-pink-700",
  "Redundancy": "bg-purple-100 text-purple-700",
  "Scoring Logic": "bg-indigo-100 text-indigo-700",
  "Weight Balance": "bg-cyan-100 text-cyan-700",
  "Efficiency": "bg-teal-100 text-teal-700",
  "Effectiveness": "bg-emerald-100 text-emerald-700"
};

function RubricTree({ blocks, title, accent }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white overflow-auto max-h-[420px]">
      <div className={`text-xs font-semibold mb-2 ${accent}`}>{title}</div>
      {blocks.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-4">No blocks</div>
      ) : (
        <div className="space-y-2">
          {blocks.map((b) => (
            <div key={b.id} className="border border-gray-100 rounded-md p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-800">{b.name || "(unnamed block)"}</span>
                <Badge variant="outline" className="text-[10px]">{b.weight || 0}%</Badge>
              </div>
              <div className="mt-1 pl-2 space-y-0.5">
                {(b.criteria || []).map((c) => (
                  <div key={c.id} className="text-[11px] text-gray-600 flex items-start gap-1">
                    <span className="text-gray-400">#{c.number || ""}</span>
                    <span>{c.name || "(unnamed)"}</span>
                    {c.category && <span className="text-gray-400">— {c.category}</span>}
                  </div>
                ))}
                {(b.criteria || []).length === 0 && <div className="text-[10px] text-gray-400 italic">No criteria</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const AUDIT_STEPS = [
  { label: "Validating rubric input", icon: ListChecks },
  { label: "Normalizing rubric structure", icon: ShieldCheck },
  { label: "Scanning descriptors for quality", icon: Sparkles },
  { label: "Analyzing bias & redundancy", icon: AlertTriangle },
  { label: "Evaluating weight balance", icon: ArrowRight },
  { label: "Generating recommendations", icon: Check },
];

export default function ScoringMatrixRubricAudit({ blocks, onChange, templateId, templateName }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const progressTimer = useRef(null);
  const [result, setResult] = useState(null);
  const [processTrace, setProcessTrace] = useState([]);
  const [selected, setSelected] = useState({});
  const [applied, setApplied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  // Simulated progress animation while the audit runs — gives the user
  // visual feedback that the audit is working through its analysis stages.
  useEffect(() => {
    if (!loading) {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      return;
    }
    setProgress(0);
    setActiveStep(0);
    // Advance progress gradually, slowing down as it approaches 90%
    // (the final 10% completes when the response arrives).
    progressTimer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        // Slow down as we get closer to 90
        const increment = p < 30 ? 2 : p < 60 ? 1.5 : p < 80 ? 0.8 : 0.3;
        return Math.min(90, p + increment);
      });
    }, 400);
    return () => {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
    };
  }, [loading]);

  // Derive the active step from progress
  useEffect(() => {
    const stepIdx = Math.min(
      AUDIT_STEPS.length - 1,
      Math.floor((progress / 90) * AUDIT_STEPS.length)
    );
    setActiveStep(stepIdx);
  }, [progress]);

  const runAudit = async () => {
    if (!blocks || blocks.length === 0) {
      toast({ title: "No rubric to audit", description: "Add at least one block first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    setProcessTrace([]);
    setApplied(false);
    setSelected({});
    try {
      const res = await base44.functions.invoke("auditScoringMatrixTemplate", { scoring_blocks: blocks });
      if (res?.error) throw new Error(res.error);
      const data = res?.data || res;
      setProgress(100);
      setResult(data);
      setProcessTrace(res?.process_trace || []);
      // Default: all changes selected
      const sel = {};
      (data.changes || []).forEach((ch) => { sel[ch.id] = true; });
      setSelected(sel);
    } catch (err) {
      // Extract the real error message — the SDK throws a generic "Request failed
      // with status code 500" but the actual error is in the response body.
      const rawMsg = err?.message || String(err);
      let detail = rawMsg;
      try {
        const respErr = err?.response?.data?.error || err?.response?.data?.message;
        if (respErr) detail = respErr;
      } catch (_) { /* ignore */ }
      toast({ title: "Audit failed", description: detail || "The AI audit timed out or encountered an error. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleChange = (id) => setSelected((p) => ({ ...p, [id]: !p[id] }));
  const selectAll = () => {
    const sel = {};
    (result?.changes || []).forEach((ch) => { sel[ch.id] = true; });
    setSelected(sel);
  };
  const deselectAll = () => setSelected({});

  const selectedChanges = (result?.changes || []).filter((ch) => selected[ch.id]);

  const applySelected = () => {
    if (selectedChanges.length === 0) {
      toast({ title: "No changes selected", variant: "destructive" });
      return;
    }
    const merged = applyChanges(blocks, selectedChanges);
    onChange(merged);
    setApplied(true);
    toast({ title: `${selectedChanges.length} change(s) applied`, description: "Rubric updated in the editor." });
  };

  const applyAll = () => {
    if (!result?.recommended_blocks) return;
    onChange(result.recommended_blocks.map((b) => ({
      ...b,
      criteria: (b.criteria || []).map((c) => ({
        ...c,
        descriptors: (c.descriptors || []).map((d) => ({ level: d.level, text: d.text || "" })),
        bonus_penalty_enabled: c.bonus_penalty_enabled ?? false,
        bonus_penalty_range: c.bonus_penalty_range ?? { min: -1, max: 1 },
        bonus_penalty_guidance: c.bonus_penalty_guidance ?? ""
      }))
    })));
    setApplied(true);
    toast({ title: "All recommended changes applied", description: "Rubric updated in the editor." });
  };

  const saveToTemplate = async () => {
    if (!templateId) return;
    setSaving(true);
    try {
      await base44.entities.Template.update(templateId, { scoring_blocks: blocks });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Rubric saved", description: `"${templateName || "Template"}" has been overwritten with the improved rubric.` });
      setOpen(false);
      setResult(null);
      setApplied(false);
    } catch (err) {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const findings = result?.findings || [];
  const changes = result?.changes || [];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 h-8"
        onClick={() => setOpen(true)}
        disabled={!blocks || blocks.length === 0}
      >
        <ShieldCheck className="w-3.5 h-3.5" /> AI Rubric Audit
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setResult(null); setApplied(false); } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" /> AI Rubric Audit
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              Analyzes the rubric for inherent bias, redundancy, scoring-logic gaps, and weight/efficiency improvements — then lets you accept changes selectively and save to overwrite the original.
            </p>
          </DialogHeader>

          {!result && !loading && (
            <div className="py-8 text-center">
              <ShieldCheck className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-4">Run an AI audit on the current rubric structure ({blocks?.length || 0} blocks).</p>
              <Button type="button" onClick={runAudit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Sparkles className="w-4 h-4" /> Run AI Audit
              </Button>
            </div>
          )}

          {loading && (
            <div className="py-8 px-4">
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                    Auditing rubric…
                  </span>
                  <span className="text-xs font-semibold text-indigo-600">{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              {/* Step list */}
              <div className="space-y-1.5">
                {AUDIT_STEPS.map((step, i) => {
                  const StepIcon = step.icon;
                  const isDone = i < activeStep || progress >= 100;
                  const isActive = i === activeStep && progress < 100;
                  const isPending = i > activeStep;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-xs transition-colors ${
                        isDone ? "text-green-600" : isActive ? "text-indigo-600 font-medium" : "text-gray-300"
                      }`}
                    >
                      {isDone ? (
                        <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                      ) : (
                        <StepIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span>{step.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-3 text-center">
                This may take up to 2 minutes for large rubrics. Please keep this dialog open.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Process Trace */}
              {processTrace.length > 0 && (
                <div className="border border-gray-200 rounded-md bg-gray-50/50">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 p-2 text-left"
                    onClick={() => setShowTrace((s) => !s)}
                  >
                    <ListChecks className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-semibold text-gray-700">AI Process Trace ({processTrace.length} steps)</span>
                    <span className="ml-auto text-[10px] text-gray-400">{showTrace ? "Hide" : "Show"}</span>
                  </button>
                  {showTrace && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {processTrace.map((t) => (
                        <div key={t.step} className="flex items-start gap-2 text-[11px]">
                          <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            t.status === "ok" ? "bg-green-100 text-green-700" :
                            t.status === "warning" ? "bg-amber-100 text-amber-700" :
                            "bg-gray-200 text-gray-500"
                          }`}>{t.step}</span>
                          <div className="min-w-0">
                            <span className="font-semibold text-gray-700">{t.label}</span>
                            <p className="text-gray-500 whitespace-pre-line leading-snug">{t.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Findings */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Audit Findings ({findings.length})</h4>
                {findings.length === 0 ? (
                  <p className="text-xs text-gray-400">No issues found.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {findings.map((f, i) => {
                      const sev = SEVERITY_STYLE[f.severity] || SEVERITY_STYLE.low;
                      const SevIcon = sev.icon;
                      return (
                        <div key={i} className="border border-gray-200 rounded-md p-2 bg-gray-50/50">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <SevIcon className={`w-3.5 h-3.5 ${sev.className.split(" ")[1]}`} />
                            <span className="text-xs font-semibold text-gray-800">{f.title}</span>
                            <Badge variant="outline" className={`text-[10px] ${sev.className}`}>{f.severity}</Badge>
                            {f.category && <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLOR[f.category] || ""}`}>{f.category}</Badge>}
                          </div>
                          <p className="text-[11px] text-gray-600 leading-snug">{f.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Side-by-side comparison */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Side-by-Side Comparison</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  <RubricTree blocks={blocks} title="Current Rubric" accent="text-gray-600" />
                  <RubricTree blocks={result.recommended_blocks || []} title="Recommended Rubric" accent="text-indigo-600" />
                </div>
              </div>

              {/* Recommended changes with selective acceptance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800">Recommended Changes ({changes.length})</h4>
                  <div className="flex items-center gap-2 text-xs">
                    <button type="button" onClick={selectAll} className="text-indigo-600 hover:underline">Select All</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={deselectAll} className="text-gray-500 hover:underline">Deselect All</button>
                  </div>
                </div>
                {changes.length === 0 ? (
                  <p className="text-xs text-gray-400">No specific changes recommended.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                    {changes.map((ch) => {
                      const sev = SEVERITY_STYLE[ch.severity] || SEVERITY_STYLE.low;
                      const SevIcon = sev.icon;
                      const isSel = !!selected[ch.id];
                      return (
                        <label key={ch.id} className={`flex items-start gap-2 border rounded-md p-2 cursor-pointer transition-colors ${isSel ? "border-indigo-300 bg-indigo-50/40" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                          <Checkbox checked={isSel} onCheckedChange={() => toggleChange(ch.id)} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <SevIcon className={`w-3.5 h-3.5 ${sev.className.split(" ")[1]}`} />
                              <span className="text-xs font-semibold text-gray-800">{ch.title}</span>
                              <Badge variant="outline" className={`text-[10px] ${sev.className}`}>{ch.severity}</Badge>
                              {ch.category && <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLOR[ch.category] || ""}`}>{ch.category}</Badge>}
                              <Badge variant="outline" className="text-[10px] text-gray-500">{ch.type?.replace(/_/g, " ")}</Badge>
                            </div>
                            <p className="text-[11px] text-gray-600 leading-snug mt-0.5">{ch.rationale}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Applied banner */}
              {applied && (
                <div className="flex items-center gap-2 border border-green-200 bg-green-50 rounded-md p-2 text-xs text-green-700">
                  <Check className="w-4 h-4" /> Changes applied to the editor.
                  {templateId
                    ? " Click \u201cSave to Overwrite Original\u201d to persist to the template."
                    : " Click \u201cSave Changes\u201d / \u201cAdd Template\u201d in the dialog to persist."}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center gap-2 flex-wrap">
            {result && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={applySelected} disabled={selectedChanges.length === 0 || saving}>
                  Apply Selected ({selectedChanges.length})
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={applyAll} disabled={saving} className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                  <Sparkles className="w-3.5 h-3.5" /> Apply All Recommended
                </Button>
                {applied && templateId && (
                  <Button type="button" size="sm" onClick={saveToTemplate} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    Save to Overwrite Original
                  </Button>
                )}
              </>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}