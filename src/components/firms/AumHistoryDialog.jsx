import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarChart3 } from "lucide-react";
import FirmAumHistoryTab from "./FirmAumHistoryTab";

/**
 * Standalone top-level dialog for viewing/editing AUM history.
 * Opens outside the nested firm/product edit form so clipboard paste
 * (navigator.clipboard.readText) works reliably with proper focus.
 *
 * Works for both Firm and Product entities via the `entityName` prop.
 */
export default function AumHistoryDialog({
  open,
  onOpenChange,
  entityName = "Firm",
  entityLabel,
  recordId,
  recordName,
}) {
  const label = entityLabel || entityName;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            {label} AUM History
            {recordName && (
              <span className="text-sm font-normal text-gray-400 truncate">
                — {recordName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {open && recordId && (
            <FirmAumHistoryTab
              firmId={recordId}
              firmName={recordName}
              entityName={entityName}
              entityLabel={label}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}