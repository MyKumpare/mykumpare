import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { LineChart, ChevronDown, X, Search } from "lucide-react";

export default function AnalyticsSection() {
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });

  const activeProducts = products.filter((p) => !p.deleted_at);

  const filtered = activeProducts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProducts = activeProducts.filter((p) =>
    selectedProductIds.includes(p.id)
  );

  const toggle = (id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const remove = (id) => setSelectedProductIds((prev) => prev.filter((x) => x !== id));

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
          <LineChart className="w-4 h-4 text-cyan-600" />
        </div>
        <h2 className="text-sm font-bold text-gray-800 tracking-tight">Analytics</h2>
      </div>

      {/* Product selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Select Products to Analyze
        </label>

        {/* Selected chips */}
        {selectedProducts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1">
            {selectedProducts.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-medium rounded-full"
              >
                {p.name}
                <button onClick={() => remove(p.id)} className="hover:text-cyan-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Dropdown trigger */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => { setDropdownOpen((v) => !v); setSearch(""); }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 bg-white transition-colors"
          >
            <span className={selectedProducts.length === 0 ? "text-gray-400" : "text-gray-700"}>
              {selectedProducts.length === 0
                ? "Choose products..."
                : `${selectedProducts.length} product${selectedProducts.length > 1 ? "s" : ""} selected`}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="max-h-56 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-400 text-center">No products found</p>
                ) : (
                  filtered.map((p) => {
                    const checked = selectedProductIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => toggle(p.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors ${checked ? "bg-cyan-50" : ""}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${checked ? "bg-cyan-600 border-cyan-600" : "border-gray-300"}`}>
                          {checked && (
                            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{p.name}</p>
                          {p.firm_name && <p className="text-gray-400 truncate">{p.firm_name}</p>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer actions */}
              {filtered.length > 0 && (
                <div className="p-2 border-t border-gray-100 flex justify-between gap-2">
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSelectedProductIds(filtered.map((p) => p.id))}
                    className="text-xs text-cyan-600 hover:underline font-medium"
                  >
                    Select all
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSelectedProductIds([])}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Placeholder for future analysis content */}
      {selectedProducts.length > 0 && (
        <div className="mt-5 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
          Analysis for {selectedProducts.length} product{selectedProducts.length > 1 ? "s" : ""} will appear here.
        </div>
      )}
    </div>
  );
}