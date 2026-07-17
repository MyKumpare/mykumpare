import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, UserPlus, UserCog, Info, FileText } from "lucide-react";

export default function EnrichmentApprovalDialog({
  open,
  onOpenChange,
  onConfirm,
  contactUpdates = [],
  newContacts = [],
  firmFieldsApplied = [],
}) {
  // Per-contact opt-in for biography updates. Keyed by contact id.
  const [approvedBios, setApprovedBios] = useState({});

  // Reset selection when the set of contacts with biography changes changes.
  const bioContactIds = contactUpdates.filter((cu) => cu.biographyChange).map((cu) => cu.id);
  React.useEffect(() => {
    setApprovedBios((prev) => {
      const next = {};
      for (const id of bioContactIds) next[id] = !!prev[id];
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioContactIds.join(",")]);

  const toggleBio = (id) => setApprovedBios((prev) => ({ ...prev, [id]: !prev[id] }));

  const hasContactChanges = contactUpdates.length > 0 || newContacts.length > 0;
  const approvedBioSet = new Set(Object.keys(approvedBios).filter((id) => approvedBios[id]));

  const handleConfirm = () => {
    onConfirm(approvedBioSet);
    onOpenChange(false);
  };

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
              {contactUpdates.map((cu, i) => {
                const newPhoto = cu.updates?.photo_url;
                const hasBioChange = !!cu.biographyChange;
                const bioApproved = !!approvedBios[cu.id];
                return (
                  <div key={i} className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 space-y-2">
                    <div className="flex items-center gap-2.5">
                      {newPhoto && (
                        <img src={newPhoto} alt={cu.contactName} className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-800">{cu.contactName}</p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          New: {cu.updatedFields.length > 0 ? cu.updatedFields.join(", ") : "—"}
                        </p>
                      </div>
                    </div>
                    {hasBioChange && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`bio-${cu.id}`}
                            checked={bioApproved}
                            onCheckedChange={() => toggleBio(cu.id)}
                            className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                          />
                          <label htmlFor={`bio-${cu.id}`} className="text-xs font-semibold text-amber-800 flex items-center gap-1 cursor-pointer">
                            <FileText className="w-3.5 h-3.5" /> Biography changed — update?
                          </label>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 pl-6">
                          <div>
                            <p className="text-[10px] font-medium text-gray-500 uppercase">Current</p>
                            <p className="text-xs text-gray-700 break-words line-clamp-4">
                              {cu.biographyChange.existing.length > 200
                                ? cu.biographyChange.existing.substring(0, 200) + "…"
                                : cu.biographyChange.existing}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-amber-700 uppercase">From website</p>
                            <p className="text-xs text-amber-900 break-words line-clamp-4">
                              {cu.biographyChange.incoming.length > 200
                                ? cu.biographyChange.incoming.substring(0, 200) + "…"
                                : cu.biographyChange.incoming}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
                    <div className="flex items-center gap-2.5">
                      {nc.photo_url && (
                        <img src={nc.photo_url} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-800">
                          {name}
                          {nc.title ? ` — ${nc.title}` : ""}
                        </p>
                        {nc.email && <p className="text-xs text-gray-500 mt-0.5">{nc.email}</p>}
                      </div>
                    </div>
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
            onClick={handleConfirm}
            disabled={!hasContactChanges}
          >
            Approve & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}