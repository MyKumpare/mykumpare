import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, UserPlus, Search, Check, Mail } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Invite a firm employee to join the firm portal. Two modes:
//  - "email": invite a brand-new person by email; they are auto-linked to the
//    chosen firm (linked_firm_id + firm_role + permissions + onboarded) and a
//    contact record is created so they appear in the firm directory.
//  - "contact": pick an existing firm contact and send the platform invite to
//    their email (legacy behaviour).
export default function InviteUserDialog({ open, onClose, onInvited }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("email");
  const [saving, setSaving] = useState(false);

  // shared
  const [role, setRole] = useState("user");

  // contact mode
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [firmFilter, setFirmFilter] = useState("__all__");

  // email mode
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [firmRole, setFirmRole] = useState("user");
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [firmId, setFirmId] = useState(user?.linked_firm_id || "");

  const myFirmId = user?.linked_firm_id;

  useEffect(() => {
    if (open) setFirmId(myFirmId || "");
  }, [myFirmId, open]);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["firm_invite_contacts", myFirmId],
    queryFn: () => base44.entities.Contact.list("-created_date", 2000),
    enabled: open && !!myFirmId && mode === "contact",
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(),
    enabled: open,
  });

  const firmContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (contacts || [])
      .filter((c) => !c.deleted_at && c.email)
      .filter((c) => {
        if (firmFilter === "__all__") return Array.isArray(c.firm_ids) && c.firm_ids.includes(myFirmId);
        return Array.isArray(c.firm_ids) && c.firm_ids.includes(firmFilter);
      })
      .filter((c) => {
        if (!q) return true;
        const name = `${c.first_name} ${c.last_name}`.toLowerCase();
        return name.includes(q) || (c.email || "").toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [contacts, myFirmId, firmFilter, query]);

  const selected = firmContacts.find((c) => c.id === selectedId) || null;

  if (!open) return null;

  const reset = () => {
    setEmail(""); setFirstName(""); setLastName(""); setQuery(""); setSelectedId("");
    setFirmFilter("__all__");
    setRole("user"); setFirmRole("user"); setCanEdit(false); setCanDelete(false);
  };

  const handleInviteContact = async () => {
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
      reset();
      onInvited && onInvited();
      onClose();
    } catch (e) {
      toast({ title: "Invitation failed", description: e?.message || "Could not send invite.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleInviteEmail = async () => {
    const em = email.trim();
    if (!EMAIL_RE.test(em)) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    if (!firmId) {
      toast({ title: "Select a firm for this employee", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // 1. Send the platform join email (creates a pending user record)
      try {
        await base44.users.inviteUser(em, role);
      } catch (e) {
        const msg = (e?.message || "").toLowerCase();
        if (!msg.includes("already") && !msg.includes("exist") && !msg.includes("registered") && !msg.includes("invited")) {
          throw e;
        }
      }

      // 2. Pre-create a contact so the employee appears in the firm directory
      let contactId = null;
      try {
        const contact = await base44.entities.Contact.create({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: em,
          firm_ids: [firmId],
          tenant_id: firmId,
          contact_status: "Active",
        });
        contactId = contact?.id || null;
      } catch {
        /* best-effort; invitation still recorded */
      }

      // 3. Record the pending invitation — the employee is auto-linked to the
      //    firm (with the access chosen here) when they first sign in.
      const firm = firms.find((f) => f.id === firmId);
      await base44.entities.PendingInvitation.create({
        email: em,
        firm_id: firmId,
        firm_name: firm?.name || "",
        firm_role: firmRole,
        can_edit: canEdit,
        can_delete: canDelete,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        contact_id: contactId,
        invited_by_name: user?.full_name || user?.email || "",
        accepted: false,
      });

      queryClient.invalidateQueries({ queryKey: ["pending_invitations"] });
      toast({
        title: "Invitation sent",
        description: `${em} will be added to ${firm?.name || "the firm"} when they sign in.`,
      });
      reset();
      onInvited && onInvited();
      onClose();
    } catch (e) {
      toast({ title: "Invitation failed", description: e?.message || "Could not send invite.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = "h-8 text-sm";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-indigo-500" /> Invite Employee
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            type="button"
            onClick={() => setMode("email")}
            className={`text-xs font-medium py-1.5 rounded-md transition-colors ${mode === "email" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Invite by email
          </button>
          <button
            type="button"
            onClick={() => setMode("contact")}
            className={`text-xs font-medium py-1.5 rounded-md transition-colors ${mode === "contact" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Choose existing contact
          </button>
        </div>

        {mode === "contact" && (
          <>
            <p className="text-xs text-gray-500">
              Choose an existing contact from your firm. Their email is used for the invite, and they'll
              be automatically linked to this firm when they sign in.
            </p>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Filter by firm</Label>
              <Select value={firmFilter} onValueChange={setFirmFilter}>
                <SelectTrigger className={fieldCls}><SelectValue /></SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="__all__">My firm ({firms.find((f) => f.id === myFirmId)?.name || "default"})</SelectItem>
                  {firms.filter((f) => !f.deleted_at && f.id !== myFirmId).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                  <div className="p-3 text-sm text-gray-400 text-center">No contacts found. Add the person as a contact first, or use “Invite by email”.</div>
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

            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Invite email</Label>
              <Input value={selected?.email || ""} readOnly className="h-8 text-sm bg-gray-50" placeholder="Select a contact above" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Platform role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className={fieldCls}><SelectValue /></SelectTrigger>
                <SelectContent className="z-[70]">
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
                onClick={handleInviteContact}
              >
                {saving ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </>
        )}

        {mode === "email" && (
          <>
            <p className="text-xs text-gray-500">
              Invite a new person by email. They'll receive a join link and be automatically linked to the
              selected firm with the access you choose below.
            </p>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Email address *</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@firm.com"
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={fieldCls} placeholder="Jane" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className={fieldCls} placeholder="Smith" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Firm portal *</Label>
              <Select value={firmId} onValueChange={setFirmId}>
                <SelectTrigger className={fieldCls}><SelectValue placeholder="Select a firm" /></SelectTrigger>
                <SelectContent className="z-[70]">
                  {firms.filter((f) => !f.deleted_at).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Platform role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className={fieldCls}><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Firm role</Label>
                <Select value={firmRole} onValueChange={setFirmRole}>
                  <SelectTrigger className={fieldCls}><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="user">Member</SelectItem>
                    <SelectItem value="co-admin">Co-Admin</SelectItem>
                    <SelectItem value="admin">Firm Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-5 pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <Checkbox checked={canEdit} onCheckedChange={(v) => setCanEdit(!!v)} />
                Can edit records
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <Checkbox checked={canDelete} onCheckedChange={(v) => setCanDelete(!!v)} />
                Can delete records
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={!email.trim() || !firmId || saving}
                onClick={handleInviteEmail}
              >
                {saving ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}