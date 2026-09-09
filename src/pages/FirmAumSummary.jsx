import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionPageHeader from "@/components/shared/SectionPageHeader";
import FirmAumSummarySection from "@/components/firms/FirmAumSummarySection";
import { exportFirmAumSummaryCsv } from "@/components/firms/firmAumSummaryExport";

/**
 * Full-page view of the Firm AUM Summary (total product AUM per firm).
 * Surfaced as a Dashboard module so users can add it to their
 * customizable dashboard layout.
 */
export default function FirmAumSummary() {
  const navigate = useNavigate();

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    select: (data) => data.filter((f) => !f.deleted_at),
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 5000),
    select: (data) => data.filter((p) => !p.deleted_at),
  });

  const isLoading = firmsLoading || productsLoading;

  return (
    <div className="min-h-screen bg-gray-50/80">
      <SectionPageHeader
        icon={TrendingUp}
        title="Firm AUM Summary"
        gradient="from-emerald-600 via-emerald-700 to-teal-800"
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/15"
            disabled={isLoading || firms.length === 0}
            onClick={() => exportFirmAumSummaryCsv(firms, products)}
            title="Export firm AUM summary as CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        }
      />
      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-12">
        {isLoading ? (
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm p-8">
            <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="h-10 w-72 bg-gray-100 rounded animate-pulse mb-6" />
            <div className="h-64 w-full bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : (
          <FirmAumSummarySection
            firms={firms}
            products={products}
            onFirmClick={(firm) => navigate(`/?firmId=${firm.id}`)}
            forceExpanded={true}
          />
        )}
      </div>
    </div>
  );
}