import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronRight, Building } from "lucide-react";
import FirmTypeSection from "./FirmTypeSection";
import FirmCard from "./FirmCard";
import ViewModeToggle from "@/components/common/ViewModeToggle";
import SectionSearch from "@/components/common/SectionSearch";
import SectionTypeFilter from "@/components/common/SectionTypeFilter";
import SectionExpandCollapse from "@/components/common/SectionExpandCollapse";
import { useViewMode } from "@/hooks/useViewMode";

const FIRM_TYPES = [
  "Manager of Managers",
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
  forceExpanded,
}) {
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useViewMode("firms");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedTypes, setExpandedTypes] = useState({});

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
    return result;
  }, [groupedFirms, searchLower, typeFilter]);

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
            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
            onClick={onAddFirm}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Firm
          </Button>
        </div>
      </div>

      {/* Firm type sub-sections */}
      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100">
          <SectionSearch value={search} onChange={setSearch} placeholder="Search by firm name or type..." />
          <div className="flex items-center justify-between mb-2">
            <SectionTypeFilter
              label="Filter by type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={FIRM_TYPES}
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