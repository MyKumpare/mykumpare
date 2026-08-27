import React from "react";
import { Button } from "@/components/ui/button";
import { Lock, AlertTriangle, Unlock } from "lucide-react";

/**
 * Warning dialog shown when a user attempts to edit a closed (finalized) scoring.
 * The user must confirm they want to reopen the closed scoring before edits are allowed.
 *
 * Props:
 *   open - whether the dialog is visible
 *   onConfirm - callback when the user confirms reopening
 *   onCancel  - callback when the user cancels
 *   versionNumber - the version being reopened
 */
export default function ClosedScoringEditWarning({ open, onConfirm, onCancel, versionNumber }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Closed Scoring</h3>
            <p className="text-xs text-gray-500">This scoring is finalized and closed</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-700">
            Scoring <strong>v{versionNumber || 1}</strong> has been finalized and closed. Closed scorings are part of the historical record and should not normally be edited.
          </p>
          <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                If you need to re-evaluate this manager product, consider <strong>starting a re-scoring</strong> instead — this preserves the closed scoring for history and creates a new version with the prior scores as a baseline.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            If you still need to edit this closed scoring directly, you can reopen it. The scoring will no longer be marked as closed, and the status will revert to "ic_review" so you can adjust and re-finalize.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onConfirm}
            className="border-amber-400 text-amber-700 hover:bg-amber-50"
          >
            <Unlock className="w-3.5 h-3.5" /> Reopen to Edit
          </Button>
        </div>
      </div>
    </div>
  );
}