import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

export default function DeleteContactConfirmDialog({ open, onOpenChange, contact, onConfirm, deleting }) {
  if (!contact) return null;

  const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-2 text-base">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{displayName}"</span>?
            <p className="mt-3 text-sm text-red-700 bg-red-50 p-3 rounded-md space-y-1">
              <span className="block font-medium">This will permanently remove all associated data, including:</span>
              <span className="block">• External party portal access & pending invitations</span>
              <span className="block">• Activity logs and follow-up tasks</span>
              <span className="block">• Due diligence assignments and notifications</span>
              <span className="block">• External chat conversations</span>
              <span className="block">• Product investment team membership</span>
              <span className="block">• Questionnaire assignments</span>
              <span className="block">• Org chart entries</span>
            </p>
            <p className="mt-2 text-xs text-gray-500">
              The contact record itself will be moved to trash and can be restored from Deleted Records, but the associated data above will be permanently removed.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {deleting ? "Deleting..." : "Yes, Delete Everything"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}