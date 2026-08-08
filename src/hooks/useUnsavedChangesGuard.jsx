import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * Reusable guard that intercepts a form/dialog close when there are unsaved
 * changes, showing a confirmation dialog. If there are no changes, the close
 * proceeds immediately.
 *
 * @param {boolean} hasChanges — whether the form has unsaved modifications
 * @param {Function} onClose — called when the close is confirmed (or no changes)
 * @param {Function} [onSave] — optional save handler; when provided, a "Save"
 *   button is shown that saves the changes and then closes
 * @returns {{ guardedClose: Function, guardDialog: JSX.Element }}
 *   - guardedClose: call this from your Dialog's onOpenChange(false) path
 *   - guardDialog: render this inside your form's Dialog tree
 */
export function useUnsavedChangesGuard(hasChanges, onClose, onSave) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const guardedClose = useCallback(() => {
    if (hasChanges) {
      setShowConfirm(true);
    } else {
      onClose?.();
    }
  }, [hasChanges, onClose]);

  const confirmDiscard = useCallback(() => {
    setShowConfirm(false);
    onClose?.();
  }, [onClose]);

  const cancelDiscard = useCallback(() => {
    setShowConfirm(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave) { setShowConfirm(false); onClose?.(); return; }
    try {
      setSaving(true);
      // Trigger the save flow. The save handler is responsible for closing
      // the dialog on success (typically via its mutation's onSuccess). We
      // only dismiss the confirm modal here — if the save bails early
      // (validation, duplicate warnings), the dialog stays open so the user
      // can address the issue, exactly as if they'd clicked the form's
      // primary Save button.
      await onSave();
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const guardDialog = (
    <Dialog open={showConfirm} onOpenChange={(v) => { if (!v) cancelDiscard(); }}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader className="items-center space-y-0">
          <DialogTitle className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Unsaved Changes
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 py-2 px-2">
          You have unsaved changes that will be lost. Are you sure you want to close without saving?
        </p>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={cancelDiscard} disabled={saving}>Keep Editing</Button>
          {onSave && (
            <Button variant="default" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
          <Button variant="destructive" onClick={confirmDiscard} disabled={saving}>Close Without Saving</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { guardedClose, guardDialog };
}