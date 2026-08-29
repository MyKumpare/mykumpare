import React, { useState } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, GripVertical,
  FileText, FileCheck, BarChart3, ClipboardCheck, ShieldCheck,
  AlignLeft, Calculator, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

let _gateId = 0;
const nextGateId = () => `pl_gate_${Date.now()}_${++_gateId}`;
let _reqId = 0;
const nextReqId = () => `pl_req_${Date.now()}_${++_reqId}`;

const REQ_TYPES = [
  { value: "sub_stage_completion", label: "Sub-Stage Completion", icon: ClipboardCheck, color: "text-indigo-600" },
  { value: "document_attachment", label: "Document Attachment", icon: FileText, color: "text-cyan-600" },
  { value: "form_completion", label: "Form Completion", icon: FileCheck, color: "text-blue-600" },
  { value: "score_card_completion", label: "Score Card Completion", icon: BarChart3, color: "text-purple-600" },
  { value: "qualitative_analysis", label: "Qualitative Analysis", icon: AlignLeft, color: "text-amber-600" },
  { value: "quantitative_analysis", label: "Quantitative Analysis", icon: Calculator, color: "text-emerald-600" },
  { value: "approval", label: "Approval", icon: ShieldCheck, color: "text-rose-600" },
];

const getReqTypeMeta = (type) => REQ_TYPES.find((t) => t.value === type) || REQ_TYPES[0];

const defaultRequirement = (type = "sub_stage_completion") => ({
  id: nextReqId(),
  type,
  label: "",
  stage_id: "",
  sub_stage_id: "",
  document_checklist_item_id: "",
  form_id: "",
  score_card_template_id: "",
  analysis_description: "",
  approval_role: "",
  required: true,
});

/**
 * Process Logic Editor for process templates.
 * Lets users define gate rules between consecutive stages. Each gate has
 * requirements (sub-stage completion, document attachment, form completion,
 * score card, qualitative/quantitative analysis, approval) that must all be
 * satisfied before the process can advance to the next stage.
 *
 * Props:
 *   stages        — [{ id, name, sub_stages: [{ id, name }] }]  (template stages)
 *   docChecklist  — [{ id, name }]  (template documentation checklist items)
 *   processLogic  — array of gate rule objects
 *   onChange      — (newProcessLogic) => void
 */
