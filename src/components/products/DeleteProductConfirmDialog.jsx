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
import { AlertCircle } from "lucide-react";

export default function DeleteProductConfirmDialog({ open, onOpenChange, product, onConfirm }) {
  if (!product) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-2 text-base">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{product.name}"</span>?
            <p className="mt-3 text-sm text-amber-700 bg-amber-50 p-3 rounded-md">
              This record will be moved to trash and can be restored later from Deleted Records. You can permanently delete it afterwards.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}