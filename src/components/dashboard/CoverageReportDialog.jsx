import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

// Printable summary report of team coverage: for each firm, the primary and
// secondary analysts currently assigned (from active DueDiligence analyst
// history). Uses the app's .pdf-block print CSS so only the report prints.
const STATUS_LABEL = {
  unassigned: "Unassigned",
  no_primary: "No Primary",
  covered: "Covered",
};
const STATUS_COLOR = {
  unassigned: "text-red-600",
  no_primary: "text-amber-600",
  covered: "text-emerald-600",
};

export default function CoverageReportDialog({ open, onClose, firms = [] }) {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const counts = {
    covered: firms.filter((f) => f.status === "covered").length,
    no_primary: firms.filter((f) => f.status === "no_primary").length,
    unassigned: firms.filter((f) => f.status === "unassigned").length,
  };

  const analystSet = new Set();
  for (const f of firms) {
    f.primaryNames.forEach((n) => analystSet.add(n));
    f.secondaryNames.forEach((n) => analystSet.add(n));
  }

  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle>Team Coverage Report</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end mb-3 print:hidden">
          <Button onClick={handlePrint} size="sm">
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </Button>
        </div>

        <div className="pdf-block">
          <div className="mb-4">
            <h1 className="text-lg font-bold text-gray-900">Team Coverage Report</h1>
            <p className="text-xs text-gray-500">Generated {today}</p>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4 text-center text-xs">
            <div className="border border-gray-300 rounded p-2">
              <div className="text-gray-500">Total Firms</div>
              <div className="text-base font-bold text-gray-800">{firms.length}</div>
            </div>
            <div className="border border-gray-300 rounded p-2">
              <div className="text-emerald-600">Covered</div>
              <div className="text-base font-bold text-emerald-700">{counts.covered}</div>
            </div>
            <div className="border border-gray-300 rounded p-2">
              <div className="text-amber-600">No Primary</div>
              <div className="text-base font-bold text-amber-700">{counts.no_primary}</div>
            </div>
            <div className="border border-gray-300 rounded p-2">
              <div className="text-red-600">Unassigned</div>
              <div className="text-base font-bold text-red-700">{counts.unassigned}</div>
            </div>
          </div>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-400">
                <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Firm</th>
                <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Primary Analyst(s)</th>
                <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Secondary Analyst(s)</th>
                <th className="text-center py-1.5 px-2 font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {firms.map((f) => (
                <tr key={f.firm_id} className="border-b border-gray-300">
                  <td className="py-1.5 px-2 font-medium text-gray-800">{f.firm_name}</td>
                  <td className="py-1.5 px-2 text-gray-700">{f.primaryNames.join(", ") || "—"}</td>
                  <td className="py-1.5 px-2 text-gray-700">{f.secondaryNames.join(", ") || "—"}</td>
                  <td className={`py-1.5 px-2 text-center font-medium ${STATUS_COLOR[f.status]}`}>
                    {f.status !== "covered" ? "⚠ " : ""}
                    {STATUS_LABEL[f.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[10px] text-gray-500 mt-3">
            {analystSet.size} unique analysts across {firms.length} firms. Firms missing a primary
            analyst or with no analysts are flagged above.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}