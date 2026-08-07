import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  Mail, Loader2, Bell, CheckCircle2, Clock, Building2, Send, Search, Trash2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return d; }
};

export default function SentInvitationsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reminding, setReminding] = useState(null);
  const [rescinding, setRescinding] = useState(null);
  const [confirmRescind, setConfirmRescind] = useState(null);
  const [search, setSearch] = useState("");

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["portal_invitations"],
    queryFn: async () => {
      const res = await base44.functions.invoke("inviteToPortal", { action: "list" });
      return res.data?.invitations || [];
    },
  });

  const filtered = invitations.filter((inv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.email?.toLowerCase().includes(q) ||
      inv.firm_name?.toLowerCase().includes(q) ||
      inv.contact_name?.toLowerCase().includes(q)
    );
  });

  const handleRemind = async (inv) => {
    setReminding(inv.id);
    try {
      const regUrl = `${window.location.origin}/#/register`;
      await base44.functions.invoke("sendExternalInvitationEmail", {
        email: inv.email,
        inviteeName: inv.contact_name || [inv.first_name, inv.last_name].filter(Boolean).join(" "),
        firmName: inv.firm_name,
        invitedByName: user?.full_name || user?.email,
        registrationUrl: regUrl,
      });
      toast({ title: "Reminder sent", description: `A reminder was emailed to ${inv.email}.` });
    } catch (err) {
      toast({ title: "Reminder failed", description: err?.message || "Could not send reminder.", variant: "destructive" });
    } finally {
      setReminding(null);
    }
  };

  const handleRescind = async () => {
    if (!confirmRescind) return;
    setRescinding(confirmRescind.id);
    try {
      const res = await base44.functions.invoke("inviteToPortal", {
        action: "rescind",
        invitation_id: confirmRescind.id,
      });
      if (res.data?.error) throw new Error(res.data.error);
      await queryClient.invalidateQueries({ queryKey: ["portal_invitations"] });
      toast({ title: "Invitation rescinded", description: `The invitation to ${confirmRescind.email} has been removed.` });
    } catch (err) {
      toast({ title: "Could not rescind", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setRescinding(null);
      setConfirmRescind(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5 text-indigo-500" /> Sent Invitations ({invitations.length})
        </h2>
      </div>

      {invitations.length > 0 && (
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by name, email, or firm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-6 text-sm text-gray-400">Loading invitations...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 rounded-lg border border-dashed border-gray-200">
          <p className="text-sm text-gray-400">No invitations sent yet</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Use "Invite Contact" to invite an external party.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((inv) => (
            <div key={inv.id} className="rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {inv.contact_name || [inv.first_name, inv.last_name].filter(Boolean).join(" ") || inv.email}
                    </p>
                    {inv.accepted ? (
                      <Badge className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Registered
                      </Badge>
                    ) : (
                      <Badge className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3" /> {inv.email}
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {inv.firm_name || "—"}
                    {inv.invited_by_name && <><span className="text-gray-300">·</span> invited by {inv.invited_by_name}</>}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Sent {fmtDate(inv.created_date)}</p>
                </div>
                {!inv.accepted && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={reminding === inv.id || rescinding === inv.id}
                      onClick={() => handleRemind(inv)}
                    >
                      {reminding === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                      Remind
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                      disabled={rescinding === inv.id}
                      onClick={() => setConfirmRescind(inv)}
                    >
                      {rescinding === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Rescind
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmRescind} onOpenChange={(open) => { if (!open) setConfirmRescind(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rescind invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the pending invitation to{" "}
              <span className="font-medium">{confirmRescind?.email}</span>
              {" "}at <span className="font-medium">{confirmRescind?.firm_name}</span>.
              The contact will no longer be able to register from this invitation link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleRescind}
            >
              Rescind Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}