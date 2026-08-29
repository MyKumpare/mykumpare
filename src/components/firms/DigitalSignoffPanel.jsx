import React, { useMemo, useState } from "react";
import {
  ShieldCheck, ShieldX, CheckCircle2, Clock, UserCheck,
  PenLine, Lock, AlertCircle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const sigId = () => `sig_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * Checks whether all required approvers for a given stage have digitally signed.
 * Returns { signed, pending, total, requiredTotal, allSigned, pendingRequired }
 */
export function evaluateStageSignoff(stageApprovers, digitalSignatures, stageId) {
  const entry = (stageApprovers || []).find((sa) => sa.stage_id === stageId);
  if (!entry || !entry.approver_roles || entry.approver_roles.length === 0) {
    return { hasApprovers: false, allSigned: true, pendingRequired: [], signedCount: 0, requiredCount: 0 };
  }
  const roles = entry.approver_roles;
  const sigs = (digitalSignatures || []).filter((s) => s.stage_id === stageId);

  const pendingRequired = [];
  let signedCount = 0;
  let requiredCount = 0;

  for (const role of roles) {
    if (role.required !== false) requiredCount++;
    const sig = sigs.find((s) => s.approver_role_id === role.id);
    if (sig) {
      signedCount++;
    } else if (role.required !== false) {
      pendingRequired.push(role);
    }
  }

  return {
    hasApprovers: true,
    allSigned: pendingRequired.length === 0,
    pendingRequired,
    signedCount,
    requiredCount,
    total: roles.length,
  };
}

/**
 * Digital Sign-off Panel for the due diligence flow.
 * Shows the approver roles assigned to each stage, lets the user assign
 * specific contacts to each role, and collects digital signatures.
 * A stage cannot advance until all required approvers have signed.
 *
 * Props:
 *   stages             — DD stages array (with id, name, completed, supervisor_status)
 *   stageApprovers     — array of { id, stage_id, stage_name, approver_roles: [{ id, role, required, contact_id, contact_name }] }
 *   digitalSignatures  — array of { id, stage_id, approver_role_id, role, contact_id, contact_name, signed_at, signature_date, comment }
 *   teamMembers        — [{ value, label }]  (contacts to assign to roles)
 *   currentUserId      — contact ID of the current user
 *   currentUserName    — display name of the current user
 *   onChangeApprovers  — (newStageApprovers) => void
 *   onChangeSignatures — (newDigitalSignatures) => void
 */
export default function DigitalSignoffPanel({
  stages = [],
  stageApprovers = [],
  digitalSignatures = [],
  teamMembers = [],
  currentUserId = "",
  currentUserName = "",
  onChangeApprovers,
  onChangeSignatures,
}) {
  const [signDialog, setSignDialog] = useState(null); // { stageId, role }

  const updateRoleContact = (stageId, roleId, contactId) => {
    const member = teamMembers.find((m) => m.value === contactId);
    const next = (stageApprovers || []).map((sa) => {
      if (sa.stage_id !== stageId) return sa;
      return {
        ...sa,
        approver_roles: (sa.approver_roles || []).map((r) =>
          r.id === roleId
            ? { ...r, contact_id: contactId, contact_name: member?.label || "" }
            : r
        ),
      };
    });
    onChangeApprovers(next);
  };

  const handleSign = (stageId, role, comment) => {
    const stage = stages.find((s) => s.id === stageId);
    const newSig = {
      id: sigId(),
      stage_id: stageId,
      stage_name: stage?.name || "",
      approver_role_id: role.id,
      role: role.role,
      contact_id: role.contact_id || currentUserId,
      contact_name: role.contact_name || currentUserName,
      signed_at: new Date().toISOString(),
      signature_date: format(new Date(), "yyyy-MM-dd"),
      comment: comment || "",
      signed_by_user_id: currentUserId,
      signed_by_user_name: currentUserName,
    };
    // Remove any existing signature for this role (re-signing replaces)
    const filtered = (digitalSignatures || []).filter(
      (s) => !(s.stage_id === stageId && s.approver_role_id === role.id)
    );
    onChangeSignatures([...filtered, newSig]);
    setSignDialog(null);
  };

  const handleRevoke = (stageId, roleId) => {
    const next = (digitalSignatures || []).filter(
      (s) => !(s.stage_id === stageId && s.approver_role_id === roleId)
    );
    onChangeSignatures(next);
  };

  // Only show stages that have approver roles defined
  const stagesWithApprovers = useMemo(() => {
    return (stages || []).filter((stage) => {
      const entry = (stageApprovers || []).find((sa) => sa.stage_id === stage.id);
      return entry && entry.approver_roles && entry.approver_roles.length > 0;
    });
  }, [stages, stageApprovers]);

  if (stagesWithApprovers.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50/30 p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-rose-600" />
        <Label className="text-xs font-medium text-gray-700">Digital Sign-off</Label>
      </div>
      <p className="text-[11px] text-gray-500">
        Assign a contact to each approver role, then collect their digital signature. All required approvers must sign off before the stage can advance.
      </p>

      <div className="space-y-1.5">
        {stagesWithApprovers.map((stage) => {
          const entry = (stageApprovers || []).find((sa) => sa.stage_id === stage.id);
          const roles = entry?.approver_roles || [];
          const evalResult = evaluateStageSignoff(stageApprovers, digitalSignatures, stage.id);
          const isComplete = !!stage.completed;

          return (
            <div key={stage.id} className={cn(
              "border rounded-md bg-white overflow-hidden",
              isComplete ? "border-emerald-200" : evalResult.allSigned ? "border-emerald-200" : "border-gray-200"
            )}>
              {/* Stage header */}
              <div className={cn(
                "flex items-center gap-2 px-2.5 py-1.5",
                isComplete ? "bg-emerald-50/50" : evalResult.allSigned ? "bg-emerald-50/50" : "bg-gray-50/50"
              )}>
                <span className="text-xs font-medium text-gray-700 flex-1 truncate">{stage.name || "Unnamed Stage"}</span>
                {evalResult.hasApprovers && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0",
                    evalResult.allSigned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {evalResult.allSigned ? (
                      <><CheckCircle2 className="w-2.5 h-2.5" /> {evalResult.signedCount}/{evalResult.total} signed</>
                    ) : (
                      <><Clock className="w-2.5 h-2.5" /> {evalResult.signedCount}/{evalResult.total} signed</>
                    )}
                  </span>
                )}
              </div>

              {/* Approver roles */}
              <div className="p-2 space-y-1.5">
                {roles.map((role) => {
                  const sig = (digitalSignatures || []).find(
                    (s) => s.stage_id === stage.id && s.approver_role_id === role.id
                  );
                  const isRequired = role.required !== false;
                  const canSign = !!role.contact_id;

                  return (
                    <div key={role.id} className="flex items-center gap-1.5 rounded border border-gray-100 bg-gray-50/30 px-2 py-1.5">
                      {/* Role label */}
                      <div className="shrink-0 w-24">
                        <span className="text-[10px] font-medium text-gray-600 block truncate">
                          {role.role || "Approver"}
                        </span>
                        {!isRequired && (
                          <span className="text-[9px] text-gray-400">optional</span>
                        )}
                      </div>

                      {/* Contact assignment */}
                      <Select
                        value={role.contact_id || ""}
                        onValueChange={(v) => updateRoleContact(stage.id, role.id, v)}
                        disabled={!!sig}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                          <SelectValue placeholder="Assign contact..." />
                        </SelectTrigger>
                        <SelectContent>
                          {teamMembers.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Sign-off status / action */}
                      {sig ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-emerald-600 flex items-center gap-0.5" title={`Signed by ${sig.contact_name} on ${sig.signature_date}`}>
                            <CheckCircle2 className="w-3 h-3" /> {sig.signature_date}
                          </span>
                          {!isComplete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-gray-400 hover:text-red-600 px-1"
                              onClick={() => handleRevoke(stage.id, role.id)}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ) : canSign ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-[10px] bg-rose-600 hover:bg-rose-700 text-white shrink-0"
                          onClick={() => setSignDialog({ stageId: stage.id, role })}
                        >
                          <PenLine className="w-3 h-3" /> Sign Off
                        </Button>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic shrink-0">Assign first</span>
                      )}
                    </div>
                  );
                })}

                {/* Blocking warning */}
                {!evalResult.allSigned && !isComplete && evalResult.pendingRequired.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    <Lock className="w-2.5 h-2.5 shrink-0" />
                    <span>
                      Stage is locked until {evalResult.pendingRequired.length} required approver{evalResult.pendingRequired.length !== 1 ? "s" : ""} sign off:{" "}
                      {evalResult.pendingRequired.map((r) => r.role || "Approver").join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Digital Sign-off Dialog */}
      {signDialog && (
        <SignOffDialog
          stageName={stages.find((s) => s.id === signDialog.stageId)?.name || ""}
          role={signDialog.role}
          onClose={() => setSignDialog(null)}
          onConfirm={(comment) => handleSign(signDialog.stageId, signDialog.role, comment)}
        />
      )}
    </div>
  );
}

function SignOffDialog({ stageName, role, onClose, onConfirm }) {
  const [comment, setComment] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-4 h-4 text-rose-600" />
            Digital Sign-off
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-rose-50 border border-rose-200 p-3 space-y-1">
            <p className="text-xs text-gray-600">
              <span className="font-medium">Stage:</span> {stageName}
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-medium">Approver Role:</span> {role.role || "Approver"}
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-medium">Signing as:</span> {role.contact_name || "Current user"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Comment (optional)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note about your approval decision..."
              className="text-xs min-h-[60px]"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-gray-600">
              I confirm that I have reviewed all sub-stages and documentation for this stage, and I approve advancing to the next stage. My digital signature will be recorded with a timestamp.
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-rose-600 hover:bg-rose-700 text-white"
            disabled={!confirmed}
            onClick={() => onConfirm(comment)}
          >
            <PenLine className="w-3.5 h-3.5" /> Sign Off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}