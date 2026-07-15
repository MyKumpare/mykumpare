import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, UserPlus, UserCog, Info } from "lucide-react";

export default function EnrichmentApprovalDialog({
  open,
  onOpenChange,
  onConfirm,
  contactUpdates = [],
  newContacts = [],
  firmFieldsApplied = [],
}) {
  const hasContactChanges = contactUpdates.length > 0 || newContacts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Approve Enrichment Updates
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[55vh] overflow-y-auto">
          {firmFieldsApplied.length > 0 && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1">
                Firm fields populated (review in form before saving):
              </p>
              <p className="text-sm text-indigo-900">{firmFieldsApplied.join(", ")}</p>
            </div>
          )}
          {contactUpdates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <UserCog className="w-3.5 h-3.5" /> Update existing contacts ({contactUpdates.length}):
              </p>
              {contactUpdates.map((cu, i) => (
                <div key={i} className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                  <p className="font-medium text-sm text-gray-800">{cu.contactName}</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    New: {cu.updatedFields.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
          {newContacts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Create new contacts ({newContacts.length}):
              </p>
              {newContacts.map((nc, i) => {
                const name = [nc.first_name, nc.last_name].filter(Boolean).join(" ");
                return (
                  <div key={i} className="rounded-lg border border-green-200 bg-green-50 p-2.5">
                    <p className="font-medium text-sm text-gray-800">
                      {name}
                      {nc.title ? ` — ${nc.title}` : ""}
                    </p>
                    {nc.email && <p className="text-xs text-gray-500 mt-0.5">{nc.email}</p>}
                  </div>
                );
              })}
            </div>
          )}
          {!hasContactChanges && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4 justify-center">
              <Info className="w-4 h-4" /> No new contact information to add.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            disabled={!hasContactChanges}
          >
            Approve & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}