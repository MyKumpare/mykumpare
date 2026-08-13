import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, UserPlus, UserCog, Info, FileText, User, Loader2 } from "lucide-react";

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
  // Per-new-contact create checkbox. Default all checked; user can uncheck
  // contacts flagged as potential duplicates to skip creating them.
  const [createChecked, setCreateChecked] = useState({});

  // Reset selection when the set of contacts with biography changes changes.
  const bioContactIds = contactUpdates.filter((cu) => cu.biographyChange).map((cu) => cu.id);
  React.useEffect(() => {
    setApprovedBios((prev) => {
      const next = {};
      for (const id of bioContactIds) next[id] = prev[id] !== undefined ? prev[id] : true;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioContactIds.join(",")]);

  // Default all new contacts to checked (create them). Contacts with
  // potential duplicates are also defaulted to checked so the user sees
  // the warning and can actively decide to skip.
  React.useEffect(() => {
    setCreateChecked((prev) => {
      const next = {};
      for (let i = 0; i < newContacts.length; i++) {
        next[i] = prev[i] !== undefined ? prev[i] : true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newContacts.length]);

  const toggleBio = (id) => setApprovedBios((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleCreate = (i) => setCreateChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  const hasContactChanges = contactUpdates.length > 0 || newContacts.length > 0;
  const approvedBioSet = new Set(Object.keys(approvedBios).filter((id) => approvedBios[id]));
  const skippedNewContacts = newContacts
    .map((_, i) => i)
    .filter((i) => !createChecked[i]);

  const hasDuplicates = newContacts.some((nc) => nc.potentialDuplicates?.length > 0);
  const canConfirm = hasContactChanges && (newContacts.length === 0 || skippedNewContacts.length < newContacts.length);
  const [applying, setApplying] = useState(false);

  const handleConfirm = async () => {
    setApplying(true);
    try {
      await onConfirm({ approvedBios: approvedBioSet, skippedNewContacts });
    } finally {
      setApplying(false);
    }
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
        {applying && (
          <div className="flex items-center gap-2 text-sm text-indigo-600 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating contacts and updating data…
          </div>
        )}
        <div className={`space-y-3 py-2 max-h-[55vh] overflow-y-auto ${applying ? "opacity-50 pointer-events-none" : ""}`}>
          {firmFieldsApplied.length > 0 && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1">
                Firm fields populated (review in form before saving):
              </p>
              <p className="text-sm text-indigo-900">{firmFieldsApplied.join(", ")}</p>
            </div>
          )}
          {hasDuplicates && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-amber-800">
                  Potential duplicate contacts detected
                </p>
              </div>
              <p className="text-xs text-amber-700">
                Some contacts from the website appear to match existing contacts at this firm.
                Uncheck any that are duplicates to skip creating them. The existing contact will not be modified.
              </p>
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
                const dups = nc.potentialDuplicates || [];
                const hasDup = dups.length > 0;
                const isChecked = !!createChecked[i];
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-2.5 ${hasDup ? "border-amber-300 bg-amber-50" : "border-green-200 bg-green-50"}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleCreate(i)}
                        className="mt-0.5 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                      {nc.photo_url ? (
                        <img src={nc.photo_url} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-800">
                          {name}
                          {nc.title ? ` — ${nc.title}` : ""}
                        </p>
                        {nc.email && <p className="text-xs text-gray-500 mt-0.5">{nc.email}</p>}
                        {hasDup && (
                          <div className="mt-1.5 rounded-md border border-amber-200 bg-white p-1.5 space-y-1">
                            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> May duplicate existing contact:
                            </p>
                            {dups.map((d, di) => (
                              <div key={di} className="flex items-center gap-1.5 pl-4">
                                {d.contact.photo_url ? (
                                  <img src={d.contact.photo_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-100 flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-gray-700 truncate">{d.name}</p>
                                  <p className="text-[10px] text-gray-500 truncate">
                                    {d.title || "—"}{d.email ? ` · ${d.email}` : ""}
                                  </p>
                                </div>
                              </div>
                            ))}
                            <p className="text-[10px] text-amber-700 pl-4">
                              Uncheck this contact to skip creating a duplicate.
                            </p>
                          </div>
                        )}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleConfirm}
            disabled={!canConfirm || applying}
          >
            {applying ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating contacts…</> : "Approve & Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}