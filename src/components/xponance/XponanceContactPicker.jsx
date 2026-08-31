import React, { useState, useMemo } from "react";
import { Search, X, Plus, Check, UserCircle2, Building2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { findContactDuplicates } from "@/components/contacts/contactDuplicateCheck";

const getFullName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

/**
 * Picker for selecting a primary or secondary Xponance contact.
 * Only shows contacts related to the Xponance (tenant) firm — i.e. contacts
 * whose firm_ids include the tenant firm ID.
 *
 * If the desired contact isn't found, the user can add a new one via the
 * "Add New" inline form, which runs the same duplicate-detection protocol
 * as the full AddContactDialog (findContactDuplicates) to prevent duplicates.
 *
 * Props:
 *  - label: "Primary Xponance Contact" or "Secondary Xponance Contact"
 *  - value: { contact_id, contact_name } — current selection
 *  - onChange: (contact_id, contact_name) => void  — called when a contact is selected
 *  - onClear: () => void — called when the user clears the selection
 *  - editing: boolean — whether the parent form is in edit mode
 *  - excludeId: optional contact ID to exclude (e.g. the primary contact when picking secondary)
 */
export default function XponanceContactPicker({ label, value, onChange, onClear, editing = true, excludeId }) {
  const { user } = useAuth();
  const tenantFirmId = user?.linked_firm_id;

  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  // New contact form state
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [dupWarning, setDupWarning] = useState(null);
  const [creating, setCreating] = useState(false);

  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  // Contacts related to Xponance = contacts whose firm_ids includes the tenant firm ID
  const xponanceContacts = useMemo(() => {
    const active = allContacts.filter((c) => !c.deleted_at);
    if (!tenantFirmId) return active;
    return active.filter((c) => (c.firm_ids || []).includes(tenantFirmId));
  }, [allContacts, tenantFirmId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = xponanceContacts;
    if (excludeId) list = list.filter((c) => c.id !== excludeId);
    if (!q) return list.sort((a, b) => getFullName(a).localeCompare(getFullName(b)));
    return list
      .filter((c) => {
        const name = getFullName(c).toLowerCase();
        const title = (c.title || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        return name.includes(q) || title.includes(q) || email.includes(q);
      })
      .sort((a, b) => getFullName(a).localeCompare(getFullName(b)));
  }, [xponanceContacts, search, excludeId]);

  const handleSelect = (contact) => {
    onChange?.(contact.id, getFullName(contact));
    setShowPicker(false);
    setSearch("");
  };

  const handleClear = () => {
    onClear?.();
    setShowPicker(false);
  };

  const handleAddNew = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) return;
    // Run duplicate detection against ALL contacts (not just Xponance ones)
    const newContact = {
      first_name: newFirstName.trim(),
      last_name: newLastName.trim(),
      email: newEmail.trim(),
    };
    const dups = findContactDuplicates(newContact, allContacts);
    if (dups.length > 0) {
      setDupWarning({ dups, newContact });
      return;
    }
    await createContact();
  };

  const createContact = async () => {
    setCreating(true);
    try {
      const created = await base44.entities.Contact.create({
        tenant_id: tenantFirmId,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        title: newTitle.trim(),
        email: newEmail.trim(),
        firm_ids: tenantFirmId ? [tenantFirmId] : [],
        contact_status: "Active",
      });
      handleSelect(created);
      // Reset add form
      setNewFirstName("");
      setNewLastName("");
      setNewTitle("");
      setNewEmail("");
      setShowAddForm(false);
      setDupWarning(null);
    } catch (err) {
      console.error("Failed to create Xponance contact:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleForceCreate = () => {
    setDupWarning(null);
    createContact();
  };

  // View mode (not editing) — just show the name or a dash
  if (!editing) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700">
          {value?.contact_name || <span className="text-gray-400">—</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {/* Selected contact display */}
      {value?.contact_id && !showPicker ? (
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-indigo-50 border-indigo-200">
          <UserCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span className="text-sm text-indigo-800 font-medium truncate flex-1">
            {value.contact_name}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
            title="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : !showPicker ? (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Select Xponance contact
        </button>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search Xponance contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowPicker(false); setSearch(""); } }}
              className="w-full pl-8 pr-8 h-9 border-0 border-b text-sm focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { setShowPicker(false); setSearch(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contact list */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && !showAddForm ? (
              <div className="text-center py-4">
                <p className="text-xs text-gray-400 italic mb-2">No Xponance contacts found</p>
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 transition-colors group"
                >
                  {c.photo_url ? (
                    <img src={c.photo_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <UserCircle2 className="w-4 h-4 text-indigo-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-indigo-700">
                      {getFullName(c)}
                    </p>
                    {c.title && <p className="text-xs text-gray-400 truncate">{c.title}</p>}
                  </div>
                  {value?.contact_id === c.id && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>

          {/* Add new contact inline form */}
          {showAddForm ? (
            <div className="border-t bg-gray-50 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                <Building2 className="w-3.5 h-3.5" />
                New Xponance Contact
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="First name *"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="h-8 px-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <input
                  type="text"
                  placeholder="Last name *"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="h-8 px-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <input
                type="text"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full h-8 px-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full h-8 px-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />

              {/* Duplicate warning */}
              {dupWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1.5">
                  <p className="text-xs font-medium text-amber-800">
                    ⚠ {dupWarning.dups.length} potential duplicate{dupWarning.dups.length > 1 ? "s" : ""} found
                  </p>
                  {dupWarning.dups.map((d, i) => (
                    <div key={i} className="text-xs text-amber-700">
                      <span className="font-medium">{d.name}</span>
                      {d.email && <span className="text-amber-500"> — {d.email}</span>}
                      <p className="text-amber-600">{d.reasons[0]}</p>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleForceCreate}
                      disabled={creating}
                      className="text-xs px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50"
                    >
                      {creating ? "Creating..." : "Add Anyway"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDupWarning(null)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddNew}
                  disabled={!newFirstName.trim() || !newLastName.trim() || creating || !!dupWarning}
                  className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create & Select"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setDupWarning(null); setNewFirstName(""); setNewLastName(""); setNewTitle(""); setNewEmail(""); }}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-100 text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t p-2">
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Xponance Contact
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}