import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { fieldLabel } from "./firmFieldDuplicateCheck";

// Confirmation dialog shown when a firm's website, email, or LinkedIn URL
// matches (exactly or closely) an existing firm. For each conflict the user
// chooses to Accept (proceed with the save) or Reject (go back to editing).
//
// conflicts: [{ field, currentValue, existingFirm, existingValue, matchType }]
// onAccept: () => void   — proceed with the save
// onReject: () => void   — cancel and return to the form
export default function SimilarFirmFieldDialog({ open, onOpenChange, conflicts, onAccept, onReject }) {
  const list = conflicts || [];
  const exactCount = list.filter((c) => c.matchType === "exact").length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onReject?.(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Possible duplicate firm detected
          </DialogTitle>
          <DialogDescription>
            The {list.length > 1 ? "following fields" : "following field"} on this firm {list.length > 1 ? "match" : "matches"} another firm already in the system.
            {" "}
            {exactCount > 0
              ? `${exactCount} exact match${exactCount > 1 ? "es" : ""} found.`
              : "Similar (but not identical) matches found."}
            {" "}Please review and choose whether to accept or reject.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
          {list.map((c, i) => {
            const types = c.existingFirm?.firm_types?.length
              ? c.existingFirm.firm_types
              : (c.existingFirm?.firm_type ? [c.existingFirm.firm_type] : []);
            return (
              <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700">{fieldLabel(c.field)}</span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      c.matchType === "exact"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {c.matchType === "exact" ? "Exact match" : "Similar"}
                  </span>
                </div>
                <div className="text-xs text-gray-800 break-words">
                  <span className="text-gray-500">This firm: </span>
                  <span className="font-medium">{c.currentValue || "—"}</span>
                </div>
                <div className="text-xs text-gray-800 break-words">
                  <span className="text-gray-500">
                    Existing firm <span className="font-semibold text-gray-700">{c.existingFirm?.name}</span>
                    {types.length > 0 ? ` (${types.join(", ")})` : ""}:
                  </span>{" "}
                  <span className="font-medium">{c.existingValue || "—"}</span>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onReject?.()}>
            Reject
          </Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => onAccept?.()}>
            Accept &amp; Save Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}