import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { FileBarChart, FileStack } from "lucide-react";
import SectionPageHeader, { SectionStatusCard } from "@/components/shared/SectionPageHeader";
import SectionModuleGrid from "@/components/shared/SectionModuleGrid";
import { REPORT_MODULES, REPORT_MODULE_MAP, REPORT_DEFAULT_CATEGORIES } from "@/components/sections/reportModules";
import { lazyDialog } from "@/components/common/lazyDialog";

const ReportsPickerModal = lazyDialog(() => import("@/components/reports/ReportsPickerModal"));
const StandardReportsList = lazyDialog(() => import("@/components/reports/StandardReportsList"));

export default function SectionReports() {
  const navigate = useNavigate();
  const [customOpen, setCustomOpen] = useState(false);
  const [standardOpen, setStandardOpen] = useState(false);

  const { data: savedReports = [], isLoading } = useQuery({
    queryKey: ["reports_section_count"],
    queryFn: () => base44.entities.CustomReport.list("-created_date"),
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

        <SectionModuleGrid
          modules={REPORT_MODULES}
          moduleMap={REPORT_MODULE_MAP}
          defaultCategories={REPORT_DEFAULT_CATEGORIES}
          storageKey="reports_layout_v1"
          onSelect={handleSelect}
          accentRing="ring-cyan-300"
        />
      </div>

      <ReportsPickerModal open={customOpen} onClose={() => setCustomOpen(false)} />
      <StandardReportsList open={standardOpen} onClose={() => setStandardOpen(false)} onUse={() => setStandardOpen(false)} />
    </div>
  );
}