import React from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

export default function DeleteConfirmDialog({ open, onOpenChange, firm, onConfirm, loading }) {
  if (!firm) return null;

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <AlertDialogTitle>Delete Firm</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-2 text-base">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{firm.name}"</span>?
            <p className="mt-3 text-sm text-red-700 bg-red-50 p-3 rounded-md">
              <strong>Warning:</strong> All records tied to this firm will also be deleted, including its
              products, contacts, documents, due diligence records, portfolios, ownership, org charts,
              return series, activities, and follow-up tasks.
            </p>
            <p className="mt-2 text-xs text-amber-700">
              The firm, its products, contacts, and portfolios are moved to trash and can be restored from
              Deleted Records. Everything else is permanently deleted and cannot be recovered.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}