import React from "react";
import AnalyticsSection from "@/components/analytics/AnalyticsSection";
import InvitationStatsSection from "@/components/analytics/InvitationStatsSection";
import NewsContentTagDeepDive from "@/components/analytics/NewsContentTagDeepDive";

export default function Analytics() {
  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <InvitationStatsSection />
        <AnalyticsSection />
        <NewsContentTagDeepDive />
      </div>
    </div>
  );
}