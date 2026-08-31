import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePersistentState } from "@/hooks/usePersistentState";
import { ShieldCheck, ListChecks, Clock, LayoutDashboard, Search, SlidersHorizontal } from "lucide-react";
import SectionPageHeader, { SectionStatusCard } from "@/components/shared/SectionPageHeader";
import SectionModuleGrid from "@/components/shared/SectionModuleGrid";
import { DD_MODULES, DD_MODULE_MAP, DD_DEFAULT_CATEGORIES } from "@/components/sections/ddModules";
import { lazyDialog } from "@/components/common/lazyDialog";
import { useAuth } from "@/lib/AuthContext";
import EntityFilterSidebar from "@/components/common/EntityFilterSidebar";
import { Button } from "@/components/ui/button";

const DocumentsDashboardModal = lazyDialog(() => import("@/components/firms/DocumentsDashboardModal"));
const TemplatePickerModal = lazyDialog(() => import("@/components/templates/TemplatePickerModal"));
const QuestionnairePickerModal = lazyDialog(() => import("@/components/questionnaires/QuestionnairePickerModal"));

export default function SectionDueDiligence() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documentsOpen, setDocumentsOpen] = usePersistentState("dd_documentsOpen", false);
  const [formsOpen, setFormsOpen] = usePersistentState("dd_formsOpen", false);
  const [templatesOpen, setTemplatesOpen] = usePersistentState("dd_templatesOpen", false);
  const [showFilters, setShowFilters] = useState(true);
  const [filterValues, setFilterValues] = useState({ category: new Set(), module_search: "" });
  const handleFilterChange = (key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }));
  const clearAllFilters = () => setFilterValues({ category: new Set(), module_search: "" });
  const hasActiveSidebarFilters = (filterValues.category?.size > 0) || (filterValues.module_search || "").trim();

  const ddSidebarGroups = [
    { key: "category", label: "Module Category", icon: LayoutDashboard, type: "checkbox",
      options: DD_DEFAULT_CATEGORIES.map((c) => ({ value: c.id, label: c.name })) },
    { key: "module_search", label: "Search Modules", icon: Search, type: "search", placeholder: "Search module name..." },
  ];
  const sidebarCounts = useMemo(() => {
    const category = {};
    for (const c of DD_DEFAULT_CATEGORIES) category[c.id] = c.items.length;
    return { category };
  }, []);
  const filteredModules = useMemo(() => {
    let result = DD_MODULES;
    if (filterValues.category?.size > 0) {
      const visibleKeys = new Set(DD_DEFAULT_CATEGORIES.filter((c) => filterValues.category.has(c.id)).flatMap((c) => c.items));
      result = result.filter((m) => visibleKeys.has(m.key));
    }
    if ((filterValues.module_search || "").trim()) {
      const q = filterValues.module_search.toLowerCase().trim();
      result = result.filter((m) => (m.label || "").toLowerCase().includes(q));
    }
    return result;
  }, [filterValues]);
  const filteredCategories = useMemo(() => {
    if (!filterValues.category || filterValues.category.size === 0) return DD_DEFAULT_CATEGORIES;
    return DD_DEFAULT_CATEGORIES.filter((c) => filterValues.category.has(c.id));
  }, [filterValues]);

  const { data: ddRecords = [], isLoading } = useQuery({
    queryKey: ["dd_section_count"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 5000),
  });
  const activeDd = ddRecords.filter((r) => !r.deleted_at);
  const pendingApprovals = activeDd.reduce(
    (sum, dd) => sum + (dd.stages || []).filter((s) => s.supervisor_status === "pending" && s.supervisor_contact_id).length,
    0
  );

  const handleSelect = (key) => {
    const mod = DD_MODULE_MAP[key];
    if (!mod) return;
    if (mod.to) {
      navigate(mod.to);
      return;
    }
    if (key === "documents") setDocumentsOpen(true);
    else if (key === "forms") setFormsOpen(true);
    else if (key === "templates") setTemplatesOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <SectionPageHeader
        icon={ShieldCheck}
        title="Due Diligence"
        gradient="from-indigo-600 via-indigo-700 to-violet-800"
      />

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <SectionStatusCard label="Due Diligence Records" value={activeDd.length} icon={ListChecks} color="bg-indigo-500" loading={isLoading} />
          <SectionStatusCard label="Pending Approvals" value={pendingApprovals} icon={Clock} color="bg-amber-500" loading={isLoading} />
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          {showFilters && (
            <div className="w-full md:w-56 flex-shrink-0">
              <EntityFilterSidebar
                sectionKey="due_diligence"
                groups={ddSidebarGroups}
                values={filterValues}
                onChange={handleFilterChange}
                counts={sidebarCounts}
                onClearAll={clearAllFilters}
                hasActiveFilters={hasActiveSidebarFilters}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 gap-1 text-xs ${showFilters ? "text-indigo-700 bg-indigo-50" : "text-gray-500 hover:text-indigo-700 hover:bg-indigo-50"}`}
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {showFilters ? "Hide Filters" : "Filters"}
              </Button>
            </div>
            <SectionModuleGrid
              modules={filteredModules}
              moduleMap={DD_MODULE_MAP}
              defaultCategories={filteredCategories}
              storageKey="dd_layout_v1"
              onSelect={handleSelect}
              accentRing="ring-indigo-300"
            />
          </div>
        </div>
      </div>

      <DocumentsDashboardModal open={documentsOpen} onClose={() => setDocumentsOpen(false)} />
      <TemplatePickerModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <QuestionnairePickerModal
        open={formsOpen}
        onClose={() => setFormsOpen(false)}
        user={user}
        onFirmClick={() => setFormsOpen(false)}
        onContactClick={() => setFormsOpen(false)}
        onProductClick={() => setFormsOpen(false)}
      />
    </div>
  );
}