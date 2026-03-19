import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, LayoutList, ChevronDown, ChevronRight } from "lucide-react";

export default function PortfoliosSection({ portfolios, onPortfolioClick, onAddPortfolio }) {
  const [expanded, setExpanded] = useState(true);

  const sorted = [...portfolios].sort((a, b) =>
    (a.portfolio_name || "").localeCompare(b.portfolio_name || "")
  );

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

      {/* Portfolio cards */}
      {expanded && (
        <div className="space-y-2">
          {sorted.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              No portfolios yet — click "Add Portfolio" to create one
            </div>
          ) : (
            sorted.map((portfolio) => (
              <button
                key={portfolio.id}
                onClick={() => onPortfolioClick(portfolio)}
                className="w-full text-left bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-emerald-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <LayoutList className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate group-hover:text-emerald-700">
                      {portfolio.portfolio_name}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {portfolio.allocator_name || ""}
                      {portfolio.advisor_firm_name ? ` · ${portfolio.advisor_firm_name}` : ""}
                      {portfolio.inception_date ? ` · ${portfolio.inception_date}` : ""}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}