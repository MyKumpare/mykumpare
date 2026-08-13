import React, { useState, useMemo } from "react";
import { X, Building, Plus, Search, ChevronRight, ChevronDown } from "lucide-react";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const getFirmTypes = (f) =>
  f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : ["Other"];

export default function FirmPickerModal({ open, onClose, firms, onFirmClick, onAddFirm }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [collapsedTypes, setCollapsedTypes] = useState({});

  const toggleType = (type) => setCollapsedTypes(prev => ({ ...prev, [type]: !prev[type] }));

  const collapseAll = () => setCollapsedTypes(Object.fromEntries(types.map(t => [t, true])));
  const expandAll = () => setCollapsedTypes({});

  const q = search.toLowerCase();

  const activeFirms = useMemo(() =>
    firms.filter(f => !f.deleted_at), [firms]);

  const filtered = useMemo(() =>
    activeFirms.filter(f => {
      const matchesSearch = !q ||
        (f.name || "").toLowerCase().includes(q) ||
        (f.firm_type || "").toLowerCase().includes(q) ||
        (f.firm_types || []).some(t => t.toLowerCase().includes(q));
      const matchesType = !typeFilter || getFirmTypes(f).includes(typeFilter);
      return matchesSearch && matchesType;
    }), [activeFirms, q, typeFilter]);

  // Group by firm type → sorted alphabetically within each group
  // A firm can appear under multiple types
  const grouped = useMemo(() => {
    const result = {};
    const seen = {}; // track which firm ids appear per type to avoid duplicates

    // First pass: known types in order
    FIRM_TYPES.forEach(type => {
      const typeFirms = filtered
        .filter(f => getFirmTypes(f).includes(type))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (typeFirms.length > 0) {
        result[type] = typeFirms;
        typeFirms.forEach(f => { seen[f.id] = true; });
      }
    });

    // Second pass: firms with no recognized type → "Other"
    const other = filtered.filter(f => !seen[f.id]).sort((a, b) => a.name.localeCompare(b.name));
    if (other.length > 0) result["Other"] = other;

    return result;
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
            <Building className="w-4 h-4 text-indigo-600" />
            Firms
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
              placeholder="Search by firm name or type..."
              className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          {/* Firm type filter */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Filter by type:</span>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="flex-1 h-8 text-xs rounded-lg border border-gray-200 bg-gray-50 px-2 outline-none focus:border-indigo-400 cursor-pointer"
            >
              <option value="">All Types</option>
              {FIRM_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {typeFilter && (
              <button
                type="button"
                onClick={() => setTypeFilter("")}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
          {/* Expand / Collapse all */}
          <div className="flex items-center justify-end gap-3 mt-1.5">
            <button
              type="button"
              onClick={expandAll}
              className="text-[11px] text-gray-500 hover:text-indigo-600 font-medium"
            >
              Expand All
            </button>
            <span className="text-gray-300 text-[11px]">|</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-[11px] text-gray-500 hover:text-indigo-600 font-medium"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">
              {search ? "No firms match your search." : "No firms yet."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {types.map(type => {
                const isCollapsed = collapsedTypes[type];
                const firmList = grouped[type];

                return (
                  <div key={type}>
                    {/* Firm Type Header */}
                    <button
                      type="button"
                      onClick={() => toggleType(type)}
                      className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                      }
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">{type}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">{firmList.length}</span>
                    </button>

                    {/* Firm Rows */}
                    {!isCollapsed && (
                      <div className="px-4 pb-1 space-y-0.5">
                        {firmList.map(firm => (
                          <button
                            key={firm.id}
                            type="button"
                            onClick={() => { onFirmClick(firm); onClose(); }}
                            className="w-full text-left flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl hover:bg-indigo-50 transition-all group"
                          >
                            {firm.logo_url ? (
                              <img src={firm.logo_url} alt={firm.name} className="w-7 h-7 rounded-md object-cover flex-shrink-0 border border-gray-100" />
                            ) : (
                              <div className="w-7 h-7 rounded-md flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800 truncate group-hover:text-indigo-700">
                                {firm.name}
                              </p>
                              {firm.website && (
                                <p className="text-xs text-gray-400 truncate">{firm.website}</p>
                              )}
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0" />
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

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { onAddFirm(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Firm
          </button>
        </div>
      </div>
    </div>
  );
}