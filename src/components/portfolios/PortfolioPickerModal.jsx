import React, { useState, useMemo } from "react";
import { X, LayoutList, Plus, Search, ChevronRight, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PortfolioPickerModal({ open, onClose, portfolios, onPortfolioClick, onAddPortfolio }) {
  const [search, setSearch] = useState("");
  const [collapsedFirms, setCollapsedFirms] = useState({});
  const [collapsedTypes, setCollapsedTypes] = useState({});

  const toggleFirm = (key) => setCollapsedFirms(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleType = (key) => setCollapsedTypes(prev => ({ ...prev, [key]: !prev[key] }));

  const q = search.toLowerCase();

  // Filter active portfolios
  const filtered = useMemo(() => {
    return portfolios.filter(p =>
      !p.deleted_at && (
        !q ||
        (p.portfolio_name || "").toLowerCase().includes(q) ||
        (p.allocator_name || "").toLowerCase().includes(q) ||
        (p.advisor_firm_name || "").toLowerCase().includes(q) ||
        (p.advisor_type || "").toLowerCase().includes(q)
      )
    );
  }, [portfolios, q]);

  // Group: firm type → allocator firm → portfolios (alphabetical)
  const grouped = useMemo(() => {
    const result = {};
    filtered.forEach(p => {
      const type = p.advisor_type || "No Advisor Type";
      const firm = p.allocator_name || "Unknown Firm";
      if (!result[type]) result[type] = {};
      if (!result[type][firm]) result[type][firm] = [];
      result[type][firm].push(p);
    });
    // Sort each level alphabetically
    const sorted = {};
    Object.keys(result).sort().forEach(type => {
      sorted[type] = {};
      Object.keys(result[type]).sort().forEach(firm => {
        sorted[type][firm] = result[type][firm].sort((a, b) =>
          (a.portfolio_name || "").localeCompare(b.portfolio_name || "")
        );
      });
    });
    return sorted;
  }, [filtered]);

  if (!open) return null;

  const types = Object.keys(grouped);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[78vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-emerald-600" />
            Portfolios
            <span className="text-xs text-gray-400 font-normal">({filtered.length})</span>
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by portfolio, firm, or type..."
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-gray-200 outline-none focus:border-emerald-400 bg-gray-50"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">
              {search ? "No portfolios match your search." : "No portfolios yet."}
            </p>
          ) : (
            <div className="space-y-1">
              {types.map(type => {
                const typeCollapsed = collapsedTypes[type];
                const firms = Object.keys(grouped[type]);
                const totalInType = firms.reduce((s, f) => s + grouped[type][f].length, 0);

                return (
                  <div key={type}>
                    {/* Firm Type Header */}
                    <button
                      type="button"
                      onClick={() => toggleType(type)}
                      className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      {typeCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      }
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{type}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">{totalInType}</span>
                    </button>

                    {!typeCollapsed && (
                      <div className="pb-1">
                        {firms.map(firm => {
                          const firmKey = `${type}__${firm}`;
                          const firmCollapsed = collapsedFirms[firmKey];
                          const portfolioList = grouped[type][firm];

                          return (
                            <div key={firmKey}>
                              {/* Firm Name Header */}
                              <button
                                type="button"
                                onClick={() => toggleFirm(firmKey)}
                                className="w-full flex items-center gap-2 px-6 py-1 hover:bg-gray-50 transition-colors"
                              >
                                {firmCollapsed
                                  ? <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                  : <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                }
                                <span className="text-xs font-semibold text-gray-600 truncate">{firm}</span>
                                <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{portfolioList.length}</span>
                              </button>

                              {!firmCollapsed && (
                                <div className="px-4 pb-1 space-y-1">
                                  {portfolioList.map(portfolio => (
                                    <button
                                      key={portfolio.id}
                                      type="button"
                                      onClick={() => { onPortfolioClick(portfolio); onClose(); }}
                                      className="w-full text-left flex items-center gap-3 pl-8 pr-3 py-2 rounded-xl hover:bg-emerald-50 transition-all group"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-emerald-700">
                                          {portfolio.portfolio_name}
                                        </p>
                                        {portfolio.advisor_firm_name && (
                                          <p className="text-xs text-gray-400 truncate">
                                            {portfolio.advisor_firm_name}
                                            {portfolio.inception_date ? ` · ${format(parseISO(portfolio.inception_date), "MM/dd/yyyy")}` : ""}
                                          </p>
                                        )}
                                      </div>
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-400 flex-shrink-0" />
                                    </button>
                                  ))}
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
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { onAddPortfolio(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Portfolio
          </button>
        </div>
      </div>
    </div>
  );
}