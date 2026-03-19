import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, LayoutList, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PortfoliosSection({ portfolios, onPortfolioClick, onAddPortfolio }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});

  // Group portfolios by advisor type → allocator → portfolio name
  const grouped = useMemo(() => {
    const groups = {};
    
    portfolios.forEach((p) => {
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
  }, [portfolios]);

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
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
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Portfolios
          </span>
          <span className="text-xs text-gray-400 font-normal">({portfolios.length})</span>
        </button>
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

      {/* Portfolio groups */}
      {expanded && (
        <div className="space-y-3">
          {portfolios.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              No portfolios yet — click "Add Portfolio" to create one
            </div>
          ) : (
            Object.entries(grouped).map(([advisorType, allocatorGroups]) => (
              <div key={advisorType} className="space-y-2">
                {/* Advisor Type Header */}
                <div className="bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-700 uppercase">{advisorType}</span>
                  <span className="text-xs text-emerald-600">{Object.values(allocatorGroups).flat().length}</span>
                </div>

                {/* Allocator Groups */}
                <div className="ml-2 space-y-2">
                  {Object.entries(allocatorGroups).map(([allocator, portfolioList]) => {
                    const groupKey = `${advisorType}/${allocator}`;
                    const isOpen = expandedGroups[groupKey];

                    return (
                      <div key={groupKey} className="space-y-1.5">
                        {/* Allocator Header */}
                        <button
                          onClick={() => toggleGroup(groupKey)}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
                        >
                          {isOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          )}
                          <span>{allocator}</span>
                          <span className="text-gray-400 ml-auto">{portfolioList.length}</span>
                        </button>

                        {/* Portfolio List */}
                        {isOpen && (
                          <div className="ml-3 space-y-1.5">
                            {portfolioList.map((portfolio) => (
                              <button
                                key={portfolio.id}
                                onClick={() => onPortfolioClick(portfolio)}
                                className="w-full text-left bg-white rounded-lg border border-gray-100 px-3 py-2 hover:border-emerald-200 hover:shadow-sm transition-all group"
                              >
                                <div className="flex items-center gap-2">
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
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}