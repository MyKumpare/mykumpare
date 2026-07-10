import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";
import { STANDARD_REPORTS } from "./reportConfig";

export default function StandardReportsList({ open, onClose, onUse }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Standard Reports
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-1 mb-3">
          Select a pre-built template. You can customize it further before saving.
        </p>
        <div className="space-y-2">
          {STANDARD_REPORTS.map((report) => (
            <div
              key={report.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{report.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{report.description}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {report.config.data_source}
                  </span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {report.config.format_type}
                  </span>
                  {report.config.computations?.length > 0 && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {report.config.computations.length} computation{report.config.computations.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onUse(report.config)} className="flex-shrink-0 mt-0.5">
                Use <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}