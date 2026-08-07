import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, User, AlertTriangle, Trash2, Check, ArrowRightLeft, Loader2, Eye, EyeOff, Network as NetworkIcon, List as ListIcon } from "lucide-react";
import TeamHierarchyView from "../firms/TeamHierarchyView";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import AddContactDialog from "./AddContactDialog";
import DeleteContactConfirmDialog from "./DeleteContactConfirmDialog";
import ContactsTabFilters, { filterContacts } from "./ContactsTabFilters";
import MergeDuplicateContactsDialog from "./MergeDuplicateContactsDialog";
import EmployeeStatusChart from "./EmployeeStatusChart";
import ContactsBulkActionsBar from "./ContactsBulkActionsBar";
import { useDuplicateReviews } from "./useDuplicateReviews";

export default function ContactsTab({ firmId, firms = [], onNavigateToOwnership, onProductClick, onFirmClick }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [viewMode, setViewMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [mergeCluster, setMergeCluster] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [filterText, setFilterText] = useState("");
  const [filterSelected, setFilterSelected] = useState({});
  const [teamView, setTeamView] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const handleToggleFilter = (fieldKey, value) => {
    setFilterSelected((prev) => {
      const next = { ...prev };
      const s = new Set(next[fieldKey] || []);
      if (s.has(value)) s.delete(value); else s.add(value);
      if (s.size === 0) delete next[fieldKey]; else next[fieldKey] = s;
      return next;
    });
  };
  const handleClearFilters = () => { setFilterText(""); setFilterSelected({}); };

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

  const firmName = useMemo(
    () => (firms.find((f) => f.id === firmId)?.name) || "",
    [firms, firmId]
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

  const filteredContacts = useMemo(
    () => filterContacts(firmContacts, filterText, filterSelected),
    [firmContacts, filterText, filterSelected]
  );

  // Count breakdown by employee status for a quick at-a-glance summary.
  const contactCounts = useMemo(() => {
    let employees = 0;
    let nonEmployees = 0;
    let unclassified = 0;
    let active = 0;
    let inactive = 0;
    for (const c of firmContacts) {
      if (c.employee_status === "Employee") employees += 1;
      else if (c.employee_status === "Non-Employee") nonEmployees += 1;
      else unclassified += 1;
      if ((c.contact_status || "Active") === "Active") active += 1;
      else inactive += 1;
    }
    return { total: firmContacts.length, employees, nonEmployees, unclassified, active, inactive };
  }, [firmContacts]);

  // Clicking a chart legend label toggles a filter on the corresponding field
  // (employee_status, gender, ethnicity, veteran_status, or disability_status depending on the active chart view).
  const handleChartFilter = (field, value) => {
    setFilterSelected((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[field];
      } else {
        next[field] = new Set([value]);
      }
      return next;
    });
  };

  // Active contact-status filter from the chart footer (Total / Active / Inactive).
  const activeStatusFilter = useMemo(() => {
    const sel = filterSelected.contact_status;
    if (!sel || sel.size === 0) return null;
    if (sel.has("Inactive")) return "Inactive";
    if (sel.has("Active")) return "Active";
    return null;
  }, [filterSelected]);

  const handleStatusFilter = (status) => {
    setFilterSelected((prev) => {
      const next = { ...prev };
      if (!status) {
        delete next.contact_status;
      } else {
        next.contact_status = new Set([status]);
      }
      return next;
    });
  };

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
      const res = await base44.functions.invoke("deleteContactCascade", { contact_id: deleteTarget.id });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["deletedContacts"] });
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations"] });
      queryClient.invalidateQueries({ queryKey: ["externalChats"] });
      queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
      const deleted = res?.data?.deleted || {};
      const assocCount = Object.values(deleted).reduce((sum, n) => sum + (Number(n) || 0), 0);
      toast({
        title: "✅ Contact deleted",
        description: assocCount > 0
          ? `${deleteTarget.first_name} ${deleteTarget.last_name} removed along with ${assocCount} associated record(s).`
          : `${deleteTarget.first_name} ${deleteTarget.last_name} has been removed.`,
      });
      setDeleteTarget(null);
    } catch (error) {
      toast({ title: "Delete failed", description: error.message || "Could not delete this contact.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // Toggle a contact's visibility (Active = visible, Inactive = hidden)
  const handleToggleStatus = async (contact) => {
    const newStatus = (contact.contact_status || "Active") === "Active" ? "Inactive" : "Active";
    setTogglingId(contact.id);
    try {
      await base44.entities.Contact.update(contact.id, { contact_status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({
        title: newStatus === "Inactive" ? "Contact hidden" : "Contact unhidden",
        description: `${contact.first_name} ${contact.last_name} is now ${newStatus}.`,
      });
    } catch (error) {
      toast({ title: "Update failed", description: error.message || "Could not update status.", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const selectedArray = useMemo(
    () => filteredContacts.filter((c) => selectedIds.has(c.id)),
    [filteredContacts, selectedIds]
  );

  const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every((c) => selectedIds.has(c.id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        for (const c of filteredContacts) next.delete(c.id);
        return next;
      }
      const next = new Set(prev);
      for (const c of filteredContacts) next.add(c.id);
      return next;
    });
  };

  const handleBulkStatus = async (status) => {
    const targets = selectedArray;
    if (targets.length === 0) return;
    setBulkBusy(status === "Active" ? "active" : "inactive");
    try {
      await base44.entities.Contact.bulkUpdate(
        targets.map((c) => ({ id: c.id, contact_status: status }))
      );
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "✅ Status updated", description: `${targets.length} contact${targets.length > 1 ? "s" : ""} set to ${status}.` });
      setSelectedIds(new Set());
    } catch (error) {
      toast({ title: "Update failed", description: error.message || "Could not update contacts.", variant: "destructive" });
    } finally {
      setBulkBusy(null);
    }
  };

  const handleBulkDelete = async () => {
    const targets = selectedArray;
    if (targets.length === 0) return;
    setBulkBusy("delete");
    try {
      let totalAssoc = 0;
      let successCount = 0;
      for (const c of targets) {
        try {
          const res = await base44.functions.invoke("deleteContactCascade", { contact_id: c.id });
          const deleted = res?.data?.deleted || {};
          totalAssoc += Object.values(deleted).reduce((sum, n) => sum + (Number(n) || 0), 0);
          successCount++;
        } catch {
          // Continue with remaining contacts even if one fails
        }
      }
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["deletedContacts"] });
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations"] });
      queryClient.invalidateQueries({ queryKey: ["externalChats"] });
      queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
      toast({
        title: "✅ Contacts deleted",
        description: `${successCount} contact${successCount > 1 ? "s" : ""} removed${totalAssoc > 0 ? ` along with ${totalAssoc} associated record(s)` : ""}.`,
      });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } catch (error) {
      toast({ title: "Delete failed", description: error.message || "Could not delete contacts.", variant: "destructive" });
    } finally {
      setBulkBusy(null);
    }
  };

  const formatName = (c) =>
    [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ") + (c.designations?.length ? `, ${c.designations.join(", ")}` : "");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {firmContacts.length > 0 && (
            <button
              type="button"
              onClick={() => setTeamView(v => !v)}
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                teamView ? "bg-indigo-100 text-indigo-700" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {teamView ? (
                <><ListIcon className="w-3.5 h-3.5" /> List view</>
              ) : (
                <><NetworkIcon className="w-3.5 h-3.5" /> Team structure</>
              )}
            </button>
          )}
          {firmContacts.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
                <User className="w-3 h-3" />
                {contactCounts.total} total
              </span>
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs ml-auto"
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

      <ContactsTabFilters
        contacts={firmContacts}
        text={filterText}
        onTextChange={setFilterText}
        selected={filterSelected}
        onToggle={handleToggleFilter}
        onClear={handleClearFilters}
      />

      {firmContacts.length > 0 && (
        <EmployeeStatusChart
          contacts={firmContacts}
          filterSelected={filterSelected}
          onChartFilter={handleChartFilter}
          activeStatusFilter={activeStatusFilter}
          onStatusFilter={handleStatusFilter}
        />
      )}

      <ContactsBulkActionsBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onSetActive={() => handleBulkStatus("Active")}
        onSetInactive={() => handleBulkStatus("Inactive")}
        onDelete={() => setBulkDeleteOpen(true)}
        busy={bulkBusy}
      />

      {firmContacts.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
          No contacts added
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
          No contacts match your filters
        </div>
      ) : teamView ? (
        <TeamHierarchyView people={filteredContacts} firmName={firmName} firmId={firmId} onContactClick={handleView} />
      ) : (
        <div className="space-y-2">
          {filteredContacts.length > 0 && (
            <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>{allFilteredSelected ? "Deselect all" : "Select all"}</span>
            </div>
          )}
          {filteredContacts
            .sort((a, b) => {
              const aActive = (a.contact_status || "Active") === "Active" ? 0 : 1;
              const bActive = (b.contact_status || "Active") === "Active" ? 0 : 1;
              if (aActive !== bActive) return aActive - bActive;
              const roleOrder = { Primary: 0, Secondary: 1 };
              const aOrder = roleOrder[a.contact_role] ?? 2;
              const bOrder = roleOrder[b.contact_role] ?? 2;
              if (aOrder !== bOrder) return aOrder - bOrder;
              return (a.first_name || "").localeCompare(b.first_name || "") || (a.last_name || "").localeCompare(b.last_name || "");
            })
            .map((contact) => {
              const isDuplicate = duplicateGroups.some((g) => g.some((c) => c.id === contact.id));
              return (
                <div
                  key={contact.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${isDuplicate ? "bg-amber-50 border-amber-200 hover:bg-amber-100" : "bg-gray-50 border-gray-200 hover:bg-indigo-50 hover:border-indigo-200"}`}
                  onClick={() => handleView(contact)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(contact.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                  />
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
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${(contact.contact_status || "Active") === "Inactive" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${(contact.contact_status || "Active") === "Inactive" ? "bg-red-500" : "bg-green-500"}`} />
                        {contact.contact_status || "Active"}
                      </span>
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
                    className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0"
                    title={(contact.contact_status || "Active") === "Active" ? "Hide contact (set Inactive)" : "Unhide contact (set Active)"}
                    disabled={togglingId === contact.id}
                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(contact); }}
                  >
                    {togglingId === contact.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (contact.contact_status || "Active") === "Active" ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
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

      <DeleteContactConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        contact={deleteTarget}
        onConfirm={handleDelete}
        deleting={deleting}
      />

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

      {bulkDeleteOpen && (
        <Dialog open={true} onOpenChange={() => setBulkDeleteOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Delete {selectedArray.length} contact{selectedArray.length > 1 ? "s" : ""}?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{selectedArray.length}</strong> selected contact{selectedArray.length > 1 ? "s" : ""}?
              <span className="block mt-2 text-xs text-red-700 bg-red-50 p-2 rounded-md">
                This will permanently remove all associated data for each contact, including external party portal access, activity logs, tasks, due diligence assignments, and chat conversations.
              </span>
            </p>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={!!bulkBusy}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleBulkDelete} disabled={!!bulkBusy}>
                {bulkBusy === "delete" ? "Deleting..." : "Yes, Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}