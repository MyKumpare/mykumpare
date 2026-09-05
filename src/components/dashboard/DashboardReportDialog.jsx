import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FirmCategoryBarChart from "@/components/dashboard/FirmCategoryBarChart";
import DatabaseGrowthChart from "@/components/dashboard/DatabaseGrowthChart";
import RecentlyAddedFirms from "@/components/dashboard/RecentlyAddedFirms";

const REPORT_META = {
  "firm-category": { title: "Firms by Category" },
  "database-growth": { title: "Database Growth" },
  "recently-added-firms": { title: "Recently Added Firms" },
};

/**
 * Dialog that opens when a dashboard chart/report module card is clicked.
 * Renders the appropriate chart or widget based on the report key.
 */
export default function DashboardReportDialog({ reportKey, firms, onClickCategory, onClose }) {
  const open = !!reportKey;
  const meta = reportKey ? REPORT_META[reportKey] : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meta?.title || "Report"}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {reportKey === "firm-category" && (
            <FirmCategoryBarChart firms={firms} onClickCategory={onClickCategory} />
          )}
          {reportKey === "database-growth" && (
            <DatabaseGrowthChart firms={firms} />
          )}
          {reportKey === "recently-added-firms" && (
            <RecentlyAddedFirms firms={firms} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}