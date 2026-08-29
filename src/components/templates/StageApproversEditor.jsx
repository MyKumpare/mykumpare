import React, { useMemo } from "react";
import { Plus, Trash2, ShieldCheck, UserCheck, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

let _saId = 0;
const nextSaId = () => `sa_${Date.now()}_${++_saId}`;
let _arId = 0;
const nextArId = () => `ar_${Date.now()}_${++_arId}`;

const COMMON_ROLES = [
  "Supervisor",
  "Primary Analyst",
  "Secondary Analyst",
  "Investment Committee Chair",
  "Investment Committee Member",
  "Chief Investment Officer",
  "Head of Research",
  "Compliance Officer",
];

/**
 * Template-level editor for assigning approver roles to each stage.
 * Defines which roles must digitally sign off before the process can
 * advance past each stage. Copied to the DueDiligence record on creation,
 * where specific contacts are assigned to each role.
 *
 * Props:
 *   stages         — [{ id, name, sub_stages }]  (template stages)
 *   stageApprovers — array of { id, stage_id, stage_name, approver_roles: [{ id, role, required }] }
 *   onChange       — (newStageApprovers) => void
 */
export default function StageApproversEditor({ stages = [], stageApprovers = [], onChange }) {
  // Sync stage names and remove entries for deleted stages
  const synced = useMemo(() => {
    const stageIds = new Set(stages.map((s) => s.id));
    return stageApprovers
      .filter((sa) => stageIds.has(sa.stage_id))
      .map((sa) => {
        const stage = stages.find((s) => s.id === sa.stage_id);
        return { ...sa, stage_name: stage?.name || sa.stage_name || "" };
      });
  }, [stageApprovers, stages]);

  // Auto-create entries for stages that don't have one yet
  const entries = useMemo(() => {
    const existingStageIds = new Set(synced.map((sa) => sa.stage_id));
    const missing = stages
      .filter((s) => !existingStageIds.has(s.id))
      .map((s) => ({
        id: nextSaId(),
        stage_id: s.id,
        stage_name: s.name || "",
        approver_roles: [],
      }));
    return [...synced, ...missing];
  }, [synced, stages]);

  const updateEntry = (stageId, updates) => {
    const existing = entries.find((sa) => sa.stage_id === stageId);
    if (!existing) return;
    const next = entries.map((sa) =>
      sa.stage_id === stageId ? { ...sa, ...updates } : sa
    );
    onChange(next);
  };

  const addRole = (stageId) => {
    const entry = entries.find((sa) => sa.stage_id === stageId);
    if (!entry) return;
    const newRole = { id: nextArId(), role: "", required: true };
    updateEntry(stageId, {
      approver_roles: [...(entry.approver_roles || []), newRole],
    });
  };

  const updateRole = (stageId, roleId, updates) => {
    const entry = entries.find((sa) => sa.stage_id === stageId);
    if (!entry) return;
    updateEntry(stageId, {
      approver_roles: (entry.approver_roles || []).map((r) =>
        r.id === roleId ? { ...r, ...updates } : r
      ),
    });
  };

  const removeRole = (stageId, roleId) => {
    const entry = entries.find((sa) => sa.stage_id === stageId);
    if (!entry) return;
    updateEntry(stageId, {
      approver_roles: (entry.approver_roles || []).filter((r) => r.id !== roleId),
    });
  };

  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-gray-400" />
          <Label className="text-xs font-medium text-gray-700">Stage Approvers</Label>
        </div>
        <p className="text-xs text-gray-400 italic">
          Add stages first to assign approvers to each stage.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-rose-600" />
        <Label className="text-xs font-medium text-gray-700">Stage Approvers</Label>
      </div>

      <p className="text-[11px] text-gray-500">
        Assign approver roles to each stage. When a due diligence record is created from this template, specific contacts are assigned to each role. All required approvers must digitally sign off before the process can advance to the next stage.
      </p>

      <div className="space-y-1.5">
        {stages.map((stage, sIdx) => {
          const entry = entries.find((sa) => sa.stage_id === stage.id);
          const roles = entry?.approver_roles || [];
          return (
            <div key={stage.id} className="border border-rose-200 rounded-md bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-50/50">
                <span className="text-[10px] font-bold text-rose-600 shrink-0">Stage {sIdx + 1}</span>
                <span className="text-xs font-medium text-gray-700 truncate flex-1">{stage.name || `Stage ${sIdx + 1}`}</span>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {roles.length} approver{roles.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="p-2 space-y-1.5">
                {roles.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic pl-1">No approver roles assigned. The stage will advance without sign-off.</p>
                ) : (
                  roles.map((role, rIdx) => (
                    <div key={role.id} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 shrink-0 w-4">{rIdx + 1}.</span>
                      <Input
                        value={role.role}
                        onChange={(e) => updateRole(stage.id, role.id, { role: e.target.value })}
                        placeholder="Approver role..."
                        className="h-7 text-xs flex-1"
                        list={`role-suggestions-${stage.id}`}
                      />
                      <datalist id={`role-suggestions-${stage.id}`}>
                        {COMMON_ROLES.map((r) => (
                          <option key={r} value={r} />
                        ))}
                      </datalist>
                      <div className="flex items-center gap-1 shrink-0">
                        <Label className="text-[9px] text-gray-400 cursor-pointer">Req</Label>
                        <Switch
                          checked={role.required !== false}
                          onCheckedChange={(v) => updateRole(stage.id, role.id, { required: v })}
                          className="scale-75"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-red-600 shrink-0"
                        onClick={() => removeRole(stage.id, role.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-rose-600 hover:text-rose-800 px-1.5"
                  onClick={() => addRole(stage.id)}
                >
                  <Plus className="w-3 h-3" /> Add Approver Role
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}