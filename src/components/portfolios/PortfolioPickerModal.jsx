import React, { useState } from "react";
import { X, LayoutList, Plus, Search, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PortfolioPickerModal({ open, onClose, portfolios, onPortfolioClick, onAddPortfolio }) {
  const [search, setSearch] = useState("");

  if (!open) return null;

  const filtered = portfolios.filter(p =>
    !p.deleted_at && (
      !search ||
      (p.portfolio_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.allocator_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.advisor_firm_name || "").toLowerCase().includes(search.toLowerCase())
    )
  );

  // Group by allocator
  const grouped = {};
  filtered.forEach(p => {
    const key = p.allocator_name || "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });
  const allocators = Object.keys(grouped).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[75vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-emerald-600" /> Portfolios
          </h2>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
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
              placeholder="Search portfolios..."
              className="w-full h-8 pl-9 pr-3 text-sm rounded-lg border border-gray-200 outline-none focus:border-emerald-400 bg-gray-50"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-6">
              {search ? "No portfolios match your search." : "No portfolios yet."}
            </p>
          ) : (
            allocators.map(allocator => (
              <div key={allocator}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-1">{allocator}</p>
                <div className="space-y-1">
                  {grouped[allocator].map(portfolio => (
                    <button
                      key={portfolio.id}
                      type="button"
                      onClick={() => { onPortfolioClick(portfolio); onClose(); }}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <LayoutList className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-emerald-700">
                          {portfolio.portfolio_name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {portfolio.advisor_firm_name || "—"}
                          {portfolio.inception_date ? ` · ${format(parseISO(portfolio.inception_date), "MM/dd/yyyy")}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Portfolio footer */}
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