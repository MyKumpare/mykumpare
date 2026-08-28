import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { ShieldCheck, Loader2, Sparkles, ArrowRight, Check, AlertTriangle, Info, AlertOctagon } from "lucide-react";
import { applyChanges } from "./processTemplateAuditApply";

const SEVERITY_STYLE = {
  high: { icon: AlertOctagon, className: "bg-red-100 text-red-700 border-red-200" },
  medium: { icon: AlertTriangle, className: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { icon: Info, className: "bg-blue-100 text-blue-700 border-blue-200" }
};

const CATEGORY_COLOR = {
  "Redundancy": "bg-purple-100 text-purple-700",
  "Efficiency": "bg-teal-100 text-teal-700",
  "Completeness": "bg-indigo-100 text-indigo-700",
  "Sequencing": "bg-cyan-100 text-cyan-700",
  "Clarity": "bg-amber-100 text-amber-700"
};

function ProcessTree({ stages, docChecklist, title, accent }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white overflow-auto max-h-[420px]">
      <div className={`text-xs font-semibold mb-2 ${accent}`}>{title}</div>
      {(!stages || stages.length === 0) && (!docChecklist || docChecklist.length === 0) ? (
        <div className="text-xs text-gray-400 text-center py-4">No content</div>
      ) : (
        <div className="space-y-2">
          {(stages || []).map((s, i) => (
            <div key={s.id || i} className="border border-gray-100 rounded-md p-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 font-bold">{i + 1}.</span>
                <span className="text-xs font-semibold text-gray-800">{s.name || "(unnamed stage)"}</span>
              </div>
              <div className="mt-1 pl-3 space-y-0.5">
                {(s.sub_stages || []).map((ss, j) => (
                  <div key={ss.id || j} className="text-[11px] text-gray-600 flex items-start gap-1">
                    <span className="text-gray-400">•</span>
                    <span>{ss.name || "(unnamed)"}</span>
                  </div>
                ))}
                {(s.sub_stages || []).length === 0 && <div className="text-[10px] text-gray-400 italic">No sub-stages</div>}
              </div>
            </div>
          ))}
          {docChecklist && docChecklist.length > 0 && (
            <div className="border-t border-gray-100 pt-2 mt-2">
              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Documentation Checklist</div>
              {docChecklist.map((d, i) => (
                <div key={d.id || i} className="text-[11px] text-gray-600 flex items-start gap-1">
                  <span className="text-gray-400">☐</span>
                  <span>{d.name || "(unnamed)"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProcessTemplateAudit({ stages, docChecklist, onStagesChange, onDocChecklistChange, templateId, templateName }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState({});
  const [applied, setApplied] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasContent = (stages && stages.length > 0) || (docChecklist && docChecklist.length > 0);

  const runAudit = async () => {
    if (!hasContent) {
      toast({ title: "No process to audit", description: "Add at least one stage first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    setApplied(false);
    setSelected({});
    try {
      const res = await base44.functions.invoke("auditProcessTemplate", {
        stages: stages || [],
        documentation_checklist: docChecklist || []
      });
      if (res?.error) throw new Error(res.error);
      const data = res?.data || res;
      setResult(data);
      const sel = {};
      (data.changes || []).forEach((ch) => { sel[ch.id] = true; });
      setSelected(sel);
    } catch (err) {
      toast({ title: "Audit failed", description: err?.message, variant: "destructive" });
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
    const merged = applyChanges(stages || [], docChecklist || [], selectedChanges);
    onStagesChange(merged.stages);
    onDocChecklistChange(merged.docChecklist);
    setApplied(true);
    toast({ title: `${selectedChanges.length} change(s) applied`, description: "Process updated in the editor." });
  };

  const applyAll = () => {
    if (!result?.recommended_stages && !result?.recommended_doc_checklist) return;
    onStagesChange((result.recommended_stages || []).map((s) => ({
      id: s.id || `stage_${Date.now()}_${Math.random()}`,
      name: s.name || "",
      sub_stages: (s.sub_stages || []).map((ss) => ({ id: ss.id || `sub_${Date.now()}_${Math.random()}`, name: ss.name || "" }))
    })));
    onDocChecklistChange((result.recommended_doc_checklist || []).map((d) => ({
      id: d.id || `doc_${Date.now()}_${Math.random()}`,
      name: d.name || ""
    })));
    setApplied(true);
    toast({ title: "All recommended changes applied", description: "Process updated in the editor." });
  };

  const saveToTemplate = async () => {
    if (!templateId) return;
    setSaving(true);
    try {
      await base44.entities.Template.update(templateId, {
        stages,
        documentation_checklist: docChecklist
      });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Process saved", description: `"${templateName || "Template"}" has been overwritten with the improved process.` });
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
        className="w-full text-xs border-teal-300 text-teal-700 hover:bg-teal-50 h-8"
        onClick={() => setOpen(true)}
        disabled={!hasContent}
      >
        <ShieldCheck className="w-3.5 h-3.5" /> AI Process Audit
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setResult(null); setApplied(false); } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" /> AI Process Audit
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              Analyzes the process for redundancy, efficiency, completeness gaps, sequencing issues, and clarity — then lets you accept changes selectively and save to overwrite the original.
            </p>
          </DialogHeader>

          {!result && !loading && (
            <div className="py-8 text-center">
              <ShieldCheck className="w-10 h-10 text-teal-300 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-4">
                Run an AI audit on the current process structure ({stages?.length || 0} stages, {docChecklist?.length || 0} checklist items).
              </p>
              <Button type="button" onClick={runAudit} disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white">
                <Sparkles className="w-4 h-4" /> Run AI Audit
              </Button>
            </div>
          )}

          {loading && (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Analyzing process for redundancy, efficiency, and improvements…</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
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
                  <ProcessTree stages={stages} docChecklist={docChecklist} title="Current Process" accent="text-gray-600" />
                  <ProcessTree
                    stages={result.recommended_stages || []}
                    docChecklist={result.recommended_doc_checklist || []}
                    title="Recommended Process"
                    accent="text-teal-600"
                  />
                </div>
              </div>

              {/* Recommended changes with selective acceptance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800">Recommended Changes ({changes.length})</h4>
                  <div className="flex items-center gap-2 text-xs">
                    <button type="button" onClick={selectAll} className="text-teal-600 hover:underline">Select All</button>
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
                        <label key={ch.id} className={`flex items-start gap-2 border rounded-md p-2 cursor-pointer transition-colors ${isSel ? "border-teal-300 bg-teal-50/40" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
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
                    : " Click \u201cSave Changes\u201d in the dialog to persist."}
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
                <Button type="button" variant="outline" size="sm" onClick={applyAll} disabled={saving} className="border-teal-300 text-teal-700 hover:bg-teal-50">
                  <Sparkles className="w-3.5 h-3.5" /> Apply All Recommended
                </Button>
                {applied && templateId && (
                  <Button type="button" size="sm" onClick={saveToTemplate} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
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