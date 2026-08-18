import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, LayoutGrid, Plus, Pencil, Trash2, FileBarChart, GitCompare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CustomReportBuilder from "./CustomReportBuilder";
import StandardReportsList from "./StandardReportsList";
import { STANDARD_REPORTS } from "./reportConfig";

export default function ReportsPickerModal({ open, onClose }) {
  const navigate = useNavigate();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [standardOpen, setStandardOpen] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [prefillConfig, setPrefillConfig] = useState(null);

  const handleOpenCompare = () => {
    onClose();
    navigate("/FirmComparison");
  };

  const queryClient = useQueryClient();

  const { data: savedReports = [] } = useQuery({
    queryKey: ["custom_reports"],
    queryFn: () => base44.entities.CustomReport.list("-created_date"),
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomReport.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom_reports"] }),
  });

  const handleOpenBuilder = () => {
    setEditingReport(null);
    setPrefillConfig(null);
    setBuilderOpen(true);
  };

  const handleEditReport = (report) => {
    setEditingReport(report);
    setPrefillConfig(null);
    setBuilderOpen(true);
  };

  const handleUseStandard = (config) => {
    setEditingReport(null);
    setPrefillConfig(config);
    setStandardOpen(false);
    setBuilderOpen(true);
  };

  const handleUseExistingStandard = (report) => {
    setEditingReport(null);
    setPrefillConfig(report.config);
    setBuilderOpen(true);
  };

  const handleDelete = (report) => {
    if (window.confirm(`Delete "${report.name}"?`)) {
      deleteMutation.mutate(report.id);
    }
  };

  return (
    <>
      <Dialog open={open && !builderOpen && !standardOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Reports
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Two action cards */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setStandardOpen(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-blue-100 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-center"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-semibold text-gray-800">Standard Reports</span>
                <span className="text-[11px] text-gray-400 leading-tight">Pre-built report templates</span>
              </button>

              <button
                onClick={handleOpenBuilder}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-violet-100 bg-white hover:border-violet-300 hover:bg-violet-50/50 transition-colors text-center"
              >
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-violet-600" />
                </div>
                <span className="text-sm font-semibold text-gray-800">Create Custom Report</span>
                <span className="text-[11px] text-gray-400 leading-tight">Define your own fields & layout</span>
              </button>

              <button
                onClick={handleOpenCompare}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-fuchsia-100 bg-white hover:border-fuchsia-300 hover:bg-fuchsia-50/50 transition-colors text-center"
              >
                <div className="w-10 h-10 rounded-lg bg-fuchsia-100 flex items-center justify-center">
                  <GitCompare className="w-5 h-5 text-fuchsia-600" />
                </div>
                <span className="text-sm font-semibold text-gray-800">Compare Firms</span>
                <span className="text-[11px] text-gray-400 leading-tight">Side-by-side AUM & products</span>
              </button>
            </div>

            {/* Standard reports list */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Standard Report Templates</p>
              <div className="space-y-1.5">
                {STANDARD_REPORTS.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors group"
                  >
                    <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{report.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{report.description}</p>
                    </div>
                    <button
                      onClick={() => handleUseExistingStandard(report)}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                    >
                      Use
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved custom reports */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Saved Custom Reports</p>
                {savedReports.length > 0 && (
                  <span className="text-[10px] text-gray-400">{savedReports.length} saved</span>
                )}
              </div>
              {savedReports.length === 0 ? (
                <div className="text-center py-4 rounded-lg border border-dashed border-gray-200">
                  <FileBarChart className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">No custom reports yet</p>
                  <button onClick={handleOpenBuilder} className="text-[11px] text-violet-600 hover:text-violet-700 mt-1 font-medium">
                    Create your first report
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {savedReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors group"
                    >
                      <FileBarChart className="w-4 h-4 text-violet-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{report.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {report.data_source} · {report.format_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditReport(report)}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(report)}
                          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <StandardReportsList open={standardOpen} onClose={() => setStandardOpen(false)} onUse={handleUseStandard} />

      <CustomReportBuilder
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditingReport(null); setPrefillConfig(null); }}
        editingReport={editingReport}
        prefillConfig={prefillConfig}
      />
    </>
  );
}