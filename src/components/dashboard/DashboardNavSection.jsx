import React from "react";
import { LayoutDashboard } from "lucide-react";

/**
 * Dashboard navigation section.
 * Renders a simple Dashboard row at the top of the vertical sidebar that
 * navigates to the Overview dashboard page.
 */
export default function DashboardNavSection({ onOpenDashboard }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-1 px-1">
        <button onClick={onOpenDashboard} className="flex items-center gap-2 group">
          <LayoutDashboard className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Dashboard</span>
        </button>
      </div>
    </div>
  );
}