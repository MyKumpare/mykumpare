import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, User, AlertTriangle, Trash2, Check, ArrowRightLeft, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import AddContactDialog from "./AddContactDialog";
import MergeDuplicateContactsDialog from "./MergeDuplicateContactsDialog";
import { useDuplicateReviews } from "./useDuplicateReviews";

export default function ContactsTab({ firmId, firms = [], onNavigateToOwnership, onProductClick, onFirmClick }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [viewMode, setViewMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [mergeCluster, setMergeCluster] = useState(null);
  const [accepting, setAccepting] = useState(false);

  const queryClient = useQueryClient();
  const { isGroupAccepted, acceptGroup } = useDuplicateReviews();

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const allFirmContacts = useMemo(
    () => contacts.filter((c) => c.firm_ids?.includes(firmId) && !c.deleted_at),
    [contacts, firmId]
  );

  // Detect duplicate contacts by same first + last name (case-insensitive).
  // Groups the user has already accepted (dismissed) are hidden.
  const duplicateGroups = useMemo(() => {
    const groups = {};
    for (const c of allFirmContacts) {
      const key = `${(c.first_name || "").toLowerCase().trim()}|${(c.last_name || "").toLowerCase().trim()}`;
      if (!key || key === "|") continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return Object.values(groups)
      .filter((g) => g.length > 1)
      .filter((g) => !isGroupAccepted(g));
  }, [allFirmContacts, isGroupAccepted]);

  // Only show the most-current (latest updated_date) record per duplicate group;
  // contacts with no first+last name are always shown.
  const firmContacts = useMemo(() => {
    const latestPerKey = {};
    for (const c of allFirmContacts) {
      const key = `${(c.first_name || "").toLowerCase().trim()}|${(c.last_name || "").toLowerCase().trim()}`;
      if (!key || key === "|") continue;
      if (!latestPerKey[key] || new Date(c.updated_date || 0) > new Date(latestPerKey[key].updated_date || 0)) {
        latestPerKey[key] = c;
      }
    }
    return allFirmContacts.filter((c) => {
      const key = `${(c.first_name || "").toLowerCase().trim()}|${(c.last_name || "").toLowerCase().trim()}`;
      if (!key || key === "|") return true;
      return latestPerKey[key]?.id === c.id;
    });
  }, [allFirmContacts]);

  const handleView = (contact) => {
    setEditingContact(contact);
    setViewMode(true);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingContact(null);
    setViewMode(false);
    setDialogOpen(true);
  };

  const handleAcceptGroup = async (group) => {
    setAccepting(true);
    try {
      await acceptGroup(group);
      toast({ title: "Duplicate accepted", description: "These contacts will be kept as-is. The warning is dismissed." });
    } catch (error) {
      toast({ title: "Could not dismiss", description: error.message || "Try again.", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.Contact.update(deleteTarget.id, { deleted_at: new Date().toISOString() });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["deletedContacts"] });
      toast({ title: "✅ Contact deleted", description: `${deleteTarget.first_name} ${deleteTarget.last_name} has been removed.` });
      setDeleteTarget(null);
    } catch (error) {
      toast({ title: "Delete failed", description: error.message || "Could not delete this contact.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const formatName = (c) =>
    [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ") + (c.designations?.length ? `, ${c.designations.join(", ")}` : "");

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={handleAdd}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Contact
        </Button>
      </div>

      {duplicateGroups.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              {duplicateGroups.length} duplicate name{duplicateGroups.length > 1 ? "s" : ""} detected
            </p>
          </div>
          <p className="text-xs text-amber-700">
            The following contacts share the same first and last name. Accept to keep both, merge to combine, or delete the duplicate.
          </p>
          <div className="space-y-2 mt-1">
            {duplicateGroups.map((group, gi) => (
              <div key={gi} className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/40 p-2">
                <div className="space-y-1">
                  {group.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between gap-2 bg-white rounded-md border border-amber-200 px-2.5 py-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {contact.photo_url ? (
                            <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-3 h-3 text-indigo-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{formatName(contact)}</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {contact.title || "—"}{contact.email ? ` · ${contact.email}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-50" onClick={() => handleView(contact)}>
                          View
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(contact)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-6 gap-1 text-xs" onClick={() => handleAcceptGroup(group)} disabled={accepting}>
                    {accepting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Accept (keep both)
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-6 gap-1 text-xs" onClick={() => setMergeCluster(group)} disabled={group.length < 2}>
                    <ArrowRightLeft className="w-3 h-3" />
                    Merge
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {firmContacts.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
          No contacts added
        </div>
      ) : (
        <div className="space-y-2">
          {firmContacts
            .sort((a, b) => {
              const roleOrder = { Primary: 0, Secondary: 1 };
              const aOrder = roleOrder[a.contact_role] ?? 2;
              const bOrder = roleOrder[b.contact_role] ?? 2;
              if (aOrder !== bOrder) return aOrder - bOrder;
              return (a.last_name || "").localeCompare(b.last_name || "");
            })
            .map((contact) => {
              const isDuplicate = duplicateGroups.some((g) => g.some((c) => c.id === contact.id));
              return (
                <div
                  key={contact.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${isDuplicate ? "bg-amber-50 border-amber-200 hover:bg-amber-100" : "bg-gray-50 border-gray-200 hover:bg-indigo-50 hover:border-indigo-200"}`}
                  onClick={() => handleView(contact)}
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {contact.photo_url ? (
                      <img src={contact.photo_url} alt={contact.first_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-indigo-700 hover:underline">
                        {[contact.salutation, contact.first_name, contact.middle_name, contact.last_name, contact.suffix].filter(Boolean).join(" ")}
                        {contact.designations?.length > 0 && `, ${contact.designations.join(", ")}`}
                      </div>
                      {contact.contact_role && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${contact.contact_role === "Primary" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                          {contact.contact_role}
                        </span>
                      )}
                      {isDuplicate && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <AlertTriangle className="w-3 h-3" /> Duplicate
                        </span>
                      )}
                    </div>
                    {contact.title && (
                      <div className="text-xs text-gray-500">{contact.title}</div>
                    )}
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="text-xs text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>{contact.email}</a>
                    )}
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(contact); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {deleteTarget && (
        <Dialog open={true} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Delete Contact?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{formatName(deleteTarget)}</strong>?{deleteTarget.email ? ` (${deleteTarget.email})` : ""}
              {duplicateGroups.some((g) => g.some((c) => c.id === deleteTarget.id)) && (
                <span className="block mt-2 text-xs text-amber-700">
                  ⚠ This contact appears to be a duplicate of another contact with the same name.
                </span>
              )}
            </p>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Yes, Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AddContactDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setViewMode(false); }}
        editingContact={editingContact}
        currentFirmId={firmId}
        firms={firms}
        viewMode={viewMode}
        onNavigateToOwnership={onNavigateToOwnership}
        onProductClick={onProductClick ? (product) => { setDialogOpen(false); onProductClick(product); } : undefined}
        onFirmClick={onFirmClick ? (firm) => { setDialogOpen(false); onFirmClick(firm); } : undefined}
      />

      {mergeCluster && (
        <MergeDuplicateContactsDialog
          open={true}
          onOpenChange={(v) => { if (!v) setMergeCluster(null); }}
          contacts={mergeCluster}
          onMerged={() => {
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
            queryClient.invalidateQueries({ queryKey: ["duplicateReviews"] });
            setMergeCluster(null);
          }}
        />
      )}
    </div>
  );
}