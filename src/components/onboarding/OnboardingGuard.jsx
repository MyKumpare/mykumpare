import React from "react";
import { useAuth } from "@/lib/AuthContext";
import FirmOnboardingDialog from "./FirmOnboardingDialog";

// App-wide guard: any signed-in user who hasn't yet been linked to a firm
// (tenant) is forced through the onboarding/join step before using the app.
export default function OnboardingGuard() {
  const { user, isLoadingAuth } = useAuth();
  if (isLoadingAuth || !user) return null;
  // Platform admins are cross-tenant super-admins (the app owner/seller) —
  // they are not forced through per-firm onboarding.
  if (user.role === "admin") return null;
  if (user.linked_firm_id && user.onboarded) return null;
  return <FirmOnboardingDialog />;
}