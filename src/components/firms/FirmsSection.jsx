import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronRight, Building, CheckSquare, Radar as RadarIcon, Download, SlidersHorizontal } from "lucide-react";
import FirmTypeSection from "./FirmTypeSection";
import FirmCard from "./FirmCard";
import FirmsBulkActionsBar from "./FirmsBulkActionsBar";
import EntityFilterSidebar from "@/components/common/EntityFilterSidebar";
import { firmFilterGroups } from "./firmFilterGroups";
import { exportFirmsToCSV, exportFirmsToExcel } from "./firmListExport";
import BulkAssignXponanceContactDialog from "@/components/xponance/BulkAssignXponanceContactDialog";
import ViewModeToggle from "@/components/common/ViewModeToggle";
import SectionSearch from "@/components/common/SectionSearch";
import SectionExpandCollapse from "@/components/common/SectionExpandCollapse";
import DateRangeFilter from "@/components/common/DateRangeFilter";
import { useViewMode } from "@/hooks/useViewMode";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
  "Other",
];

export default function FirmsSection({
  groupedFirms,
  totalFirms,
  products,
  contacts = [],
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
  initialFirmTypeFilter,
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(!!initialFirmTypeFilter);
  const [viewMode, setViewMode] = useViewMode("firms");
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState({
    firm_type: initialFirmTypeFilter ? new Set([initialFirmTypeFilter]) : new Set(),
    allocator_type: new Set(),
    geographic_region: new Set(),
    geographic_region_search: "",
    recent_activity: "all",
    funding_status: new Set(),
    year_founded: new Set(),
    sourcing_source: new Set(),
    coverage_status: "all",
  });
  const [showFilters, setShowFilters] = useState(true);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [expandedTypes, setExpandedTypes] = useState({});
  const [allocatorTypeOptions, setAllocatorTypeOptions] = useState([]);

  // Fetch AllocatorType master list so the sub-filter shows all available types,
  // not just the ones already assigned to firms.
  useEffect(() => {
    let cancelled = false;
    base44.entities.AllocatorType.list()
      .then((rows) => { if (!cancelled) setAllocatorTypeOptions(rows.map((r) => r.name)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [showBulkXponance, setShowBulkXponance] = useState(false);
  const [bulkXponanceBusy, setBulkXponanceBusy] = useState(false);

  const searchLower = search.toLowerCase().trim();
  const locationSearchLower = (filterValues.geographic_region_search || "").toLowerCase().trim();

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

  // Auto-expand the type section when an initial filter is provided (deep-link)
  useEffect(() => {
    if (initialFirmTypeFilter) {
      setExpandedTypes((prev) => ({ ...prev, [initialFirmTypeFilter]: true }));
    }
  }, [initialFirmTypeFilter]);

  // Clear the allocator_type sub-filter when Allocator is deselected,
  // so stale sub-filter values don't silently exclude non-Allocator firms.
  useEffect(() => {
    if (!filterValues.firm_type.has("Allocator") && filterValues.allocator_type.size > 0) {
      setFilterValues((prev) => ({ ...prev, allocator_type: new Set() }));
    }
  }, [filterValues.firm_type]);

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
    if (filterValues.firm_type.size > 0) {
      const typed = {};
      for (const t of filterValues.firm_type) {
        if (result[t]) typed[t] = result[t];
      }
      result = typed;
    }
    if (filterValues.allocator_type.size > 0) {
      const atFiltered = {};
      for (const [type, firms] of Object.entries(result)) {
        const filtered = firms.filter((f) =>
          (f.allocator_types || []).some((at) => filterValues.allocator_type.has(at))
        );
        if (filtered.length) atFiltered[type] = filtered;
      }
      result = atFiltered;
    }
    if (filterValues.geographic_region.size > 0) {
      const regioned = {};
      for (const [type, firms] of Object.entries(result)) {
        const filtered = firms.filter((f) => filterValues.geographic_region.has(f.geographic_region || "Undefined"));
        if (filtered.length) regioned[type] = filtered;
      }
      result = regioned;
    }
    if (locationSearchLower) {
      const located = {};
      for (const [type, firms] of Object.entries(result)) {
        const filtered = firms.filter((f) => (f.location || "").toLowerCase().includes(locationSearchLower));
        if (filtered.length) located[type] = filtered;
      }
      result = located;
    }
    if (filterValues.recent_activity !== "all") {
      const now = new Date();
      const active = {};
      for (const [type, firms] of Object.entries(result)) {
        const filtered = firms.filter((f) => {
          const updated = f.updated_date ? new Date(f.updated_date) : f.created_date ? new Date(f.created_date) : null;
          if (!updated) return filterValues.recent_activity === "stale";
          const daysSince = Math.floor((now - updated) / 86400000);
          if (filterValues.recent_activity === "30") return daysSince <= 30;
          if (filterValues.recent_activity === "90") return daysSince > 30 && daysSince <= 90;
          if (filterValues.recent_activity === "stale") return daysSince > 90;
          return true;
        });
        if (filtered.length) active[type] = filtered;
      }
      result = active;
    }
    if (filterValues.funding_status.size > 0) {
      const funded = {};
      for (const [type, firms] of Object.entries(result)) {
        const filtered = firms.filter((f) => filterValues.funding_status.has(f.funding_status || ""));
        if (filtered.length) funded[type] = filtered;
      }
      result = funded;
    }
    if (filterValues.year_founded.size > 0) {
      const yf = {};
      for (const [type, firms] of Object.entries(result)) {
        const filtered = firms.filter((f) => {
          const y = f.year_founded;
          if (!y) return filterValues.year_founded.has("before_2000");
          if (y < 2000) return filterValues.year_founded.has("before_2000");
          if (y < 2010) return filterValues.year_founded.has("2000s");
          if (y < 2020) return filterValues.year_founded.has("2010s");
          return filterValues.year_founded.has("2020s");
        });
        if (filtered.length) yf[type] = filtered;
      }
      result = yf;
    }
    if (filterValues.sourcing_source.size > 0) {
      const sourced = {};
      for (const [type, firms] of Object.entries(result)) {
        const filtered = firms.filter((f) => {
          const sources = f.sourcing_sources || [];
          return sources.some((s) => filterValues.sourcing_source.has(s));
        });
        if (filtered.length) sourced[type] = filtered;
      }
      result = sourced;
    }
    if (filterValues.coverage_status !== "all") {
      const coverageFiltered = {};
      for (const [type, firms] of Object.entries(result)) {
        const filtered = firms.filter((f) => {
          const hasCoverage = !!(f.primary_xponance_contact_id || f.secondary_xponance_contact_id);
          return filterValues.coverage_status === "covered" ? hasCoverage : !hasCoverage;
        });
        if (filtered.length) coverageFiltered[type] = filtered;
      }
      result = coverageFiltered;
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
  }, [groupedFirms, searchLower, filterValues, locationSearchLower, dateRange]);

  const allFirms = React.useMemo(
    () => FIRM_TYPES.flatMap((t) => filteredGrouped[t] || []).sort((a, b) => a.name.localeCompare(b.name)),
    [filteredGrouped]
  );

  const filterCounts = React.useMemo(() => {
    const types = {};
    const regions = {};
    const fundingStatus = {};
    const yearFounded = {};
    const sourcingSource = {};
    for (const [type, firms] of Object.entries(groupedFirms)) {
      types[type] = firms.length;
      for (const f of firms) {
        const r = f.geographic_region || "Undefined";
        regions[r] = (regions[r] || 0) + 1;
        if (f.funding_status) fundingStatus[f.funding_status] = (fundingStatus[f.funding_status] || 0) + 1;
        const y = f.year_founded;
        let yk;
        if (!y || y < 2000) yk = "before_2000";
        else if (y < 2010) yk = "2000s";
        else if (y < 2020) yk = "2010s";
        else yk = "2020s";
        yearFounded[yk] = (yearFounded[yk] || 0) + 1;
        for (const s of f.sourcing_sources || []) {
          sourcingSource[s] = (sourcingSource[s] || 0) + 1;
        }
      }
    }
    const coverageStatus = { covered: 0, uncovered: 0 };
    for (const [, firms] of Object.entries(groupedFirms)) {
      for (const f of firms) {
        const hasCoverage = !!(f.primary_xponance_contact_id || f.secondary_xponance_contact_id);
        coverageStatus[hasCoverage ? "covered" : "uncovered"]++;
      }
    }
    const allocatorTypes = {};
    // Seed from the master list so every known allocator type appears (count 0 if unassigned)
    for (const name of allocatorTypeOptions) allocatorTypes[name] = 0;
    for (const f of groupedFirms["Allocator"] || []) {
      for (const at of f.allocator_types || []) {
        allocatorTypes[at] = (allocatorTypes[at] || 0) + 1;
      }
    }
    return {
      firm_type: types,
      allocator_type: allocatorTypes,
      geographic_region: regions,
      funding_status: fundingStatus,
      year_founded: yearFounded,
      sourcing_source: sourcingSource,
      coverage_status: coverageStatus,
    };
  }, [groupedFirms, allocatorTypeOptions]);

  const handleFilterChange = (key, value) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilterValues({
      firm_type: new Set(),
      allocator_type: new Set(),
      geographic_region: new Set(),
      geographic_region_search: "",
      recent_activity: "all",
      funding_status: new Set(),
      year_founded: new Set(),
      sourcing_source: new Set(),
      coverage_status: "all",
    });
  };

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

  const handleBulkMoveType = async (type) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Move ${ids.length} firm${ids.length !== 1 ? "s" : ""} to "${type}"? This replaces their current firm type assignment(s).`)) return;
    setBulkBusy("type");
    try {
      await base44.entities.Firm.bulkUpdate(ids.map((id) => ({ id, firm_types: [type], firm_type: type })));
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      toast({
        title: "Firms moved",
        description: `${ids.length} firm${ids.length !== 1 ? "s" : ""} moved to "${type}".`,
      });
      clearSelection();
    } catch (err) {
      toast({ title: "Bulk move failed", description: err?.message, variant: "destructive" });
    } finally {
      setBulkBusy(null);
    }
  };

  const handleBulkSetRegion = async (region) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy("region");
    try {
      await base44.entities.Firm.bulkUpdate(ids.map((id) => ({ id, geographic_region: region })));
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      toast({
        title: "Region updated",
        description: `${ids.length} firm${ids.length !== 1 ? "s" : ""} set to "${region}".`,
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

  const handleBulkAssignXponance = async ({ contact_id, contact_name, role }) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkXponanceBusy(true);
    setBulkBusy("xponance");
    try {
      const idField = role === "primary" ? "primary_xponance_contact_id" : "secondary_xponance_contact_id";
      const nameField = role === "primary" ? "primary_xponance_contact_name" : "secondary_xponance_contact_name";
      await base44.entities.Firm.bulkUpdate(ids.map((id) => ({ id, [idField]: contact_id, [nameField]: contact_name })));
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      toast({
        title: "Xponance contact assigned",
        description: `${contact_name} set as ${role} for ${ids.length} firm${ids.length !== 1 ? "s" : ""}.`,
      });
      setShowBulkXponance(false);
      clearSelection();
    } catch (err) {
      toast({ title: "Bulk assign failed", description: err?.message, variant: "destructive" });
    } finally {
      setBulkXponanceBusy(false);
      setBulkBusy(null);
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
          onMoveType={handleBulkMoveType}
          onSetStatus={handleBulkSetStatus}
          onSetRegion={handleBulkSetRegion}
          onAssignXponance={() => setShowBulkXponance(true)}
          onDelete={handleBulkDelete}
          busy={bulkBusy}
        />
      )}

      <BulkAssignXponanceContactDialog
        open={showBulkXponance}
        onOpenChange={setShowBulkXponance}
        entityType="Firm"
        entityLabel="firms"
        selectedCount={selectedCount}
        onAssign={handleBulkAssignXponance}
        busy={bulkXponanceBusy}
      />

      {/* Firm type sub-sections */}
      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100">
          <SectionSearch value={search} onChange={setSearch} placeholder="Search by firm name or type..." />

          {/* Quick firm-type filter bar */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <button
              type="button"
              onClick={() => handleFilterChange("firm_type", new Set())}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
                filterValues.firm_type.size === 0
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              All ({totalFirms})
            </button>
            {FIRM_TYPES.map((type) => {
              const count = filterCounts.firm_type[type] || 0;
              if (count === 0) return null;
              const active = filterValues.firm_type.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    const next = new Set(filterValues.firm_type);
                    if (next.has(type)) next.delete(type);
                    else next.add(type);
                    handleFilterChange("firm_type", next);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {type} ({count})
                </button>
              );
            })}
          </div>

          {/* Allocator sub-type filter pills — drill-down shown only when Allocator is selected */}
          {filterValues.firm_type.has("Allocator") && filteredGrouped["Allocator"] && (
            <div className="flex items-center gap-1.5 flex-wrap mb-2 pl-1">
              <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mr-0.5">Allocator Type:</span>
              <button
                type="button"
                onClick={() => handleFilterChange("allocator_type", new Set())}
                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors border ${
                  filterValues.allocator_type.size === 0
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}
              >
                All ({(groupedFirms["Allocator"] || []).length})
              </button>
              {Object.entries(filterCounts.allocator_type)
                .sort((a, b) => b[1] - a[1])
                .map(([at, count]) => {
                  const active = filterValues.allocator_type.has(at);
                  return (
                    <button
                      key={at}
                      type="button"
                      onClick={() => {
                        const next = new Set(filterValues.allocator_type);
                        if (next.has(at)) next.delete(at);
                        else next.add(at);
                        handleFilterChange("allocator_type", next);
                      }}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors border ${
                        active
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {at} ({count})
                    </button>
                  );
                })}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-3">
            {showFilters && (
              <div className="w-full md:w-56 flex-shrink-0">
                <EntityFilterSidebar
                  sectionKey="firms"
                  groups={firmFilterGroups}
                  values={filterValues}
                  onChange={handleFilterChange}
                  counts={filterCounts}
                  onClearAll={clearAllFilters}
                  hasActiveFilters={
                    filterValues.firm_type.size > 0 ||
                    filterValues.allocator_type.size > 0 ||
                    filterValues.geographic_region.size > 0 ||
                    filterValues.recent_activity !== "all" ||
                    locationSearchLower ||
                    filterValues.funding_status.size > 0 ||
                    filterValues.year_founded.size > 0 ||
                    filterValues.sourcing_source.size > 0 ||
                    filterValues.coverage_status !== "all"
                  }
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 gap-1 text-xs ${showFilters ? "text-indigo-700 bg-indigo-50" : "text-gray-500 hover:text-indigo-700 hover:bg-indigo-50"}`}
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {showFilters ? "Hide Filters" : "Filters"}
                </Button>
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
                      contacts={contacts}
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
                            contacts={contacts}
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
          </div>
        </div>
      )}
    </div>
  );
}