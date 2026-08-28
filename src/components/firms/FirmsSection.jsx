import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronRight, Building, CheckSquare, Radar as RadarIcon, Download } from "lucide-react";
import FirmTypeSection from "./FirmTypeSection";
import FirmCard from "./FirmCard";
import FirmsBulkActionsBar from "./FirmsBulkActionsBar";
import { exportFirmsToCSV, exportFirmsToExcel } from "./firmListExport";
import ViewModeToggle from "@/components/common/ViewModeToggle";
import SectionSearch from "@/components/common/SectionSearch";
import SectionTypeFilter from "@/components/common/SectionTypeFilter";
import SectionExpandCollapse from "@/components/common/SectionExpandCollapse";
import DateRangeFilter from "@/components/common/DateRangeFilter";
import { useViewMode } from "@/hooks/useViewMode";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

export default function FirmsSection({
  groupedFirms,
  totalFirms,
  products,
  searchQuery,
  onEdit,
  onDelete,
  onAddToType,
  onAddFirm,
  onAddProduct,
  onEditProduct,
  onAddPortfolio,
  onOpenExportWizard,
  forceExpanded,
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useViewMode("firms");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [expandedTypes, setExpandedTypes] = useState({});

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const searchLower = search.toLowerCase().trim();

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  // Auto-expand all type sections when searching
  useEffect(() => {
    if (searchLower) {
      const allOpen = {};
      FIRM_TYPES.forEach((t) => { allOpen[t] = true; });
      setExpandedTypes(allOpen);
    }
  }, [searchLower]);
  const filteredGrouped = React.useMemo(() => {
    let result = groupedFirms;
    if (searchLower) {
      const searched = {};
      for (const [type, firms] of Object.entries(groupedFirms)) {
        const filtered = firms.filter((f) => f.name?.toLowerCase().includes(searchLower));
        if (filtered.length) searched[type] = filtered;
      }
      result = searched;
    }
    if (typeFilter !== "all") {
      const typed = {};
      if (result[typeFilter]) typed[typeFilter] = result[typeFilter];
      result = typed;
    }
    if (dateRange.start || dateRange.end) {
      const start = dateRange.start ? new Date(dateRange.start + "T00:00:00") : null;
      const end = dateRange.end ? new Date(dateRange.end + "T23:59:59") : null;
      const dated = {};
      for (const [type, firms] of Object.entries(result)) {
        const filtered = firms.filter((f) => {
          if (!f.created_date) return false;
          const d = new Date(f.created_date);
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        });
        if (filtered.length) dated[type] = filtered;
      }
      result = dated;
    }
    return result;
  }, [groupedFirms, searchLower, typeFilter, dateRange]);

  const allFirms = React.useMemo(
    () => FIRM_TYPES.flatMap((t) => filteredGrouped[t] || []).sort((a, b) => a.name.localeCompare(b.name)),
    [filteredGrouped]
  );

  const handleExpandAll = () => {
    const allOpen = {};
    FIRM_TYPES.forEach((t) => { allOpen[t] = true; });
    setExpandedTypes(allOpen);
  };

  const handleCollapseAll = () => {
    const allClosed = {};
    FIRM_TYPES.forEach((t) => { allClosed[t] = false; });
    setExpandedTypes(allClosed);
  };

  const toggleType = (type) =>
    setExpandedTypes((prev) => ({ ...prev, [type]: !prev[type] }));

  // ── Bulk selection handlers ──
  const toggleSelect = (firmId, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(firmId);
      else next.delete(firmId);
      return next;
    });
  };

  const toggleSelectMany = (ids, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const selectedCount = selectedIds.size;

  const handleBulkSetStatus = async (status) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy("status");
    try {
      await base44.entities.Firm.bulkUpdate(ids.map((id) => ({ id, funding_status: status })));
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      toast({
        title: "Funding status updated",
        description: `${ids.length} firm${ids.length !== 1 ? "s" : ""} set to "${status}".`,
      });
      clearSelection();
    } catch (err) {
      toast({ title: "Bulk update failed", description: err?.message, variant: "destructive" });
    } finally {
      setBulkBusy(null);
    }
  };

  const handleExportList = (format) => {
    setExportOpen(false);
    if (allFirms.length === 0) {
      toast({ title: "Nothing to export", description: "No firms match the current filters.", variant: "destructive" });
      return;
    }
    try {
      if (format === "csv") exportFirmsToCSV(allFirms);
      else exportFirmsToExcel(allFirms);
      toast({ title: "Export ready", description: `${allFirms.length} firm${allFirms.length !== 1 ? "s" : ""} exported as ${format.toUpperCase()}.` });
    } catch (err) {
      toast({ title: "Export failed", description: err?.message, variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} firm${ids.length !== 1 ? "s" : ""}? They will be moved to Deleted Records and can be restored.`)) return;
    setBulkBusy("delete");
    try {
      const nowIso = new Date().toISOString();
      await base44.entities.Firm.bulkUpdate(ids.map((id) => ({ id, deleted_at: nowIso })));
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      queryClient.invalidateQueries({ queryKey: ["deletedFirms"] });
      toast({
        title: "Firms deleted",
        description: `${ids.length} firm${ids.length !== 1 ? "s" : ""} moved to Deleted Records.`,
      });
      clearSelection();
    } catch (err) {
      toast({ title: "Bulk delete failed", description: err?.message, variant: "destructive" });
    } finally {
      setBulkBusy(null);
    }
  };

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 group"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          )}
          <Building className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Firms
          </span>
          <span className="text-xs text-gray-400 font-normal">({totalFirms})</span>
        </button>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={(m) => { setViewMode(m); setExpanded(true); }} />
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 gap-1 text-xs ${selectionMode ? "text-indigo-700 bg-indigo-50" : "text-gray-500 hover:text-indigo-700 hover:bg-indigo-50"}`}
            onClick={() => { setSelectionMode((v) => !v); if (selectionMode) setSelectedIds(new Set()); }}
            title={selectionMode ? "Exit selection mode" : "Select firms for bulk actions"}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Select
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1 text-xs"
              onClick={() => setExportOpen((v) => !v)}
              title="Download the filtered firm list as CSV or Excel"
            >
              <Download className="w-3.5 h-3.5" />
              Export List
            </Button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2"
                    onClick={() => handleExportList("csv")}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 border-t border-gray-100"
                    onClick={() => handleExportList("excel")}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Excel
                  </button>
                  <div className="px-3 py-1.5 text-[10px] text-gray-400 border-t border-gray-100">
                    {allFirms.length} firm{allFirms.length !== 1 ? "s" : ""} in current filter
                  </div>
                </div>
              </>
            )}
          </div>
          {onOpenExportWizard && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 text-xs"
              onClick={onOpenExportWizard}
              title="Export a firm's scoring history and radar chart"
            >
              <RadarIcon className="w-3.5 h-3.5" />
              Export Wizard
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-primary hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
            onClick={onAddFirm}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Firm
          </Button>
        </div>
      </div>

      {/* Bulk action bar — visible when firms are selected */}
      {selectionMode && (
        <FirmsBulkActionsBar
          selectedCount={selectedCount}
          onClear={clearSelection}
          onSetStatus={handleBulkSetStatus}
          onDelete={handleBulkDelete}
          busy={bulkBusy}
        />
      )}

      {/* Firm type sub-sections */}
      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100">
          <SectionSearch value={search} onChange={setSearch} placeholder="Search by firm name or type..." />
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <SectionTypeFilter
              label="Filter by type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={FIRM_TYPES}
            />
            <DateRangeFilter
              value={dateRange}
              onChange={setDateRange}
              label="Filter by date added"
            />
            {viewMode === "list" && (
              <SectionExpandCollapse onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} />
            )}
          </div>
          {viewMode === "list" && FIRM_TYPES.map((type) =>
            filteredGrouped[type] ? (
              <FirmTypeSection
                key={type}
                type={type}
                firms={filteredGrouped[type]}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddToType={onAddToType}
                onAddProduct={onAddProduct}
                onEditProduct={onEditProduct}
                onAddPortfolio={onAddPortfolio}
                forceExpand={!!searchQuery}
                isExpanded={expandedTypes[type]}
                onToggle={() => toggleType(type)}
                products={products}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectMany={toggleSelectMany}
              />
            ) : null
          )}

          {viewMode === "card" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 py-1">
              {allFirms.map((firm) => (
                <FirmCard
                  key={firm.id}
                  firm={firm}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddProduct={onAddProduct}
                  onEditProduct={onEditProduct}
                  onAddPortfolio={onAddPortfolio}
                  products={products}
                  forceExpand={false}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(firm.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          )}

          {viewMode === "kanban" && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {FIRM_TYPES.filter((t) => filteredGrouped[t]?.length).map((type) => (
                <div key={type} className="flex-shrink-0 w-72">
                  <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide truncate">{type}</span>
                    <span className="text-xs text-gray-400 ml-auto">{filteredGrouped[type].length}</span>
                  </div>
                  <div className="space-y-2">
                    {filteredGrouped[type].sort((a, b) => a.name.localeCompare(b.name)).map((firm) => (
                      <FirmCard
                        key={firm.id}
                        firm={firm}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onAddProduct={onAddProduct}
                        onEditProduct={onEditProduct}
                        onAddPortfolio={onAddPortfolio}
                        products={products}
                        forceExpand={false}
                        selectionMode={selectionMode}
                        selected={selectedIds.has(firm.id)}
                        onToggleSelect={toggleSelect}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {Object.keys(filteredGrouped).length === 0 && (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              {searchQuery ? "No firms found" : 'Click "Add Firm" to create your first firm'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}