export default function ProcessLogicEditor({ stages = [], docChecklist = [], processLogic = [], onChange }) {
  const [expandedGates, setExpandedGates] = useState({});

  const toggleGate = (id) => setExpandedGates((prev) => ({ ...prev, [id]: !prev[id] }));

  // Auto-generate gates between consecutive stages when none exist
  const autoGenerateGates = () => {
    if (stages.length < 2) return;
    const gates = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const from = stages[i];
      const to = stages[i + 1];
      gates.push({
        id: nextGateId(),
        name: `Gate: ${from.name || `Stage ${i + 1}`} → ${to.name || `Stage ${i + 2}`}`,
        from_stage_id: from.id,
        from_stage_name: from.name,
        to_stage_id: to.id,
        to_stage_name: to.name,
        requirements: [
          {
            ...defaultRequirement("sub_stage_completion"),
            stage_id: from.id,
            label: `Complete all sub-stages in ${from.name || `Stage ${i + 1}`}`,
          },
        ],
      });
    }
    onChange(gates);
  };

  const addGate = () => {
    if (stages.length < 2) return;
    // Default: gate between the last two stages that don't have a gate yet
    const existingFromIds = new Set(processLogic.map((g) => g.from_stage_id));
    let fromIdx = -1;
    for (let i = stages.length - 2; i >= 0; i--) {
      if (!existingFromIds.has(stages[i].id)) {
        fromIdx = i;
        break;
      }
    }
    if (fromIdx === -1) fromIdx = stages.length - 2;

    const from = stages[fromIdx];
    const to = stages[fromIdx + 1];
    const newGate = {
      id: nextGateId(),
      name: `Gate: ${from.name || `Stage ${fromIdx + 1}`} → ${to.name || `Stage ${fromIdx + 2}`}`,
      from_stage_id: from.id,
      from_stage_name: from.name,
      to_stage_id: to.id,
      to_stage_name: to.name,
      requirements: [
        {
          ...defaultRequirement("sub_stage_completion"),
          stage_id: from.id,
          label: `Complete all sub-stages in ${from.name || `Stage ${fromIdx + 1}`}`,
        },
      ],
    };
    onChange([...processLogic, newGate]);
    setExpandedGates((prev) => ({ ...prev, [newGate.id]: true }));
  };

  const updateGate = (gateId, updates) => {
    onChange(processLogic.map((g) => (g.id === gateId ? { ...g, ...updates } : g)));
  };

  const removeGate = (gateId) => {
    onChange(processLogic.filter((g) => g.id !== gateId));
  };

  const addRequirement = (gateId) => {
    onChange(processLogic.map((g) =>
      g.id === gateId
        ? { ...g, requirements: [...g.requirements, defaultRequirement()] }
        : g
    ));
  };

  const updateRequirement = (gateId, reqId, updates) => {
    onChange(processLogic.map((g) =>
      g.id === gateId
        ? {
            ...g,
            requirements: g.requirements.map((r) => (r.id === reqId ? { ...r, ...updates } : r)),
          }
        : g
    ));
  };

  const removeRequirement = (gateId, reqId) => {
    onChange(processLogic.map((g) =>
      g.id === gateId
        ? { ...g, requirements: g.requirements.filter((r) => r.id !== reqId) }
        : g
    ));
  };

  // Sync gate stage names when stages are renamed
  const syncedGates = processLogic.map((g) => {
    const fromStage = stages.find((s) => s.id === g.from_stage_id);
    const toStage = stages.find((s) => s.id === g.to_stage_id);
    return {
      ...g,
      from_stage_name: fromStage?.name || g.from_stage_name,
      to_stage_name: toStage?.name || g.to_stage_name,
    };
  });

  // Available stage pairs (for the from/to dropdowns)
  const stageOptions = stages.map((s, i) => ({ value: s.id, label: `${s.name || `Stage ${i + 1}`}` }));

  if (stages.length < 2) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-gray-400" />
          <Label className="text-xs font-medium text-gray-700">Process Logic</Label>
        </div>
        <p className="text-xs text-gray-400 italic">
          Add at least two stages to define process logic gates between them.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-violet-600" />
          <Label className="text-xs font-medium text-gray-700">Process Logic</Label>
        </div>
        <div className="flex items-center gap-1.5">
          {processLogic.length === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"
              onClick={autoGenerateGates}
            >
              Auto-Generate Gates
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={addGate}
          >
            <Plus className="w-3.5 h-3.5" /> Add Gate
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-gray-500">
        Define rules that must be satisfied before the process can advance from one stage to the next. Each gate can require sub-stage completion, document attachment, form completion, score cards, analysis, or approval.
      </p>

      {syncedGates.length === 0 ? (
        <div className="text-center py-4 text-xs text-gray-400 border border-dashed border-gray-200 rounded-md">
          No process logic gates defined yet. Click "Auto-Generate Gates" to create a gate between each pair of consecutive stages, or "Add Gate" to create one manually.
        </div>
      ) : (
        <div className="space-y-1.5">
          {syncedGates.map((gate, gIdx) => {
            const expanded = expandedGates[gate.id];
            return (
              <div key={gate.id} className="border border-violet-200 rounded-md bg-white overflow-hidden">
                {/* Gate header */}
                <div className="flex items-center gap-2 px-2.5 py-2 bg-violet-50/50">
                  <button
                    type="button"
                    onClick={() => toggleGate(gate.id)}
                    className="text-violet-600 hover:text-violet-800 shrink-0"
                  >
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <span className="text-xs font-bold text-violet-700 shrink-0">Gate {gIdx + 1}</span>
                  <Input
                    value={gate.name}
                    onChange={(e) => updateGate(gate.id, { name: e.target.value })}
                    className="h-7 text-xs flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
                    placeholder="Gate name..."
                  />
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {gate.requirements.length} req{gate.requirements.length !== 1 ? "s" : ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-red-600 shrink-0"
                    onClick={() => removeGate(gate.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Gate body */}
                {expanded && (
                  <div className="p-2.5 space-y-2.5">
                    {/* From / To stage selectors */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-gray-500">From Stage</Label>
                        <Select
                          value={gate.from_stage_id}
                          onValueChange={(v) => {
                            const s = stages.find((st) => st.id === v);
                            updateGate(gate.id, { from_stage_id: v, from_stage_name: s?.name || "" });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {stageOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-gray-500">To Stage</Label>
                        <Select
                          value={gate.to_stage_id}
                          onValueChange={(v) => {
                            const s = stages.find((st) => st.id === v);
                            updateGate(gate.id, { to_stage_id: v, to_stage_name: s?.name || "" });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {stageOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Requirements */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-medium text-gray-600">Requirements (all must pass)</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-violet-600 hover:text-violet-800 px-1.5"
                          onClick={() => addRequirement(gate.id)}
                        >
                          <Plus className="w-3 h-3" /> Add Requirement
                        </Button>
                      </div>

                      {gate.requirements.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic pl-2">No requirements — the gate will pass automatically.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {gate.requirements.map((req, rIdx) => (
                            <RequirementEditor
                              key={req.id}
                              req={req}
                              index={rIdx}
                              stages={stages}
                              docChecklist={docChecklist}
                              onChange={(updates) => updateRequirement(gate.id, req.id, updates)}
                              onRemove={() => removeRequirement(gate.id, req.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RequirementEditor({ req, index, stages, docChecklist, onChange, onRemove }) {
  const meta = getReqTypeMeta(req.type);
  const ReqIcon = meta.icon;

  const handleTypeChange = (newType) => {
    const newMeta = getReqTypeMeta(newType);
    // Reset type-specific fields when switching types, keep common fields
    onChange({
      type: newType,
      stage_id: newType === "sub_stage_completion" ? req.stage_id : "",
      sub_stage_id: newType === "sub_stage_completion" ? req.sub_stage_id : "",
      document_checklist_item_id: newType === "document_attachment" ? req.document_checklist_item_id : "",
      form_id: newType === "form_completion" ? req.form_id : "",
      score_card_template_id: newType === "score_card_completion" ? req.score_card_template_id : "",
      analysis_description: (newType === "qualitative_analysis" || newType === "quantitative_analysis") ? req.analysis_description : "",
      approval_role: newType === "approval" ? req.approval_role : "",
      label: req.label || "",
    });
  };

  // Sub-stages for the selected stage (for sub_stage_completion)
  const selectedStage = stages.find((s) => s.id === req.stage_id);
  const subStageOptions = (selectedStage?.sub_stages || []).map((ss) => ({ value: ss.id, label: ss.name }));

  return (
    <div className="border border-gray-200 rounded-md bg-gray-50/50 p-2 space-y-1.5">
      {/* Requirement header */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 shrink-0">#{index + 1}</span>
        <ReqIcon className={cn("w-3.5 h-3.5 shrink-0", meta.color)} />
        <Select value={req.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REQ_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                <span className="flex items-center gap-1.5">
                  <t.icon className="w-3 h-3" /> {t.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 shrink-0">
          <Label className="text-[9px] text-gray-400 cursor-pointer">Req</Label>
          <Switch
            checked={req.required !== false}
            onCheckedChange={(v) => onChange({ required: v })}
            className="scale-75"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-400 hover:text-red-600 shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Type-specific configuration */}
      {req.type === "sub_stage_completion" && (
        <div className="grid grid-cols-2 gap-1.5 pl-5">
          <Select
            value={req.stage_id}
            onValueChange={(v) => {
              const s = stages.find((st) => st.id === v);
              onChange({ stage_id: v, sub_stage_id: "", label: s ? `Complete sub-stages in ${s.name}` : "" });
            }}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select stage..." /></SelectTrigger>
            <SelectContent>
              {stages.map((s, i) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name || `Stage ${i + 1}`}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={req.sub_stage_id || ""}
            onValueChange={(v) => {
              const ss = subStageOptions.find((o) => o.value === v);
              onChange({ sub_stage_id: v, label: ss ? `Complete: ${ss.label}` : `Complete all sub-stages in ${selectedStage?.name || ""}` });
            }}
            disabled={!req.stage_id}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="All sub-stages" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null} className="text-xs">All sub-stages</SelectItem>
              {subStageOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {req.type === "document_attachment" && (
        <div className="pl-5">
          <Select
            value={req.document_checklist_item_id || ""}
            onValueChange={(v) => {
              const item = docChecklist.find((d) => d.id === v);
              onChange({ document_checklist_item_id: v, label: item ? `Attach: ${item.name}` : "" });
            }}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select document checklist item..." /></SelectTrigger>
            <SelectContent>
              {docChecklist.length === 0 ? (
                <SelectItem value="_none" disabled className="text-xs text-gray-400">No checklist items defined</SelectItem>
              ) : (
                docChecklist.map((d) => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>)
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {req.type === "form_completion" && (
        <div className="pl-5">
          <Input
            value={req.form_id || ""}
            onChange={(e) => onChange({ form_id: e.target.value, label: e.target.value ? `Complete form: ${e.target.value}` : "" })}
            placeholder="Form/questionnaire ID or name..."
            className="h-7 text-xs"
          />
        </div>
      )}

      {req.type === "score_card_completion" && (
        <div className="pl-5">
          <Input
            value={req.score_card_template_id || ""}
            onChange={(e) => onChange({ score_card_template_id: e.target.value, label: e.target.value ? `Complete score card: ${e.target.value}` : "" })}
            placeholder="Scoring matrix template ID or name..."
            className="h-7 text-xs"
          />
        </div>
      )}

      {(req.type === "qualitative_analysis" || req.type === "quantitative_analysis") && (
        <div className="pl-5">
          <Input
            value={req.analysis_description || ""}
            onChange={(e) => onChange({ analysis_description: e.target.value, label: e.target.value ? `${req.type === "qualitative_analysis" ? "Qualitative" : "Quantitative"} analysis: ${e.target.value}` : "" })}
            placeholder={`Describe the ${req.type === "qualitative_analysis" ? "qualitative" : "quantitative"} analysis required...`}
            className="h-7 text-xs"
          />
        </div>
      )}

      {req.type === "approval" && (
        <div className="pl-5">
          <Input
            value={req.approval_role || ""}
            onChange={(e) => onChange({ approval_role: e.target.value, label: e.target.value ? `Approval: ${e.target.value}` : "" })}
            placeholder="Approver role (e.g. Supervisor, Investment Committee)..."
            className="h-7 text-xs"
          />
        </div>
      )}

      {/* Optional label override */}
      <div className="pl-5 flex items-center gap-1.5">
        <Label className="text-[9px] text-gray-400 shrink-0">Label</Label>
        <Input
          value={req.label || ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Display label (auto-generated if empty)..."
          className="h-6 text-[11px] border-none bg-transparent shadow-none focus-visible:ring-0"
        />
      </div>

      {!req.required && (
        <p className="pl-5 text-[9px] text-amber-600 flex items-center gap-0.5">
          <AlertCircle className="w-2.5 h-2.5" /> Optional — won't block the gate
        </p>
      )}
    </div>
  );
}