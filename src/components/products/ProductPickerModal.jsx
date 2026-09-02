import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, Package, Plus, Search, ChevronRight, ChevronDown, Building, Users } from "lucide-react";

const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];

export default function ProductPickerModal({ open, onClose, products, onProductClick, onAddProduct }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [collapsedTypes, setCollapsedTypes] = useState({});
  const [collapsedFirms, setCollapsedFirms] = useState({});

  const toggleType = (type) => setCollapsedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  const toggleFirm = (key) => setCollapsedFirms(prev => ({ ...prev, [key]: !prev[key] }));

  const q = search.toLowerCase();

  const activeProducts = useMemo(() => products.filter(p => !p.deleted_at), [products]);

  const filtered = useMemo(() =>
    activeProducts.filter(p =>
      !q ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.firm_name || "").toLowerCase().includes(q) ||
      (p.product_type || "").toLowerCase().includes(q)
    ), [activeProducts, q]);

  // Group: product_type → firm_name → products (sorted alpha)
  const grouped = useMemo(() => {
    const result = {};
    const orderedTypes = PRODUCT_TYPES.filter(t => filtered.some(p => p.product_type === t));
    const otherTypes = [...new Set(filtered.filter(p => !PRODUCT_TYPES.includes(p.product_type)).map(p => p.product_type || "Other"))];
    const allTypes = [...orderedTypes, ...otherTypes];

    allTypes.forEach(type => {
      const typeProducts = filtered.filter(p => (p.product_type || "Other") === type);
      const firmGroups = {};
      typeProducts.forEach(p => {
        const firmKey = p.firm_name || "Unknown Firm";
        if (!firmGroups[firmKey]) firmGroups[firmKey] = [];
        firmGroups[firmKey].push(p);
      });
      // Sort firm names alpha, sort products within each firm alpha
      const sortedFirms = Object.keys(firmGroups).sort((a, b) => a.localeCompare(b));
      if (sortedFirms.length > 0) {
        result[type] = sortedFirms.map(firm => ({
          firm,
          products: firmGroups[firm].sort((a, b) => a.name.localeCompare(b.name)),
        }));
      }
    });

    return result;
  }, [filtered]);

  if (!open) return null;

  const types = Object.keys(grouped);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[82vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-violet-600" />
              Products
              <span className="text-xs text-gray-400 font-normal">({filtered.length})</span>
            </h2>
            <button type="button" onClick={onClose}>
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          {/* Action buttons row */}
          <div className="flex items-center gap-1.5 mt-2.5">
            <button
              type="button"
              onClick={() => { onClose(); navigate("/ProductCoverage"); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-violet-600 hover:text-violet-800 hover:bg-violet-50 transition-colors"
              title="Product Coverage"
            >
              <Users className="w-3.5 h-3.5" /> Firm Coverage
            </button>
          </div>
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
              placeholder="Search by product, firm, or type..."
              className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 outline-none focus:border-violet-400 bg-gray-50"
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
              {search ? "No products match your search." : "No products yet."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {types.map(type => {
                const isTypeCollapsed = collapsedTypes[type];
                const firmGroups = grouped[type];

                return (
                  <div key={type}>
                    {/* Product Type Header */}
                    <button
                      type="button"
                      onClick={() => toggleType(type)}
                      className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      {isTypeCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                      }
                      <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">{type}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {firmGroups.reduce((sum, fg) => sum + fg.products.length, 0)}
                      </span>
                    </button>

                    {!isTypeCollapsed && (
                      <div className="pb-1">
                        {firmGroups.map(({ firm, products: firmProducts }) => {
                          const firmKey = `${type}::${firm}`;
                          const isFirmCollapsed = collapsedFirms[firmKey];

                          return (
                            <div key={firmKey}>
                              {/* Firm Sub-header */}
                              <button
                                type="button"
                                onClick={() => toggleFirm(firmKey)}
                                className="w-full flex items-center gap-2 pl-8 pr-4 py-1 hover:bg-gray-50 transition-colors"
                              >
                                {isFirmCollapsed
                                  ? <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                  : <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                }
                                <Building className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="text-[11px] font-semibold text-gray-500 truncate">{firm}</span>
                                <span className="text-[10px] text-gray-300 ml-auto">{firmProducts.length}</span>
                              </button>

                              {/* Products under firm */}
                              {!isFirmCollapsed && (
                                <div className="pl-10 pr-4 pb-1 space-y-0.5">
                                  {firmProducts.map(product => (
                                    <button
                                      key={product.id}
                                      type="button"
                                      onClick={() => { onProductClick(product); onClose(); }}
                                      className="w-full text-left flex items-center gap-3 pl-4 pr-3 py-2 rounded-xl hover:bg-violet-50 transition-all group"
                                    >
                                      <div className="w-6 h-6 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0">
                                        <Package className="w-3 h-3 text-violet-400" />
                                      </div>
                                      <p className="text-sm font-medium text-gray-800 truncate flex-1 group-hover:text-violet-700">
                                        {product.name}
                                      </p>
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400 flex-shrink-0" />
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
            onClick={() => { onAddProduct(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>
    </div>
  );
}