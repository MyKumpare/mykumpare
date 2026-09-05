import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePersistentState } from "@/hooks/usePersistentState";
import SectionPageHeader from "@/components/shared/SectionPageHeader";
import SectionModuleGrid from "@/components/shared/SectionModuleGrid";
import { DASHBOARD_MODULES, DASHBOARD_MODULE_MAP, DASHBOARD_DEFAULT_CATEGORIES } from "@/components/sections/dashboardModules";
import { useSavedSectionLayout } from "@/components/shared/useSavedSectionLayout";
import { LayoutDashboard, Pencil, Eye, Save, Users, Building2, Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import DashboardChartsPanel from "@/components/dashboard/DashboardChartsPanel";

export default function SectionDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = usePersistentState("dash_mode", "edit");
  const [layoutApi, setLayoutApi] = useState(null);
  const { userLayout, firmwideLayout, saveLayout, isSaving } = useSavedSectionLayout("dashboard");

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    select: (data) => data.filter((f) => !f.deleted_at),
  });

  const handleSelect = (key) => {
    const mod = DASHBOARD_MODULE_MAP[key];
    if (mod?.to) navigate(mod.to);
  };

  const handleLayoutApi = useCallback((api) => {
    setLayoutApi(api);
  }, []);

  const handleSaveUser = () => {
    if (!layoutApi) return;
    // Read current categories from localStorage (the working copy)
    try {
      const raw = localStorage.getItem("dashboard_section_layout_v1");
      const categories = raw ? JSON.parse(raw).categories : null;
      if (!categories) {
        toast({ title: "Nothing to save", description: "Adjust the layout first, then save.", variant: "destructive" });
        return;
      }
      saveLayout(
        { scope: "user", categories },
        {
          onSuccess: () => toast({ title: "Layout saved", description: "Your personal dashboard layout has been saved." }),
          onError: (err) => toast({ title: "Save failed", description: err?.message || "Please try again.", variant: "destructive" }),
        }
      );
    } catch {
      toast({ title: "Save failed", description: "Could not read the current layout.", variant: "destructive" });
    }
  };

  const handleSaveFirm = () => {
    if (!layoutApi) return;
    try {
      const raw = localStorage.getItem("dashboard_section_layout_v1");
      const categories = raw ? JSON.parse(raw).categories : null;
      if (!categories) {
        toast({ title: "Nothing to save", description: "Adjust the layout first, then save.", variant: "destructive" });
        return;
      }
      saveLayout(
        { scope: "firmwide", categories },
        {
          onSuccess: () => toast({ title: "Firmwide layout saved", description: "All users in your firm will see this layout." }),
          onError: (err) => toast({ title: "Save failed", description: err?.message || "Please try again.", variant: "destructive" }),
        }
      );
    } catch {
      toast({ title: "Save failed", description: "Could not read the current layout.", variant: "destructive" });
    }
  };

  const handleLoadUser = () => {
    if (!layoutApi?.setCategories || !userLayout) return;
    layoutApi.setCategories(userLayout.categories);
    toast({ title: "Layout loaded", description: "Your saved personal layout has been loaded." });
  };

  const handleLoadFirm = () => {
    if (!layoutApi?.setCategories || !firmwideLayout) return;
    layoutApi.setCategories(firmwideLayout.categories);
    toast({ title: "Firmwide layout loaded", description: "The firmwide layout has been loaded." });
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <SectionPageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        gradient="from-indigo-600 via-indigo-700 to-violet-800"
        actions={
          <div className="flex items-center gap-1.5">
            {/* Mode toggle */}
            <div className="inline-flex rounded-lg bg-white/15 p-0.5 mr-1">
              <button
                onClick={() => setMode("edit")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === "edit" ? "bg-white text-indigo-700" : "text-white/80 hover:text-white"
                }`}
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={() => setMode("preview")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === "preview" ? "bg-white text-indigo-700" : "text-white/80 hover:text-white"
                }`}
              >
                <Eye className="w-3 h-3" />
                Preview
              </button>
            </div>
          </div>
        }
      />

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-12">
        {/* Save / Load bar — only in edit mode */}
        {mode === "edit" && (
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">Layout Management:</span>
              {userLayout && (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Check className="w-3 h-3" />
                  Personal layout saved {userLayout.updated_at_label ? `· ${userLayout.updated_at_label}` : ""}
                </span>
              )}
              {firmwideLayout && (
                <span className="inline-flex items-center gap-1 text-indigo-600">
                  <Check className="w-3 h-3" />
                  Firmwide layout saved {firmwideLayout.updated_at_label ? `· ${firmwideLayout.updated_at_label}` : ""}
                </span>
              )}
              {!userLayout && !firmwideLayout && (
                <span>No saved layouts yet — arrange modules and save below.</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {userLayout && (
                <Button size="sm" variant="outline" onClick={handleLoadUser} disabled={isSaving}>
                  <Upload className="w-3.5 h-3.5" />
                  Load My Layout
                </Button>
              )}
              {firmwideLayout && (
                <Button size="sm" variant="outline" onClick={handleLoadFirm} disabled={isSaving}>
                  <Upload className="w-3.5 h-3.5" />
                  Load Firm Layout
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleSaveUser} disabled={isSaving}>
                <Users className="w-3.5 h-3.5" />
                {isSaving ? "Saving..." : "Save for Me"}
              </Button>
              <Button size="sm" onClick={handleSaveFirm} disabled={isSaving}>
                <Building2 className="w-3.5 h-3.5" />
                {isSaving ? "Saving..." : "Save for Firm"}
              </Button>
            </div>
          </div>
        )}

        {mode === "preview" && (
          <p className="text-sm text-gray-500 mb-4">
            Preview mode — click a card to open it. Switch to Edit to rearrange.
          </p>
        )}

        {/* Toggleable dashboard charts — users select which to display */}
        <DashboardChartsPanel firms={firms} />

        <SectionModuleGrid
          modules={DASHBOARD_MODULES}
          moduleMap={DASHBOARD_MODULE_MAP}
          defaultCategories={DASHBOARD_DEFAULT_CATEGORIES}
          storageKey="dashboard_section_layout_v1"
          onSelect={handleSelect}
          accentRing="ring-indigo-300"
          readOnly={mode === "preview"}
          onLayoutApi={handleLayoutApi}
        />
      </div>
    </div>
  );
}