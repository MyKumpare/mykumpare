import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, UserPlus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function InviteUserDialog({ open, onClose, onInvited }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSaving(true);
    try {
      await base44.users.inviteUser(email.trim(), role);
      toast({ title: "Invitation sent", description: `${email.trim()} invited as ${role === "admin" ? "Administrator" : "User"}.` });
      setEmail("");
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-indigo-500" /> Invite User
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Email address</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User — standard access</SelectItem>
              <SelectItem value="admin">Administrator — full access</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={!email.trim() || saving}
            onClick={handleInvite}
          >
            {saving ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}