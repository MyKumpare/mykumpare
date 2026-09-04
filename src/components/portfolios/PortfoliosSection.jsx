import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, LayoutList, ChevronDown, ChevronRight, BarChart3, SlidersHorizontal, AlertTriangle, DollarSign, RefreshCw, CheckSquare, Check, X, Loader2, UserCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import ViewModeToggle from "@/components/common/ViewModeToggle";
import SectionSearch from "@/components/common/SectionSearch";
import SectionTypeFilter from "@/components/common/SectionTypeFilter";
import SectionExpandCollapse from "@/components/common/SectionExpandCollapse";
import { useViewMode } from "@/hooks/useViewMode";
import EntityFilterSidebar from "@/components/common/EntityFilterSidebar";
import { portfolioFilterGroups } from "./portfolioFilterGroups";
import { reconcilePortfolioAllocationHistory, hasOutstandingReconciliation } from "./reconcileAllocations";
import { useToast } from "@/components/ui/use-toast";
import BulkAssignXponanceContactDialog from "@/components/xponance/BulkAssignXponanceContactDialog";

const ADVISOR_TYPES = ["Investment Manager"];

export default function PortfoliosSection({ portfolios, onPortfolioClick, onAddPortfolio, forceExpanded }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reconcilingAll, setReconcilingAll] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkXponanceOpen, setBulkXponanceOpen] = useState(false);
  const [bulkXponanceBusy, setBulkXponanceBusy] = useState(false);

  const toggleSelectMode = () => {
    setSelectMode((v) => {
      if (v) setSelectedIds(new Set());
      return !v;
    });
  };
  const toggleSelectPortfolio = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false); };

  const handleBulkAssignXponance = async ({ contact_id, contact_name, role }) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkXponanceBusy(true);
    try {
      const idField = role === "primary" ? "primary_xponance_contact_id" : "secondary_xponance_contact_id";
      const nameField = role === "primary" ? "primary_xponance_contact_name" : "secondary_xponance_contact_name";
      await base44.entities.Portfolio.bulkUpdate(ids.map((id) => ({ id, [idField]: contact_id, [nameField]: contact_name })));
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolios-all"] });
      toast({ title: `✅ ${contact_name} assigned as ${role} for ${ids.length} portfolio${ids.length === 1 ? "" : "s"}` });
      setBulkXponanceOpen(false);
      clearSelection();
    } catch (err) {
      toast({ title: "Bulk assign failed", description: err?.message, variant: "destructive" });
    } finally {
      setBulkXponanceBusy(false);
    }
  };
  const [expanded, setExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedAdvisorTypes, setExpandedAdvisorTypes] = useState({});
  const [viewMode, setViewMode] = useViewMode("portfolios");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [allocatorFilter, setAllocatorFilter] = useState("all");
  const [benchmarkFilter, setBenchmarkFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(true);
  const [filterValues, setFilterValues] = useState({
    advisor_type: new Set(),
    allocator_name: new Set(),
    primary_benchmark_name: new Set(),
    advisor_firm_name: new Set(),
    portfolio_name_search: "",
  });
  const handleFilterChange = (key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }));
  const clearAllFilters = () => setFilterValues({
    advisor_type: new Set(), allocator_name: new Set(), primary_benchmark_name: new Set(),
    advisor_firm_name: new Set(), portfolio_name_search: "",
  });
  const hasActiveSidebarFilters =
    filterValues.advisor_type.size > 0 || filterValues.allocator_name.size > 0 ||
    filterValues.primary_benchmark_name.size > 0 || filterValues.advisor_firm_name.size > 0 ||
    (filterValues.portfolio_name_search || "").trim();

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  // Fetch firms to get allocator AUM (the limit against which committed capital is compared)
  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });

  // Helper: get latest firm AUM from aum_history
  const getLatestAum = useMemo(() => (firm) => {
    const history = firm?.aum_history || [];
    if (!history.length) return 0;
    const latest = [...history].sort(
      (a, b) => (b.month_end_date || "").localeCompare(a.month_end_date || "")
    )[0];
    return Number(latest?.firm_aum) || 0;
  }, []);

  // Per-allocator exposure: total committed capital across all portfolios vs. the
  // allocator firm's latest AUM. When total committed exceeds the firm's AUM, the
  // allocator is over-allocated and the discrepancy is highlighted.
  const allocatorExposure = useMemo(() => {
    const map = {};
    for (const p of portfolios) {
      if (p.deleted_at) continue;
      const name = p.allocator_name || "Unknown";
      const amount = Number(p.initial_allocation_amount) || 0;
      if (!map[name]) map[name] = { totalAllocated: 0, firmId: null };
      map[name].totalAllocated += amount;
      map[name].firmId = p.firm_id || map[name].firmId;
    }
    const firmMap = new Map(firms.map((f) => [f.id, f]));
    for (const [name, info] of Object.entries(map)) {
      const firm = firmMap.get(info.firmId);
      info.firmAum = firm ? getLatestAum(firm) : 0;
      info.overAllocated = info.firmAum > 0 && info.totalAllocated > info.firmAum;
      info.discrepancy = info.overAllocated ? info.totalAllocated - info.firmAum : 0;
    }
    return map;
  }, [portfolios, firms, getLatestAum]);

  const formatCompactCurrency = (n) => {
    if (n == null || isNaN(n)) return "$0";
    const abs = Math.abs(n);
    if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${Math.round(n).toLocaleString()}`;
  };

  // Portfolios with outstanding (un-cascaded) allocation records — legacy
  // records that need reconciliation so cash flows cascade through the IM.
  const portfoliosToReconcile = useMemo(
    () => portfolios.filter((p) => !p.deleted_at && hasOutstandingReconciliation(p)),
    [portfolios]
  );

  // Bulk reconcile: cascade all un-cascaded portfolio-level records across
  // every portfolio that has an advisor, in one click.
  const handleReconcileAll = async () => {
    if (portfoliosToReconcile.length === 0) return;
    setReconcilingAll(true);
    let successCount = 0;
    let totalRecords = 0;
    try {
      for (const p of portfoliosToReconcile) {
        const result = reconcilePortfolioAllocationHistory(p);
        if (!result || result.reconciledCount === 0) continue;
        await base44.entities.Portfolio.update(p.id, {
          allocation_history: result.newData,
        });
        successCount++;
        totalRecords += result.reconciledCount;
      }
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolios-all"] });
      toast({
        title: `Reconciled ${totalRecords} record${totalRecords !== 1 ? "s" : ""} across ${successCount} portfolio${successCount !== 1 ? "s" : ""}`,
      });
    } catch (err) {
      toast({ title: "Reconciliation failed for some portfolios", variant: "destructive" });
    } finally {
      setReconcilingAll(false);
    }
  };

  // Derive unique filter options from the loaded portfolios
  const allocatorOptions = useMemo(
    () => Array.from(new Set(portfolios.map((p) => p.allocator_name).filter(Boolean))).sort(),
    [portfolios]
  );
  const benchmarkOptions = useMemo(
    () => Array.from(new Set(portfolios.map((p) => p.primary_benchmark_name).filter(Boolean))).sort(),
    [portfolios]
  );
  const managerOptions = useMemo(
    () => Array.from(new Set(portfolios.map((p) => p.advisor_firm_name).filter(Boolean))).sort(),
    [portfolios]
  );

  const dynamicFilterGroups = useMemo(
    () => portfolioFilterGroups.map((g) => {
      if (g.key === "allocator_name") return { ...g, options: allocatorOptions.map((v) => ({ value: v, label: v })) };
      if (g.key === "primary_benchmark_name") return { ...g, options: benchmarkOptions.map((v) => ({ value: v, label: v })) };
      if (g.key === "advisor_firm_name") return { ...g, options: managerOptions.map((v) => ({ value: v, label: v })) };
      return g;
    }),
    [allocatorOptions, benchmarkOptions, managerOptions]
  );

  const filterCounts = useMemo(() => {
    const advisorType = {}, allocatorName = {}, benchmarkName = {}, firmName = {};
    for (const p of portfolios) {
      if (p.deleted_at) continue;
      const at = p.advisor_type || "No Advisor";
      advisorType[at] = (advisorType[at] || 0) + 1;
      const an = p.allocator_name || "Unknown";
      allocatorName[an] = (allocatorName[an] || 0) + 1;
      if (p.primary_benchmark_name) benchmarkName[p.primary_benchmark_name] = (benchmarkName[p.primary_benchmark_name] || 0) + 1;
      const fn = p.advisor_firm_name || "Unknown";
      firmName[fn] = (firmName[fn] || 0) + 1;
    }
    return { advisor_type: advisorType, allocator_name: allocatorName, primary_benchmark_name: benchmarkName, advisor_firm_name: firmName };
  }, [portfolios]);

  const searchLower = search.toLowerCase().trim();
  const filteredPortfolios = useMemo(() => {
    let result = portfolios;
    if (searchLower) {
      result = result.filter((p) => {
        const name = (p.portfolio_name || "").toLowerCase();
        const advisor = (p.advisor_firm_name || "").toLowerCase();
        const allocator = (p.allocator_name || "").toLowerCase();
        return name.includes(searchLower) || advisor.includes(searchLower) || allocator.includes(searchLower);
      });
    }
    if (typeFilter !== "all") {
      result = result.filter((p) => (p.advisor_type || "No Advisor") === typeFilter);
    }
    if (allocatorFilter !== "all") {
      result = result.filter((p) => (p.allocator_name || "Unknown") === allocatorFilter);
    }
    if (benchmarkFilter !== "all") {
      result = result.filter((p) => (p.primary_benchmark_name || "") === benchmarkFilter);
    }
    if (managerFilter !== "all") {
      result = result.filter((p) => (p.advisor_firm_name || "Unknown") === managerFilter);
    }
    if (filterValues.advisor_type.size > 0)
      result = result.filter((p) => filterValues.advisor_type.has(p.advisor_type || "No Advisor"));
    if (filterValues.allocator_name.size > 0)
      result = result.filter((p) => filterValues.allocator_name.has(p.allocator_name || "Unknown"));
    if (filterValues.primary_benchmark_name.size > 0)
      result = result.filter((p) => filterValues.primary_benchmark_name.has(p.primary_benchmark_name || ""));
    if (filterValues.advisor_firm_name.size > 0)
      result = result.filter((p) => filterValues.advisor_firm_name.has(p.advisor_firm_name || "Unknown"));
    if ((filterValues.portfolio_name_search || "").trim()) {
      const q = filterValues.portfolio_name_search.toLowerCase().trim();
      result = result.filter((p) => (p.portfolio_name || "").toLowerCase().includes(q));
    }
    return result;
  }, [portfolios, searchLower, typeFilter, allocatorFilter, benchmarkFilter, managerFilter, filterValues]);

  // Group portfolios by advisor type → allocator → portfolio name
  const grouped = useMemo(() => {
    const groups = {};

    filteredPortfolios.forEach((p) => {
      const advisorType = p.advisor_type || "No Advisor";
      const allocator = p.allocator_name || "Unknown";

      if (!groups[advisorType]) groups[advisorType] = {};
      if (!groups[advisorType][allocator]) groups[advisorType][allocator] = [];
      groups[advisorType][allocator].push(p);
    });

    // Sort each level: advisor type, then allocator, then portfolios
    const sorted = {};
    Object.keys(groups)
      .sort()
      .forEach((advisorType) => {
        sorted[advisorType] = {};
        Object.keys(groups[advisorType])
          .sort()
          .forEach((allocator) => {
            sorted[advisorType][allocator] = groups[advisorType][allocator].sort((a, b) =>
              (a.portfolio_name || "").localeCompare(b.portfolio_name || "")
            );
          });
      });

    return sorted;
  }, [filteredPortfolios]);

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAdvisorType = (advisorType) => {
    setExpandedAdvisorTypes((prev) => ({ ...prev, [advisorType]: !prev[advisorType] }));
  };

  const handleExpandAll = () => {
    const advisorOpen = {};
    const groupOpen = {};
    Object.keys(grouped).forEach((at) => {
      advisorOpen[at] = true;
      Object.keys(grouped[at]).forEach((alloc) => { groupOpen[`${at}/${alloc}`] = true; });
    });
    setExpandedAdvisorTypes(advisorOpen);
    setExpandedGroups(groupOpen);
  };

  const handleCollapseAll = () => {
    const advisorOpen = {};
    const groupOpen = {};
    Object.keys(grouped).forEach((at) => {
      advisorOpen[at] = false;
      Object.keys(grouped[at]).forEach((alloc) => { groupOpen[`${at}/${alloc}`] = false; });
    });
    setExpandedAdvisorTypes(advisorOpen);
    setExpandedGroups(groupOpen);
  };

  function PortfolioMiniCard({ portfolio }) {
    const isSel = selectedIds.has(portfolio.id);
    return (
      <button
        onClick={() => selectMode ? toggleSelectPortfolio(portfolio.id) : onPortfolioClick(portfolio)}
        className={`text-left p-3 rounded-xl border transition-colors w-full ${selectMode ? (isSel ? "border-emerald-400 bg-emerald-50" : "border-gray-100 bg-white hover:bg-emerald-50") : "border-gray-100 bg-white hover:bg-emerald-50 hover:border-emerald-200"}`}
        >
        <div className="flex items-center gap-2 mb-1">
          {selectMode && (
            <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSel ? "bg-emerald-600 border-emerald-600" : "border-gray-300 bg-white"}`}>
              {isSel && <Check className="w-3 h-3 text-white" />}
            </span>
          )}
          <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <LayoutList className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <span className="text-sm font-medium text-gray-800 truncate">{portfolio.portfolio_name}</span>
        </div>
        {portfolio.advisor_firm_name && (
          <p className="text-xs text-gray-400 truncate pl-9">
            {portfolio.advisor_firm_name}
            {portfolio.inception_date ? ` · ${format(parseISO(portfolio.inception_date), "MM/dd/yyyy")}` : ""}
          </p>
        )}
      </button>
    );
  }

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
          <BarChart3 className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Portfolios
          </span>
          <span className="text-xs text-gray-400 font-normal">({portfolios.length})</span>
        </button>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={(m) => { setViewMode(m); setExpanded(true); }} />
          <Button
            variant={selectMode ? "default" : "ghost"}
            size="sm"
            className={`h-7 px-2 gap-1 text-xs ${selectMode ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-gray-600 hover:text-gray-700 hover:bg-gray-100"}`}
            onClick={toggleSelectMode}
            title="Select multiple portfolios for bulk actions"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {selectMode ? "Done" : "Select"}
          </Button>
          {portfoliosToReconcile.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1 text-xs"
              onClick={handleReconcileAll}
              disabled={reconcilingAll}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconcilingAll ? "animate-spin" : ""}`} />
              {reconcilingAll ? "Reconciling..." : `Reconcile All (${portfoliosToReconcile.length})`}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1 text-xs"
            onClick={onAddPortfolio}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Portfolio
          </Button>
        </div>
      </div>

      {/* Bulk action bar — visible when portfolios are selected */}
      {selectMode && selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 shadow-sm mb-2">
          <span className="text-sm font-medium text-emerald-800">
            {selectedIds.size} portfolio{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="h-4 w-px bg-emerald-200" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs bg-white text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
            onClick={() => setBulkXponanceOpen(true)}
            disabled={bulkXponanceBusy}
          >
            {bulkXponanceBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            Assign Xponance
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs ml-auto text-gray-500 hover:text-gray-700"
            onClick={clearSelection}
            disabled={bulkXponanceBusy}
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </Button>
        </div>
      )}
      {selectMode && (
        <div className="text-xs text-gray-500 px-1 mb-2">
          {selectedIds.size > 0
            ? `${selectedIds.size} selected — tap portfolios to add or remove them.`
            : "Tap portfolios to select them for bulk actions."}
        </div>
      )}

      {/* Portfolio groups */}
      {expanded && (
        <div className="space-y-3">
          <SectionSearch value={search} onChange={setSearch} placeholder="Search by portfolio, firm, or type..." />
          <div className="flex flex-col md:flex-row gap-3">
            {showFilters && (
              <div className="w-full md:w-56 flex-shrink-0">
                <EntityFilterSidebar
                  sectionKey="portfolios"
                  groups={dynamicFilterGroups}
                  values={filterValues}
                  onChange={handleFilterChange}
                  counts={filterCounts}
                  onClearAll={clearAllFilters}
                  hasActiveFilters={hasActiveSidebarFilters}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 gap-1 text-xs ${showFilters ? "text-emerald-700 bg-emerald-50" : "text-gray-500 hover:text-emerald-700 hover:bg-emerald-50"}`}
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {showFilters ? "Hide Filters" : "Filters"}
                </Button>
                {viewMode === "list" && (
                  <SectionExpandCollapse onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} />
                )}
              </div>
          {viewMode === "card" && filteredPortfolios.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 py-1">
              {filteredPortfolios.map((portfolio) => (
                <PortfolioMiniCard key={portfolio.id} portfolio={portfolio} />
              ))}
            </div>
          )}

          {viewMode === "kanban" && filteredPortfolios.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Object.entries(grouped).map(([advisorType, allocatorGroups]) => {
                const allPortfolios = Object.values(allocatorGroups).flat();
                return (
                  <div key={advisorType} className="flex-shrink-0 w-72">
                    <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                      <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide truncate">{advisorType}</span>
                      <span className="text-xs text-emerald-600 ml-auto">{allPortfolios.length}</span>
                    </div>
                    <div className="space-y-2">
                      {allPortfolios.map((portfolio) => (
                        <PortfolioMiniCard key={portfolio.id} portfolio={portfolio} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "list" && filteredPortfolios.length === 0 && (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              No portfolios yet — click "Add Portfolio" to create one
            </div>
          )}

          {viewMode === "list" && filteredPortfolios.length > 0 && Object.entries(grouped).map(([advisorType, allocatorGroups]) => {
            const isAdvisorTypeOpen = expandedAdvisorTypes[advisorType] !== false;
            return (
            <div key={advisorType} className="space-y-2">
              {/* Advisor Type Header */}
              <button
                onClick={() => toggleAdvisorType(advisorType)}
                className="w-full bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2 hover:bg-emerald-100 transition-colors"
              >
                {isAdvisorTypeOpen ? (
                  <ChevronDown className="w-4 h-4 text-emerald-700" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-emerald-700" />
                )}
                <span className="text-xs font-semibold text-emerald-700 uppercase">{advisorType}</span>
                <span className="text-xs text-emerald-600">{Object.values(allocatorGroups).flat().length}</span>
              </button>

              {/* Allocator Groups */}
              {isAdvisorTypeOpen && (
                <div className="ml-2 space-y-2">
                  {Object.entries(allocatorGroups).map(([allocator, portfolioList]) => {
                    const groupKey = `${advisorType}/${allocator}`;
                    const isOpen = expandedGroups[groupKey];
                    const exposure = allocatorExposure[allocator];

                    return (
                      <div key={groupKey} className="space-y-1.5">
                        {/* Allocator Header */}
                        <button
                          onClick={() => toggleGroup(groupKey)}
                          className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                            exposure?.overAllocated
                              ? "text-red-700 hover:text-red-800 hover:bg-red-50"
                              : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                          }`}
                        >
                          {isOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          )}
                          <span>{allocator}</span>
                          {exposure && exposure.totalAllocated > 0 && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              exposure.overAllocated
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-50 text-emerald-600"
                            }`}>
                              <DollarSign className="w-2.5 h-2.5" />
                              {formatCompactCurrency(exposure.totalAllocated)}
                              {exposure.firmAum > 0 && ` / ${formatCompactCurrency(exposure.firmAum)}`}
                            </span>
                          )}
                          {exposure?.overAllocated && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500 text-white">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Over by {formatCompactCurrency(exposure.discrepancy)}
                            </span>
                          )}
                          <span className="text-gray-400 ml-auto">{portfolioList.length}</span>
                        </button>

                        {/* Portfolio List */}
                        {isOpen && (
                          <div className="ml-3 space-y-1.5">
                            {exposure?.overAllocated && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>
                                  Total committed capital ({formatCompactCurrency(exposure.totalAllocated)}) exceeds
                                  allocator's AUM limit ({formatCompactCurrency(exposure.firmAum)}) by{" "}
                                  <strong>{formatCompactCurrency(exposure.discrepancy)}</strong>.
                                </span>
                              </div>
                            )}
                            {portfolioList.map((portfolio) => {
                              const isSel = selectedIds.has(portfolio.id);
                              return (
                              <button
                                key={portfolio.id}
                                onClick={() => selectMode ? toggleSelectPortfolio(portfolio.id) : onPortfolioClick(portfolio)}
                                className={`w-full text-left bg-white rounded-lg border px-3 py-2 transition-all group ${selectMode ? (isSel ? "border-emerald-400 bg-emerald-50" : "border-gray-100 hover:bg-emerald-50") : "border-gray-100 hover:border-emerald-200 hover:shadow-sm"}`}
                              >
                                <div className="flex items-center gap-2">
                                  {selectMode && (
                                    <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSel ? "bg-emerald-600 border-emerald-600" : "border-gray-300 bg-white"}`}>
                                      {isSel && <Check className="w-3 h-3 text-white" />}
                                    </span>
                                  )}
                                  <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                    <LayoutList className="w-3 h-3 text-emerald-500" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-gray-900 truncate group-hover:text-emerald-700">
                                      {portfolio.portfolio_name}
                                    </div>
                                    {portfolio.advisor_firm_name && (
                                      <div className="text-xs text-gray-400 truncate">
                                        {portfolio.advisor_firm_name}
                                        {portfolio.inception_date ? ` · ${format(parseISO(portfolio.inception_date), "MM/dd/yyyy")}` : ""}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
          })}
            </div>
          </div>
        </div>
      )}
      <BulkAssignXponanceContactDialog
        open={bulkXponanceOpen}
        onOpenChange={setBulkXponanceOpen}
        entityType="Portfolio"
        entityLabel="portfolios"
        selectedCount={selectedIds.size}
        onAssign={handleBulkAssignXponance}
        busy={bulkXponanceBusy}
      />
    </div>
  );
}