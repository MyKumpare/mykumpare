import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Building, User as UserIcon, Search, Check, ExternalLink } from "lucide-react";

export default function UserProfileDialog({
  open,
  onOpenChange,
  user,
  firms,
  contacts,
  onSaveLinked,
  onLogout,
}) {
  const ROLE_OPTIONS = ["admin", "user"];
  const [firmQuery, setFirmQuery] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedFirmId(user?.linked_firm_id || "");
      setSelectedContactId(user?.linked_contact_id || "");
      setFirmQuery("");
      // Seed the multi-select roles from the user's stored `roles` array,
      // falling back to the built-in single `role` so the picker reflects
      // what's currently in effect for tagging.
      const base = Array.isArray(user?.roles) && user.roles.length > 0
        ? user.roles
        : user?.role ? [user.role] : [];
      setSelectedRoles(base);
    }
  }, [open, user]);

  const toggleRole = (r) => {
    setSelectedRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r].sort()));
  };

  const rolesEqual = (a, b) => {
    const sa = [...(a || [])].sort().join(",");
    const sb = [...(b || [])].sort().join(",");
    return sa === sb;
  };

  const activeFirms = useMemo(
    () => (firms || []).filter((f) => !f.deleted_at).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [firms]
  );

  const filteredFirms = useMemo(() => {
    const q = firmQuery.trim().toLowerCase();
    if (!q) return activeFirms.slice(0, 60);
    return activeFirms.filter((f) => (f.name || "").toLowerCase().includes(q)).slice(0, 60);
  }, [activeFirms, firmQuery]);

  const selectedFirm = activeFirms.find((f) => f.id === selectedFirmId) || null;

  const firmContacts = useMemo(() => {
    if (!selectedFirm) return [];
    return (contacts || [])
      .filter((c) => !c.deleted_at && Array.isArray(c.firm_ids) && c.firm_ids.includes(selectedFirm.id))
      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
  }, [contacts, selectedFirm]);

  const originalRoles = Array.isArray(user?.roles) && user.roles.length > 0
    ? user.roles
    : user?.role ? [user.role] : [];

  const hasChanges =
    (user?.linked_firm_id || "") !== (selectedFirmId || "") ||
    (user?.linked_contact_id || "") !== (selectedContactId || "") ||
    !rolesEqual(selectedRoles, originalRoles);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveLinked({
        linked_firm_id: selectedFirmId || null,
        linked_contact_id: selectedContactId || null,
        roles: selectedRoles.length > 0 ? selectedRoles : null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden gap-0">
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4">
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
          <DialogDescription>
            Manage your account, link your affiliated firm, and connect your contact record.
          </DialogDescription>
        </DialogHeader>

        {/* Account summary */}
        <div className="flex items-center gap-3 p-3 rounded-xl border bg-gray-50">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg shrink-0">
            {(user?.full_name || user?.email || "U").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{user?.full_name || "—"}</div>
            <div className="text-sm text-gray-500 truncate">{user?.email}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {(selectedRoles.length > 0 ? selectedRoles : user?.role ? [user.role] : [])
                .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
                .join(" · ") || "—"}
            </div>
          </div>
        </div>

        {/* Custom roles (multi-select, display/tagging only) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <UserIcon className="w-4 h-4 text-indigo-600" /> Roles
          </div>
          <p className="text-xs text-gray-500">
            Tag yourself with one or more roles (for display only — does not change your access level).
          </p>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((r) => {
              const active = selectedRoles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRole(r)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    active
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {active && <Check className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Affiliated firm */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Building className="w-4 h-4 text-indigo-600" /> Affiliated Firm
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={firmQuery}
              onChange={(e) => setFirmQuery(e.target.value)}
              placeholder="Search your firm..."
              className="pl-8"
            />
          </div>

          {selectedFirm ? (
            <div className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-indigo-200 bg-indigo-50">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{selectedFirm.name}</div>
                {(selectedFirm.firm_types || []).length > 0 && (
                  <div className="text-xs text-gray-500 truncate">{selectedFirm.firm_types.join(", ")}</div>
                )}
                {selectedFirm.website && (
                  <a
                    href={selectedFirm.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 hover:underline truncate inline-flex items-center gap-1 max-w-full"
                  >
                    {selectedFirm.website} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedFirmId("");
                  setSelectedContactId("");
                }}
                className="text-xs text-red-500 hover:underline shrink-0"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto border rounded-lg divide-y">
              {filteredFirms.length === 0 ? (
                <div className="p-3 text-sm text-gray-400 text-center">No firms found</div>
              ) : (
                filteredFirms.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setSelectedFirmId(f.id);
                      setSelectedContactId("");
                      setFirmQuery("");
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm"
                  >
                    {f.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Contact record link */}
        {selectedFirm && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <UserIcon className="w-4 h-4 text-pink-600" /> My Contact Record
            </div>
            {firmContacts.length === 0 ? (
              <div className="p-3 text-sm text-gray-400 border rounded-lg">
                No contacts found for {selectedFirm.name}.
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto border rounded-lg divide-y">
                {firmContacts.map((c) => {
                  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "(no name)";
                  const isMe = user?.email && c.email && c.email.toLowerCase() === user.email.toLowerCase();
                  const selected = c.id === selectedContactId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedContactId(selected ? "" : c.id)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                        selected ? "bg-pink-50" : "hover:bg-pink-50/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {name}{" "}
                          {isMe && (
                            <span className="text-[10px] text-emerald-600 font-semibold ml-1">(email match)</span>
                          )}
                        </div>
                        {c.email && <div className="text-xs text-gray-500 truncate">{c.email}</div>}
                        {c.title && <div className="text-xs text-gray-400 truncate">{c.title}</div>}
                      </div>
                      {selected && <Check className="w-4 h-4 text-pink-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedContactId && (
              <button onClick={() => setSelectedContactId("")} className="text-xs text-red-500 hover:underline">
                Clear contact link
              </button>
            )}
          </div>
        )}

        </div>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between pt-3 mt-2 border-t shrink-0">
          <Button
            variant="ghost"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4" /> Log out
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}