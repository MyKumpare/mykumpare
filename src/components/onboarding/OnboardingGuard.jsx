import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import FirmOnboardingDialog from "./FirmOnboardingDialog";

// App-wide guard: any signed-in user who hasn't yet been linked to a firm
// (tenant) is either auto-linked from a pending invitation, or forced through
// the onboarding/join step before using the app.
export default function OnboardingGuard() {
  const { user, isLoadingAuth, updateUser } = useAuth();
  const [linking, setLinking] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isLoadingAuth || !user) return;
    if (user.role === "admin") { setChecked(true); return; }
    if (user.linked_firm_id && user.onboarded) { setChecked(true); return; }

    let cancelled = false;
    (async () => {
      try {
        const invs = await base44.entities.PendingInvitation.list("-created_date", 50);
        const inv = (invs || []).find((i) => !i.accepted);
        if (!inv) { if (!cancelled) setChecked(true); return; }

        setLinking(true);
        // Auto-link the employee to their firm with the admin-chosen access
        await updateUser({
          linked_firm_id: inv.firm_id,
          firm_role: inv.firm_role || "user",
          can_edit: !!inv.can_edit,
          can_delete: !!inv.can_delete,
          onboarded: true,
          ...(inv.contact_id ? { linked_contact_id: inv.contact_id } : {}),
        });
        // Mark the invitation accepted so it isn't re-applied
        try { await base44.entities.PendingInvitation.update(inv.id, { accepted: true }); } catch {}
        if (!cancelled) {
          toast({
            title: "Welcome to the firm portal",
            description: inv.firm_name ? `You've been added to ${inv.firm_name}.` : "You've been added to your firm.",
          });
        }
      } catch {
        // No invitation found or linking failed — fall through to manual onboarding
      } finally {
        if (!cancelled) { setLinking(false); setChecked(true); }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, isLoadingAuth]);

  if (isLoadingAuth || !user) return null;
  if (user.role === "admin") return null;

  if (linking || !checked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-[80]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">{linking ? "Setting up your firm portal…" : "Loading…"}</p>
        </div>
      </div>
    );
  }

  if (user.linked_firm_id && user.onboarded) return null;
  return <FirmOnboardingDialog />;
}