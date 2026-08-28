import React from "react";
import { useNavigate } from "react-router-dom";
import SectionPageHeader from "@/components/shared/SectionPageHeader";
import SectionModuleGrid from "@/components/shared/SectionModuleGrid";
import { DASHBOARD_MODULES, DASHBOARD_MODULE_MAP, DASHBOARD_DEFAULT_CATEGORIES } from "@/components/sections/dashboardModules";
import { LayoutDashboard } from "lucide-react";

export default function SectionDashboard() {
  const navigate = useNavigate();

  const handleSelect = (key) => {
    const mod = DASHBOARD_MODULE_MAP[key];
    if (mod?.to) navigate(mod.to);
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <SectionPageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        gradient="from-indigo-600 via-indigo-700 to-violet-800"
      />

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-12">
        <SectionModuleGrid
          modules={DASHBOARD_MODULES}
          moduleMap={DASHBOARD_MODULE_MAP}
          defaultCategories={DASHBOARD_DEFAULT_CATEGORIES}
          storageKey="dashboard_section_layout_v1"
          onSelect={handleSelect}
          accentRing="ring-indigo-300"
        />
      </div>
    </div>
  );
}