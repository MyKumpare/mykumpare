import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, Loader2, UserCheck } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Firm types a new signer can select for their own firm at signup.
const SIGNUP_FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Investment Consultant",
];

function splitName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/);
  const first_name = parts[0] || "";
  const last_name = parts.slice(1).join(" ") || "";
  return { first_name, last_name };
}

export default function FirmOnboardingDialog() {
  const { user, updateUser } = useAuth();
  const [detecting, setDetecting] = useState(true);
  const [matchContact, setMatchContact] = useState(null); // existing contact matching this user's email
  const [matchFirm, setMatchFirm] = useState(null);
  const [mode, setMode] = useState(null); // 'join' | 'create'
  const [firmName, setFirmName] = useState("");
  const [firmType, setFirmType] = useState(SIGNUP_FIRM_TYPES[0]);
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);

  // Auto-detect: is there an existing contact (created by an admin invite) whose
  // email matches this user? If so, this user was invited to an existing firm.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.email) { setDetecting(false); setMode("create"); return; }
      try {
        const contacts = await base44.entities.Contact.list("-created_date", 1000);
        const found = (contacts || []).find(
          (c) => !c.deleted_at && c.email && c.email.toLowerCase() === user.email.toLowerCase(),
        );
        if (!active) return;
        if (found && Array.isArray(found.firm_ids) && found.firm_ids.length > 0) {
          setMatchContact(found);
          try {
            const firm = await base44.entities.Firm.get(found.firm_ids[0]);
            if (active) setMatchFirm(firm);
          } catch { /* firm lookup optional */ }
          setMode("join");
        } else {
          setMode("create");
        }
      } catch {
        if (active) setMode("create");
      } finally {
        if (active) setDetecting(false);
      }
    })();
    return () => { active = false; };
  }, [user?.email]);

  const handleJoin = async () => {
    if (!matchContact) return;
    setSaving(true);
    try {
      await updateUser({
        linked_firm_id: matchContact.firm_ids[0],
        linked_contact_id: matchContact.id,
        firm_role: "user",
        onboarded: true,
      });
      toast({ title: "Welcome", description: "You've joined your firm workspace." });
    } catch (e) {
      toast({ title: "Could not complete onboarding", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!firmName.trim()) {
      toast({ title: "Firm name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("onboardNewFirm", {
        name: firmName.trim(),
        firm_type: firmType,
        website: website.trim(),
      });
      const result = res?.data || {};
      if (result.error) throw new Error(result.error);
      await updateUser({
        linked_firm_id: result.firm_id,
        linked_contact_id: result.contact_id,
        firm_role: "admin",
        onboarded: true,
      });
      toast({ title: "Firm created", description: "You are the administrator of your firm workspace." });
    } catch (e) {
      toast({ title: "Could not create firm", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">Welcome to MyKumpare</h2>
            <p className="text-xs text-gray-500">Let's set up your firm workspace.</p>
          </div>
        </div>

        {detecting && (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Looking up your account…
          </div>
        )}

        {!detecting && mode === "join" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
              <UserCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-sm text-emerald-800">
                You've been invited to <span className="font-semibold">{matchFirm?.name || "your firm"}</span>.
                Confirm to join your firm's workspace.
              </div>
            </div>
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={saving}
              onClick={handleJoin}
            >
              {saving ? "Joining…" : "Join my firm"}
            </Button>
          </div>
        )}

        {!detecting && mode === "create" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Create your firm. You'll be the administrator and can invite your colleagues afterwards.
            </p>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Firm name *</Label>
              <Input
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="e.g. Acme Investment Partners"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Firm type *</Label>
              <Select value={firmType} onValueChange={setFirmType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIGNUP_FIRM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Website (optional)</Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={saving || !firmName.trim()}
              onClick={handleCreate}
            >
              {saving ? "Creating…" : "Create firm & continue"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}