import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Search, Plus, X, ChevronDown, User, Building2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import DateInput from "../shared/DateInput";
import ConsultantRoleMultiSelect from "./ConsultantRoleMultiSelect";
import ConsultantContactRoleSelect from "./ConsultantContactRoleSelect";
import { findFirmNameDuplicates } from "./firmNameDuplicateCheck";
import { buildContactFullName } from "./consultantFullName";

const CONSULTANT_FIRM_TYPE = "Investment Consultant";

export default function AddConsultantDialog({ open, onOpenChange, firmId, firmName, editingConsultant, existingConsultants = [], onSaved }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [consultantFirmId, setConsultantFirmId] = useState("");
  const [consultantFirmName, setConsultantFirmName] = useState("");
  const [isNewFirm, setIsNewFirm] = useState(false);
  const [firmSearch, setFirmSearch] = useState("");
  const [showFirmDropdown, setShowFirmDropdown] = useState(false);
  const [roles, setRoles] = useState([]);
  const [inceptionDate, setInceptionDate] = useState("");
  const [terminationDate, setTerminationDate] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [contactAssignments, setContactAssignments] = useState({});
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [saving, setSaving] = useState(false);

  const isEditing = !!editingConsultant;

  // Load all firms (for the IC firm picker + duplicate validation)
  const { data: allFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    enabled: open,
  });

  const consultantFirms = useMemo(
    () => allFirms.filter((f) => {
      if (f.deleted_at) return false;
      const types = f.firm_types?.length ? f.firm_types : (f.firm_type ? [f.firm_type] : []);
      return types.includes(CONSULTANT_FIRM_TYPE);
    }),
    [allFirms]
  );

  // Load all contacts (filtered client-side by firm_ids, matching the pattern
  // used elsewhere in the app since the filter API doesn't support array
  // containment queries directly)
  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
    enabled: open,
  });

  const consultantContacts = useMemo(
    () => allContacts.filter((c) => (c.firm_ids || []).includes(consultantFirmId) && !c.deleted_at),
    [allContacts, consultantFirmId]
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    if (editingConsultant) {
      setConsultantFirmId(editingConsultant.consultant_firm_id || "");
      setConsultantFirmName(editingConsultant.consultant_firm_name || "");
      setIsNewFirm(false);
      setFirmSearch("");
      setRoles(editingConsultant.roles || []);
      setInceptionDate(editingConsultant.inception_date || "");
      setTerminationDate(editingConsultant.termination_date || "");
      const assignments = {};
      (editingConsultant.contacts || []).forEach((c) => {
        assignments[c.contact_id] = {
          contact_role: c.contact_role || "",
          inception_date: c.inception_date || "",
          termination_date: c.termination_date || "",
        };
      });
      setSelectedContactIds((editingConsultant.contacts || []).map((c) => c.contact_id));
      setContactAssignments(assignments);
    } else {
      setConsultantFirmId("");
      setConsultantFirmName("");
      setIsNewFirm(false);
      setFirmSearch("");
      setRoles([]);
      setInceptionDate("");
      setTerminationDate("");
      setSelectedContactIds([]);
      setContactAssignments({});
    }
    setDuplicateWarning(null);
  }, [open, editingConsultant]);

  const firmSearchResults = useMemo(() => {
    const sorted = [...consultantFirms].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
    if (!firmSearch.trim()) return sorted;
    const q = firmSearch.trim().toLowerCase();
    return sorted.filter((f) => (f.name || "").toLowerCase().includes(q));
  }, [firmSearch, consultantFirms]);

  const handleSelectFirm = (firm) => {
    setConsultantFirmId(firm.id);
    setConsultantFirmName(firm.name);
    setIsNewFirm(false);
    setFirmSearch("");
    setShowFirmDropdown(false);
    setSelectedContactIds([]);
    setContactAssignments({});
  };

  const handleCreateNewFirm = () => {
    const name = firmSearch.trim();
    if (!name) return;
    // Validate against ALL existing firms (not just IC firms) to avoid duplicates
    const dups = findFirmNameDuplicates(name, allFirms);
    if (dups.length > 0) {
      setDuplicateWarning({ name, duplicates: dups });
      return;
    }
    setConsultantFirmName(name);
    setIsNewFirm(true);
    setConsultantFirmId("");
    setShowFirmDropdown(false);
    setFirmSearch("");
    setSelectedContactIds([]);
    setContactAssignments({});
  };

  const toggleContact = (contactId) => {
    if (selectedContactIds.includes(contactId)) {
      setSelectedContactIds(selectedContactIds.filter((id) => id !== contactId));
      const next = { ...contactAssignments };
      delete next[contactId];
      setContactAssignments(next);
    } else {
      setSelectedContactIds([...selectedContactIds, contactId]);
      setContactAssignments({ ...contactAssignments, [contactId]: { contact_role: "", inception_date: "", termination_date: "" } });
    }
  };

  const updateContactAssignment = (contactId, field, value) => {
    setContactAssignments({ ...contactAssignments, [contactId]: { ...contactAssignments[contactId], [field]: value } });
  };

  const isValid = consultantFirmName.trim() && (consultantFirmId || isNewFirm);

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      let finalConsultantFirmId = consultantFirmId;
      let finalConsultantFirmName = consultantFirmName;

      // If creating a new firm, create it first
      if (isNewFirm && !finalConsultantFirmId) {
        const newFirm = await base44.entities.Firm.create({
          name: finalConsultantFirmName.trim(),
          firm_type: CONSULTANT_FIRM_TYPE,
          firm_types: [CONSULTANT_FIRM_TYPE],
          tenant_id: user?.linked_firm_id,
        });
        finalConsultantFirmId = newFirm.id;
        queryClient.invalidateQueries({ queryKey: ["firms"] });
      }

      // Build contacts array
      const contactsArray = selectedContactIds.map((cid) => {
        const contact = consultantContacts.find((c) => c.id === cid);
        const assignment = contactAssignments[cid] || {};
        return {
          id: crypto.randomUUID(),
          contact_id: cid,
          contact_name: contact ? buildContactFullName(contact) : "",
          contact_role: assignment.contact_role || "",
          inception_date: assignment.inception_date || "",
          termination_date: assignment.termination_date || "",
        };
      });

      const payload = {
        firm_id: firmId,
        firm_name: firmName,
        consultant_firm_id: finalConsultantFirmId,
        consultant_firm_name: finalConsultantFirmName.trim(),
        roles,
        inception_date: inceptionDate || null,
        termination_date: terminationDate || null,
        contacts: contactsArray,
      };

      if (isEditing) {
        await base44.entities.FirmConsultant.update(editingConsultant.id, payload);
        toast({ title: "✅ Consultant updated", description: `${finalConsultantFirmName} updated successfully.` });
      } else {
        await base44.entities.FirmConsultant.create({ ...payload, tenant_id: user?.linked_firm_id });
        toast({ title: "✅ Consultant added", description: `${finalConsultantFirmName} added as a consultant.` });
      }

      queryClient.invalidateQueries({ queryKey: ["firm-consultants", firmId] });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Failed to save consultant", description: err.message || "An error occurred.", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Consultant" : "Add Investment Consultant"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Consultant Firm Selection */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Investment Consultant Firm</Label>
              {consultantFirmName && !isNewFirm ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-gray-50">
                  <Building2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">{consultantFirmName}</span>
                  <button type="button" onClick={() => { setConsultantFirmId(""); setConsultantFirmName(""); setIsNewFirm(false); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : isNewFirm ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-emerald-50 border-emerald-200">
                  <Plus className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-emerald-800 flex-1 truncate">New: {consultantFirmName}</span>
                  <button type="button" onClick={() => { setConsultantFirmName(""); setIsNewFirm(false); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search existing firms or type to create new..."
                      value={firmSearch}
                      onChange={(e) => { setFirmSearch(e.target.value); setShowFirmDropdown(true); }}
                      onFocus={() => setShowFirmDropdown(true)}
                      className="h-9 pl-8"
                    />
                  </div>
                  {showFirmDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {firmSearchResults.map((firm) => (
                        <button
                          key={firm.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); handleSelectFirm(firm); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 text-left transition-colors"
                        >
                          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{firm.name}</span>
                        </button>
                      ))}
                      {firmSearch.trim() && (
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); handleCreateNewFirm(); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 text-left border-t border-gray-100 font-medium"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create new firm: "{firmSearch.trim()}"
                        </button>
                      )}
                      {firmSearchResults.length === 0 && !firmSearch.trim() && (
                        <div className="px-3 py-2 text-xs text-gray-400 italic">Type to search or create a new firm...</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Consultant Roles */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Consultant Role(s)</Label>
              <ConsultantRoleMultiSelect value={roles} onChange={setRoles} />
            </div>

            {/* Inception & Termination Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Inception Date</Label>
                <DateInput value={inceptionDate} onChange={setInceptionDate} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Termination Date</Label>
                <DateInput value={terminationDate} onChange={setTerminationDate} className="h-9 text-sm" />
              </div>
            </div>

            {/* Contact Assignments */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Related Contacts</Label>
              {isNewFirm ? (
                <div className="text-xs text-gray-400 italic py-3 px-3 text-center border border-dashed border-gray-200 rounded-lg">
                  Save the consultant first, then add contacts to the new firm and edit this consultant to assign them.
                </div>
              ) : !consultantFirmId ? (
                <div className="text-xs text-gray-400 italic py-3 px-3 text-center border border-dashed border-gray-200 rounded-lg">
                  Select an investment consultant firm first to see its contacts.
                </div>
              ) : consultantContacts.length === 0 ? (
                <div className="text-xs text-gray-400 italic py-3 px-3 text-center border border-dashed border-gray-200 rounded-lg">
                  No contacts found at this firm. Add contacts to the consultant firm first.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Contact picker */}
                  <ContactPicker
                    contacts={consultantContacts}
                    selectedIds={selectedContactIds}
                    onToggle={toggleContact}
                  />
                  {/* Assignment rows for selected contacts */}
                  {selectedContactIds.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {selectedContactIds.map((cid) => {
                        const contact = consultantContacts.find((c) => c.id === cid);
                        if (!contact) return null;
                        const assignment = contactAssignments[cid] || {};
                        return (
                          <div key={cid} className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm font-medium text-gray-800 truncate flex-1">
                                {buildContactFullName(contact)}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-500">Contact Role</Label>
                                <ConsultantContactRoleSelect
                                  value={assignment.contact_role || ""}
                                  onChange={(v) => updateContactAssignment(cid, "contact_role", v)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-500">Inception Date</Label>
                                <DateInput value={assignment.inception_date || ""} onChange={(v) => updateContactAssignment(cid, "inception_date", v)} className="h-8 text-xs" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-500">Termination Date</Label>
                                <DateInput value={assignment.termination_date || ""} onChange={(v) => updateContactAssignment(cid, "termination_date", v)} className="h-8 text-xs" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={!isValid || saving} className="bg-primary hover:bg-primary/90 text-white">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEditing ? "Save Changes" : "Add Consultant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate firm warning */}
      {duplicateWarning && (
        <Dialog open={true} onOpenChange={() => setDuplicateWarning(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Similar Firm Name Exists
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600">
                A firm with a similar name already exists. Would you like to create this firm anyway?
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {duplicateWarning.duplicates.map((d) => (
                  <div key={d.firm.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="font-semibold text-sm text-gray-800">{d.name}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{d.reasons.join(", ")}</p>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateWarning(null)}>Cancel</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  setDuplicateWarning(null);
                  setConsultantFirmName(duplicateWarning.name);
                  setIsNewFirm(true);
                  setConsultantFirmId("");
                  setShowFirmDropdown(false);
                  setFirmSearch("");
                }}
              >
                Create Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** Compact multi-select contact picker with search, shown as a dropdown. */
function ContactPicker({ contacts, selectedIds, onToggle }) {
  const [search, setSearch] = useState("");
  const [show, setShow] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) => {
      const name = buildContactFullName(c).toLowerCase();
      return name.includes(q) || (c.email || "").toLowerCase().includes(q);
    });
  }, [contacts, search]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="w-full h-8 px-2.5 flex items-center justify-between text-xs rounded-md border border-gray-200 bg-white hover:border-gray-300 transition-colors"
      >
        <span className="text-gray-600">
          {selectedIds.length > 0 ? `${selectedIds.length} contact(s) selected` : "Select contacts..."}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {show && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
            <Input
              autoFocus
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400 italic">No contacts found</div>
          ) : (
            filtered.map((c) => {
              const selected = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onToggle(c.id); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${selected ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${selected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                    {selected && <span className="text-white text-[8px]">✓</span>}
                  </div>
                  <span className="truncate">{buildContactFullName(c)}</span>
                  {c.title && <span className="text-gray-400 truncate">— {c.title}</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}