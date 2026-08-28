import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Briefcase, TrendingUp } from "lucide-react";
import SectionPageHeader, { SectionStatusCard, SectionBackButton } from "@/components/shared/SectionPageHeader";
import SectionModuleGrid from "@/components/shared/SectionModuleGrid";
import { PORTFOLIO_MODULES, PORTFOLIO_MODULE_MAP, PORTFOLIO_DEFAULT_CATEGORIES } from "@/components/sections/portfolioModules";
import PortfoliosSection from "@/components/portfolios/PortfoliosSection";

export default function SectionPortfolios() {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState(null);

  const { data: portfolios = [], isLoading } = useQuery({
    queryKey: ["portfolios_section_list"],
    queryFn: () => base44.entities.Portfolio.list("-created_date", 5000),
  });
  const activePortfolios = portfolios.filter((p) => !p.deleted_at && p.funding_status === "Active");

  const handleSelect = (key) => {
    const mod = PORTFOLIO_MODULE_MAP[key];
    if (!mod) return;
    if (mod.to) {
      navigate(mod.to);
      return;
    }
    if (key === "portfolios-list") setActiveModule("portfolios-list");
  };

  const activeLabel = activeModule ? PORTFOLIO_MODULE_MAP[activeModule]?.label : null;

  return (
    <div className="min-h-screen bg-gray-50/80">
      <SectionPageHeader
        icon={Briefcase}
        title="Portfolios"
        gradient="from-emerald-600 via-emerald-700 to-teal-800"
      />

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-12">
        {!activeModule && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <SectionStatusCard label="Active Portfolios" value={activePortfolios.length} icon={Briefcase} color="bg-emerald-500" loading={isLoading} />
            <SectionStatusCard label="Total Portfolios" value={portfolios.filter((p) => !p.deleted_at).length} icon={TrendingUp} color="bg-indigo-500" loading={isLoading} />
          </div>
        )}

        {!activeModule ? (
          <SectionModuleGrid
            modules={PORTFOLIO_MODULES}
            moduleMap={PORTFOLIO_MODULE_MAP}
            defaultCategories={PORTFOLIO_DEFAULT_CATEGORIES}
            storageKey="portfolios_layout_v1"
            onSelect={handleSelect}
            accentRing="ring-emerald-300"
          />
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <SectionBackButton label="Portfolios" onClick={() => setActiveModule(null)} />
              <h2 className="text-lg font-semibold text-gray-800">{activeLabel}</h2>
            </div>
            {activeModule === "portfolios-list" && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <PortfoliosSection
                  portfolios={portfolios.filter((p) => !p.deleted_at)}
                  onPortfolioClick={() => navigate("/")}
                  onAddPortfolio={() => navigate("/")}
                  forceExpanded
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}