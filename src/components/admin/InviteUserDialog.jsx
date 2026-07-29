import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, UserPlus, Search, Check } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Invite a firm employee. Per the firm workflow, the person must already exist
// as a contact in this firm — we invite using that contact's email so the new
// user is automatically mapped to the firm on first login (via onboarding).
export default function InviteUserDialog({ open, onClose, onInvited }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [role, setRole] = useState("user");
  const [saving, setSaving] = useState(false);

  const firmId = user?.linked_firm_id;

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["firm_invite_contacts", firmId],
    queryFn: () => base44.entities.Contact.list("-created_date", 2000),
    enabled: open && !!firmId,
  });

  const firmContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (contacts || [])
      .filter((c) => !c.deleted_at && Array.isArray(c.firm_ids) && c.firm_ids.includes(firmId) && c.email)
      .filter((c) => {
        if (!q) return true;
        const name = `${c.first_name} ${c.last_name}`.toLowerCase();
        return name.includes(q) || (c.email || "").toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [contacts, firmId, query]);

  const selected = firmContacts.find((c) => c.id === selectedId) || null;

  if (!open) return null;

  const handleInvite = async () => {
    if (!selected) {
      toast({ title: "Select a contact first", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await base44.users.inviteUser(selected.email.trim(), role);
      toast({
        title: "Invitation sent",
        description: `${selected.email.trim()} will be mapped to your firm when they sign in.`,
      });
      setSelectedId("");
      setQuery("");
      setRole("user");
      onInvited && onInvited();
      onClose();
    } catch (e) {
      toast({ title: "Invitation failed", description: e?.message || "Could not send invite.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-indigo-500" /> Invite Employee
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <p className="text-xs text-gray-500">
          Choose an existing contact from your firm. Their email is used for the invite, and they'll
          be automatically linked to this firm when they sign in.
        </p>

        {/* Contact search + pick */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Select a contact *</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts by name or email…"
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="max-h-44 overflow-y-auto border rounded-lg divide-y">
            {isLoading && <div className="p-3 text-sm text-gray-400 text-center">Loading…</div>}
            {!isLoading && firmContacts.length === 0 && (
              <div className="p-3 text-sm text-gray-400 text-center">No contacts found. Add the person as a contact first.</div>
            )}
            {firmContacts.map((c) => {
              const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "(no name)";
              const sel = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${sel ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-gray-500 truncate">{c.email}</div>
                  </div>
                  {sel && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected email + role */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Invite email</Label>
          <Input value={selected?.email || ""} readOnly className="h-8 text-sm bg-gray-50" placeholder="Select a contact above" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Platform role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User — standard access</SelectItem>
              <SelectItem value="admin">Administrator — platform-level access</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-gray-400">
            Firm-level permissions (edit/delete, co-admin) are set after the employee joins, from User &amp; Role Management.
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={!selected || saving}
            onClick={handleInvite}
          >
            {saving ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}