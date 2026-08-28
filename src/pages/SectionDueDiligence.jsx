import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, ListChecks, Clock } from "lucide-react";
import SectionPageHeader, { SectionStatusCard } from "@/components/shared/SectionPageHeader";
import SectionModuleGrid from "@/components/shared/SectionModuleGrid";
import { DD_MODULES, DD_MODULE_MAP, DD_DEFAULT_CATEGORIES } from "@/components/sections/ddModules";
import { lazyDialog } from "@/components/common/lazyDialog";
import { useAuth } from "@/lib/AuthContext";

const DocumentsDashboardModal = lazyDialog(() => import("@/components/firms/DocumentsDashboardModal"));
const TemplatePickerModal = lazyDialog(() => import("@/components/templates/TemplatePickerModal"));
const QuestionnairePickerModal = lazyDialog(() => import("@/components/questionnaires/QuestionnairePickerModal"));

export default function SectionDueDiligence() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

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

        <SectionModuleGrid
          modules={DD_MODULES}
          moduleMap={DD_MODULE_MAP}
          defaultCategories={DD_DEFAULT_CATEGORIES}
          storageKey="dd_layout_v1"
          onSelect={handleSelect}
          accentRing="ring-indigo-300"
        />
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