import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePersistentState } from "@/hooks/usePersistentState";
import { FileBarChart, FileStack, LayoutDashboard, Search, SlidersHorizontal } from "lucide-react";
import SectionPageHeader, { SectionStatusCard } from "@/components/shared/SectionPageHeader";
import SectionModuleGrid from "@/components/shared/SectionModuleGrid";
import { REPORT_MODULES, REPORT_MODULE_MAP, REPORT_DEFAULT_CATEGORIES } from "@/components/sections/reportModules";
import { lazyDialog } from "@/components/common/lazyDialog";
import EntityFilterSidebar from "@/components/common/EntityFilterSidebar";
import { Button } from "@/components/ui/button";

const ReportsPickerModal = lazyDialog(() => import("@/components/reports/ReportsPickerModal"));
const StandardReportsList = lazyDialog(() => import("@/components/reports/StandardReportsList"));

export default function SectionReports() {
  const navigate = useNavigate();
  const [customOpen, setCustomOpen] = usePersistentState("rpt_customOpen", false);
  const [standardOpen, setStandardOpen] = usePersistentState("rpt_standardOpen", false);
  const [showFilters, setShowFilters] = useState(true);
  const [filterValues, setFilterValues] = useState({ category: new Set(), module_search: "" });
  const handleFilterChange = (key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }));
  const clearAllFilters = () => setFilterValues({ category: new Set(), module_search: "" });
  const hasActiveSidebarFilters = (filterValues.category?.size > 0) || (filterValues.module_search || "").trim();

  const reportSidebarGroups = [
    { key: "category", label: "Module Category", icon: LayoutDashboard, type: "checkbox",
      options: REPORT_DEFAULT_CATEGORIES.map((c) => ({ value: c.id, label: c.name })) },
    { key: "module_search", label: "Search Modules", icon: Search, type: "search", placeholder: "Search module name..." },
  ];
  const sidebarCounts = useMemo(() => {
    const category = {};
    for (const c of REPORT_DEFAULT_CATEGORIES) category[c.id] = c.items.length;
    return { category };
  }, []);
  const filteredModules = useMemo(() => {
    let result = REPORT_MODULES;
    if (filterValues.category?.size > 0) {
      const visibleKeys = new Set(REPORT_DEFAULT_CATEGORIES.filter((c) => filterValues.category.has(c.id)).flatMap((c) => c.items));
      result = result.filter((m) => visibleKeys.has(m.key));
    }
    if ((filterValues.module_search || "").trim()) {
      const q = filterValues.module_search.toLowerCase().trim();
      result = result.filter((m) => (m.label || "").toLowerCase().includes(q));
    }
    return result;
  }, [filterValues]);
  const filteredCategories = useMemo(() => {
    if (!filterValues.category || filterValues.category.size === 0) return REPORT_DEFAULT_CATEGORIES;
    return REPORT_DEFAULT_CATEGORIES.filter((c) => filterValues.category.has(c.id));
  }, [filterValues]);

  const { data: savedReports = [], isLoading } = useQuery({
    queryKey: ["reports_section_count"],
    queryFn: () => base44.entities.CustomReport.filter({ deleted_at: null }, "-created_date"),
  });

  const handleSelect = (key) => {
    const mod = REPORT_MODULE_MAP[key];
    if (!mod) return;
    if (mod.to) {
      navigate(mod.to);
      return;
    }
    if (key === "custom-reports") setCustomOpen(true);
    else if (key === "standard-reports") setStandardOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <SectionPageHeader
        icon={FileBarChart}
        title="Reports"
        gradient="from-cyan-600 via-cyan-700 to-blue-800"
      />

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <SectionStatusCard label="Saved Custom Reports" value={savedReports.length} icon={FileStack} color="bg-cyan-500" loading={isLoading} />
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          {showFilters && (
            <div className="w-full md:w-56 flex-shrink-0">
              <EntityFilterSidebar
                sectionKey="reports"
                groups={reportSidebarGroups}
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
                className={`h-7 px-2 gap-1 text-xs ${showFilters ? "text-cyan-700 bg-cyan-50" : "text-gray-500 hover:text-cyan-700 hover:bg-cyan-50"}`}
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {showFilters ? "Hide Filters" : "Filters"}
              </Button>
            </div>
            <SectionModuleGrid
              modules={filteredModules}
              moduleMap={REPORT_MODULE_MAP}
              defaultCategories={filteredCategories}
              storageKey="reports_layout_v1"
              onSelect={handleSelect}
              accentRing="ring-cyan-300"
            />
          </div>
        </div>
      </div>

      <ReportsPickerModal open={customOpen} onClose={() => setCustomOpen(false)} />
      <StandardReportsList open={standardOpen} onClose={() => setStandardOpen(false)} onUse={() => setStandardOpen(false)} />
    </div>
  );
}