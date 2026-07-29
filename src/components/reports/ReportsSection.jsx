import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, FileText, LayoutGrid, Plus, Pencil, Trash2, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ViewModeToggle from "@/components/common/ViewModeToggle";
import SectionSearch from "@/components/common/SectionSearch";
import { useViewMode } from "@/hooks/useViewMode";
import CustomReportBuilder from "./CustomReportBuilder";
import StandardReportsList from "./StandardReportsList";

export default function ReportsSection({ forceExpanded = false }) {
  const [expanded, setExpanded] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [standardOpen, setStandardOpen] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [prefillConfig, setPrefillConfig] = useState(null);
  const [viewMode, setViewMode] = useViewMode("reports");
  const [search, setSearch] = useState("");

  const queryClient = useQueryClient();
  const isOpen = forceExpanded || expanded;

  const { data: savedReports = [] } = useQuery({
    queryKey: ["custom_reports"],
    queryFn: () => base44.entities.CustomReport.list("-created_date"),
  });

  const searchLower = search.toLowerCase().trim();
  const filteredReports = useMemo(() => {
    if (!searchLower) return savedReports;
    return savedReports.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const source = (r.data_source || "").toLowerCase();
      return name.includes(searchLower) || source.includes(searchLower);
    });
  }, [savedReports, searchLower]);

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

  const handleDelete = (report) => {
    if (window.confirm(`Delete "${report.name}"?`)) {
      deleteMutation.mutate(report.id);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 group"
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          )}
          <FileText className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Reports</span>
          {filteredReports.length > 0 && (
            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {filteredReports.length}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={(m) => { setViewMode(m); setExpanded(true); }} />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1 text-xs"
            onClick={handleOpenBuilder}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Report
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-4">
          <SectionSearch value={search} onChange={setSearch} placeholder="Search reports..." />
          {/* Two action cards */}
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {/* Saved custom reports */}
          {filteredReports.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Saved Custom Reports</p>
              {viewMode === "kanban" ? (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {["table", "chart", "mixed"].map((fmt) => {
                    const items = filteredReports.filter((r) => (r.format_type || "table") === fmt);
                    if (items.length === 0) return null;
                    return (
                      <div key={fmt} className="flex-shrink-0 w-64">
                        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{fmt}</span>
                          <span className="text-xs text-gray-400 ml-auto">{items.length}</span>
                        </div>
                        <div className="space-y-2">
                          {items.map((report) => (
                            <div
                              key={report.id}
                              className="px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors group"
                            >
                              <FileBarChart className="w-4 h-4 text-blue-400 mb-1" />
                              <p className="text-sm font-medium text-gray-800 truncate">{report.name}</p>
                              <p className="text-[11px] text-gray-400 truncate">{report.data_source}</p>
                              <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditReport(report)} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600" title="Edit"><Pencil className="w-3 h-3" /></button>
                                <button onClick={() => handleDelete(report)} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500" title="Delete"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === "card" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex flex-col gap-2 p-3 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <FileBarChart className="w-5 h-5 text-blue-400" />
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditReport(report)} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(report)} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">{report.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{report.data_source} · {report.format_type}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors group"
                    >
                      <FileBarChart className="w-4 h-4 text-blue-400 flex-shrink-0" />
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
          )}
        </div>
      )}

      <StandardReportsList open={standardOpen} onClose={() => setStandardOpen(false)} onUse={handleUseStandard} />

      <CustomReportBuilder
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditingReport(null); setPrefillConfig(null); }}
        editingReport={editingReport}
        prefillConfig={prefillConfig}
      />
    </div>
  );
}