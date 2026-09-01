import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TrendingUp } from "lucide-react";
import FirmAumTrendCard from "@/components/dashboard/FirmAumTrendCard";
import SectionPageHeader from "@/components/shared/SectionPageHeader";

/**
 * Full-page view of the Firm AUM & Net Flow Trends chart.
 * Surfaced as a Dashboard module so users can add it to their
 * customizable dashboard layout.
 */
export default function FirmAumTrends() {
  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    select: (data) => data.filter((f) => !f.deleted_at),
  });

  return (
    <div className="min-h-screen bg-gray-50/80">
      <SectionPageHeader
        icon={TrendingUp}
        title="Firm AUM & Net Flow Trends"
        gradient="from-indigo-600 via-indigo-700 to-violet-800"
      />
      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-12">
        {isLoading ? (
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm p-8">
            <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="h-10 w-72 bg-gray-100 rounded animate-pulse mb-6" />
            <div className="h-64 w-full bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : (
          <FirmAumTrendCard firms={firms} />
        )}
      </div>
    </div>
  );
}