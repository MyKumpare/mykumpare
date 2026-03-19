import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProductsSection({ products, firms, onProductClick, onAddProduct }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedFirms, setExpandedFirms] = useState({});

  const toggleGroup = (type) =>
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }));

  const toggleFirm = (firmId) =>
    setExpandedFirms((prev) => ({ ...prev, [firmId]: !prev[firmId] }));

  // Group products by asset class
  const grouped = {};
  products.forEach((product) => {
    const key = product.asset_class || "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(product);
  });

  // Get firm map for quick lookup
  const firmMap = {};
  firms.forEach((firm) => {
    firmMap[firm.id] = firm;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          Products
        </button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onAddProduct}
          className="h-7 px-2 text-xs gap-1"
        >
          <Plus className="w-3 h-3" />
          Add Product
        </Button>
      </div>

      {expanded && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([assetClass, groupProducts]) => {
            const isGroupExpanded = expandedGroups[assetClass] !== false;

            return (
              <div key={assetClass}>
                <button
                  onClick={() => toggleGroup(assetClass)}
                  className="w-full flex items-center gap-2 mb-1.5 group"
                >
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-primary transition-colors">
                    {assetClass}
                  </span>
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-xs text-gray-400">{groupProducts.length}</span>
                  {isGroupExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isGroupExpanded && (
                  <div className="space-y-3 pl-1">
                    {groupProducts.map(({ firm_id: firmId, ...product }) => {
                      const firm = firmMap[firmId];
                      const firmProducts = groupProducts.filter((p) => p.firm_id === firmId);
                      const isFirmExpanded = expandedFirms[firmId] !== false;

                      return (
                        <div key={product.id || firmId}>
                          {firmProducts.length > 1 ? (
                            <>
                              <button
                                onClick={() => toggleFirm(firmId)}
                                className="w-full flex items-center gap-2 mb-1.5 group cursor-pointer"
                              >
                                {firm?.logo_url ? (
                                  <img
                                    src={firm.logo_url}
                                    alt={firm?.name}
                                    className="w-4 h-4 object-contain rounded"
                                  />
                                ) : null}
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide group-hover:text-gray-700">
                                  {firm?.name}
                                </span>
                                <div className="h-px flex-1 bg-gray-100" />
                                <span className="text-xs text-gray-400">{firmProducts.length}</span>
                                {isFirmExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                )}
                              </button>
                              {isFirmExpanded && (
                                <div className="space-y-1">
                                  {firmProducts.map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => onProductClick(p)}
                                      className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-violet-50 hover:border-violet-200 transition-colors flex items-center gap-2 group"
                                    >
                                      <Package className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400 flex-shrink-0" />
                                      <span className="text-sm text-gray-800 group-hover:text-violet-700 font-medium truncate">
                                        {p.name}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => onProductClick(product)}
                              className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-violet-50 hover:border-violet-200 transition-colors flex items-center gap-2 group"
                            >
                              <Package className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400 flex-shrink-0" />
                              <span className="text-sm text-gray-800 group-hover:text-violet-700 font-medium truncate">
                                {product.name}
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(grouped).length === 0 && (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              No products yet. Click "Add Product" to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}