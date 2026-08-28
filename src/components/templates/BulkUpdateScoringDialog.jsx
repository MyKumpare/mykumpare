import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, Gauge, AlertTriangle, ArrowRight } from "lucide-react";
import { computeEffectiveBlockWeights } from "@/components/templates/scoringWeightLogic";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300"
};

// Score fields that can be bulk-set (directly editable via the score table)
const SCORE_FIELDS = [
  { key: "primary_score", label: "Primary" },
  { key: "secondary_score", label: "Secondary" },
  { key: "team_score", label: "Team Rec." },
  { key: "ic_score", label: "IC Rec." }
];

export default function BulkUpdateScoringDialog({
  open,
  onClose,
  blocks,
  score,
  onApplyBlocks
}) {
  const [mode, setMode] = useState("scores"); // "scores" | "multiplier"
  const [scoreField, setScoreField] = useState("primary_score");
  const [scoreValue, setScoreValue] = useState(3);
  const [scope, setScope] = useState("all"); // "all" | "section" | "selected"
  const [sectionId, setSectionId] = useState("");
  const [selectedCritIds, setSelectedCritIds] = useState([]);
  const [mulEnabled, setMulEnabled] = useState(true);
  const [mulValue, setMulValue] = useState(1);
  const [mulScope, setMulScope] = useState("all"); // "all" | "section"
  const [mulSectionIds, setMulSectionIds] = useState([]);

  const allCriteria = useMemo(
    () => (blocks || []).flatMap((b) => (b.criteria || []).map((c) => ({ block: b, crit: c }))),
    [blocks]
  );

  // Default the score field to the currently-active editable phase
  useEffect(() => {
    if (!score) return;
    if (!score.primary_score_finalized) setScoreField("primary_score");
    else if (score.team_review_status === "in_progress") setScoreField("team_score");
    else if (score.ic_review_status === "in_progress") setScoreField("ic_score");
  }, [score?.primary_score_finalized, score?.team_review_status, score?.ic_review_status]);

  // Default-select first block for section scope
  useEffect(() => {
    if (!sectionId && blocks?.length) setSectionId(blocks[0].id);
  }, [blocks]);

  const toggleCrit = (id) =>
    setSelectedCritIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const toggleMulSection = (id) =>
    setMulSectionIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const targetCriteria = useMemo(() => {
    if (mode === "scores") {
      if (scope === "all") return allCriteria;
      if (scope === "section") return allCriteria.filter(({ block }) => block.id === sectionId);
      if (scope === "selected") return allCriteria.filter(({ crit }) => selectedCritIds.includes(crit.id));
    }
    return [];
  }, [mode, scope, sectionId, selectedCritIds, allCriteria]);

  const targetCount = targetCriteria.length;

  // --- Multiplier preview: build the rubric with the proposed multiplier applied
  // (not yet saved) so the user can see how effective weights shift before applying.
  const previewBlocks = useMemo(() => {
    const ids = mulScope === "all"
      ? new Set((blocks || []).map((b) => b.id))
      : new Set(mulSectionIds);
    return (blocks || []).map((b) =>
      ids.has(b.id)
        ? { ...b, multiplier_enabled: mulEnabled, multiplier: mulEnabled ? mulValue : 1 }
        : b
    );
  }, [blocks, mulScope, mulSectionIds, mulEnabled, mulValue]);

  const currentEff = useMemo(() => computeEffectiveBlockWeights(blocks), [blocks]);
  const previewEff = useMemo(() => computeEffectiveBlockWeights(previewBlocks), [previewBlocks]);
  const effById = (arr) => Object.fromEntries(arr.map((b) => [b.id, b]));
  const currentMap = effById(currentEff);
  const previewMap = effById(previewEff);

  const handleApply = () => {
    if (mode === "scores") {
      if (!targetCount) return;
      const ids = new Set(targetCriteria.map(({ crit }) => crit.id));
      const newBlocks = blocks.map((b) => ({
        ...b,
        criteria: (b.criteria || []).map((c) => (ids.has(c.id) ? { ...c, [scoreField]: scoreValue } : c))
      }));
      onApplyBlocks(newBlocks, `${targetCount} criteria set to ${scoreValue} (${SCORE_FIELDS.find((f) => f.key === scoreField)?.label})`);
    } else {
      // multiplier mode
      const ids = mulScope === "all"
        ? new Set((blocks || []).map((b) => b.id))
        : new Set(mulSectionIds);
      if (!ids.size) return;
      const newBlocks = blocks.map((b) =>
        ids.has(b.id)
          ? { ...b, multiplier_enabled: mulEnabled, multiplier: mulEnabled ? mulValue : 1 }
          : b
      );
      onApplyBlocks(newBlocks, `${ids.size} section${ids.size > 1 ? "s" : ""} multiplier ${mulEnabled ? `set to ${mulValue}` : "disabled"}`);
    }
    onClose();
  };

  const canApply = mode === "scores" ? targetCount > 0 : (mulScope === "all" ? true : mulSectionIds.length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" /> Bulk Update Scoring
          </DialogTitle>
          <DialogDescription>
            Adjust multiple criteria scores or apply multiplier factors to entire sections at once.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("scores")}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${mode === "scores" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Set Scores
          </button>
          <button
            type="button"
            onClick={() => setMode("multiplier")}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${mode === "multiplier" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Apply Multipliers
          </button>
        </div>

        {mode === "scores" && (
          <div className="space-y-3">
            {/* Target field */}
            <div>
              <Label className="text-xs">Score column</Label>
              <Select value={scoreField} onValueChange={setScoreField}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCORE_FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Score value */}
            <div>
              <Label className="text-xs">Score value</Label>
              <div className="flex gap-1.5 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScoreValue(n)}
                    className={`w-9 h-9 rounded-full text-sm font-bold border transition ${scoreValue === n ? "ring-2 ring-indigo-400 ring-offset-1 " + SCORE_COLORS[n] : SCORE_COLORS[n] + " opacity-60 hover:opacity-100"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope */}
            <div>
              <Label className="text-xs">Apply to</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All criteria</SelectItem>
                  <SelectItem value="section">A specific section</SelectItem>
                  <SelectItem value="selected">Selected criteria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === "section" && (
              <div>
                <Label className="text-xs">Section</Label>
                <Select value={sectionId} onValueChange={setSectionId}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(blocks || []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} ({b.weight}%)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "selected" && (
              <div className="border border-gray-200 rounded-md">
                <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b">
                  <span className="text-xs text-gray-600">{selectedCritIds.length} selected</span>
                  <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => setSelectedCritIds(allCriteria.map(({ crit }) => crit.id))}>Select all</button>
                </div>
                <ScrollArea className="h-40">
                  <div className="divide-y divide-gray-100">
                    {allCriteria.map(({ block, crit }) => (
                      <label key={crit.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                        <Checkbox checked={selectedCritIds.includes(crit.id)} onCheckedChange={() => toggleCrit(crit.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{crit.name}</div>
                          <div className="text-[10px] text-gray-400">{block.name}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              This will overwrite existing {SCORE_FIELDS.find((f) => f.key === scoreField)?.label} scores for {targetCount} criteria.
            </div>
          </div>
        )}

        {mode === "multiplier" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-medium">Enable multiplier</span>
              </div>
              <Switch checked={mulEnabled} onCheckedChange={setMulEnabled} />
            </div>

            <div>
              <Label className="text-xs">Multiplier value</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={mulValue}
                onChange={(e) => setMulValue(parseFloat(e.target.value) || 1)}
                disabled={!mulEnabled}
                className="h-8 mt-1"
              />
              <p className="text-[10px] text-gray-400 mt-1">e.g. 1.5 increases a section's influence by 50%, 0.5 halves it. Effective weights are normalized so the total stays 100%.</p>
            </div>

            <div>
              <Label className="text-xs">Apply to</Label>
              <Select value={mulScope} onValueChange={setMulScope}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  <SelectItem value="section">Selected sections</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mulScope === "section" && (
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                {(blocks || []).map((b) => (
                  <label key={b.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                    <Checkbox checked={mulSectionIds.includes(b.id)} onCheckedChange={() => toggleMulSection(b.id)} />
                    <span className="text-xs font-medium flex-1">{b.name}</span>
                    <span className="text-[10px] text-gray-400">{b.weight}% {b.multiplier_enabled ? `· ×${b.multiplier}` : ""}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Side-by-side rubric preview: current vs. with the proposed multiplier,
                with changed effective weights visually highlighted. */}
            <div className="rounded-md border border-indigo-100 bg-indigo-50/40 p-2.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                <Gauge className="w-3.5 h-3.5" />
                Rubric Preview — effective weight changes
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 items-center text-[11px]">
                {/* Header row */}
                <div className="text-gray-500 font-medium pl-1">Current</div>
                <div></div>
                <div className="text-indigo-700 font-medium pl-1">With Multiplier</div>
                <div className="col-span-3 border-b border-indigo-100 my-0.5"></div>
                {(blocks || []).map((b) => {
                  const cur = currentMap[b.id];
                  const nxt = previewMap[b.id];
                  const curPct = cur?.normalizedPct ?? 0;
                  const nxtPct = nxt?.normalizedPct ?? 0;
                  const changed = Math.abs(curPct - nxtPct) > 0.05;
                  const isTarget = (mulScope === "all" ? true : mulSectionIds.includes(b.id)) && (mulEnabled ? mulValue !== 1 : b.multiplier_enabled);
                  const delta = nxtPct - curPct;
                  return (
                    <React.Fragment key={b.id}>
                      <div className={`rounded px-1.5 py-1 ${changed ? "bg-amber-100/70" : "bg-white/60"}`}>
                        <div className="font-medium text-gray-700 truncate">{b.name}</div>
                        <div className="text-gray-400">
                          {b.weight}% {b.multiplier_enabled ? `· ×${b.multiplier}` : ""}
                          <span className="text-gray-500 font-medium"> → {curPct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        {changed ? (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${delta > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                            title={delta > 0 ? "Increased" : "Decreased"}
                          >
                            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                          </span>
                        ) : (
                          <ArrowRight className="w-3 h-3 text-gray-300" />
                        )}
                      </div>
                      <div className={`rounded px-1.5 py-1 ${changed ? "bg-amber-100/70 ring-1 ring-amber-200" : "bg-white/60"} ${isTarget ? "border border-indigo-200" : ""}`}>
                        <div className="font-medium text-gray-700 truncate flex items-center gap-1">
                          {b.name}
                          {isTarget && mulEnabled && mulValue !== 1 && (
                            <span className="text-[9px] text-indigo-600 font-semibold">×{mulValue}</span>
                          )}
                        </div>
                        <div className="text-gray-500 font-medium">{nxtPct.toFixed(1)}%</div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                <span>Total stays 100% (normalized)</span>
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-200" /> changed</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded border border-indigo-200 bg-white" /> targeted</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              This will overwrite the multiplier setting for {mulScope === "all" ? (blocks?.length || 0) : mulSectionIds.length} section(s).
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleApply} disabled={!canApply}>Apply Bulk Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}