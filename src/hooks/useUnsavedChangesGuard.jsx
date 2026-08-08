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
 * @returns {{ guardedClose: Function, guardDialog: JSX.Element }}
 *   - guardedClose: call this from your Dialog's onOpenChange(false) path
 *   - guardDialog: render this inside your form's Dialog tree
 */
export function useUnsavedChangesGuard(hasChanges, onClose) {
  const [showConfirm, setShowConfirm] = useState(false);

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

  const guardDialog = (
    <Dialog open={showConfirm} onOpenChange={(v) => { if (!v) cancelDiscard(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Unsaved Changes
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 py-2">
          You have unsaved changes that will be lost. Are you sure you want to close without saving?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={cancelDiscard}>Keep Editing</Button>
          <Button variant="destructive" onClick={confirmDiscard}>Close Without Saving</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { guardedClose, guardDialog };
}