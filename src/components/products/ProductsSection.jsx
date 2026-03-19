import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronRight, Package } from "lucide-react";

const PRODUCT_GROUP_TYPES = ["Manager of Managers", "Investment Manager"];

const GROUP_COLORS = {
  "Manager of Managers": "bg-violet-100 text-violet-700",
  "Investment Manager": "bg-blue-100 text-blue-700",
};

export default function ProductsSection({ products, firms, onProductClick, onAddProduct }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (type) =>
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }));

  // Build a firmId -> firm map for quick lookup
  const firmMap = Object.fromEntries(firms.map((f) => [f.id, f]));

  // Group products by firm type, then sort firms asc, products asc
  const grouped = PRODUCT_GROUP_TYPES.reduce((acc, groupType) => {
    // Firms of this type
    const groupFirms = firms
      .filter((f) => {
        const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
        return types.includes(groupType);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const firmGroups = groupFirms
      .map((firm) => ({
        firm,
        products: products
          .filter((p) => p.firm_id === firm.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.products.length > 0);

    if (firmGroups.length > 0) acc[groupType] = firmGroups;
    return acc;
  }, {});

  const totalProducts = products.length;

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
            Products
          </span>
          <span className="text-xs text-gray-400 font-normal">({totalProducts})</span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50 gap-1 text-xs"
          onClick={onAddProduct}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Product
        </Button>
      </div>

      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100 space-y-4">
          {PRODUCT_GROUP_TYPES.map((groupType) => {
            const firmGroups = grouped[groupType];
            if (!firmGroups) return null;
            const isGroupExpanded = expandedGroups[groupType] !== false; // default open
            const colorClass = GROUP_COLORS[groupType];

            return (
              <div key={groupType}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(groupType)}
                  className="flex items-center gap-2 w-full mb-2 group cursor-pointer"
                >
                  <div className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${colorClass}`}>
                    {groupType}
                  </div>
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-xs text-gray-400 font-medium">
                    {firmGroups.reduce((sum, g) => sum + g.products.length, 0)}
                  </span>
                  {isGroupExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isGroupExpanded && (
                  <div className="space-y-3 pl-1">
                    {firmGroups.map(({ firm, products: firmProducts }) => {
                      const isFirmExpanded = expandedFirms[firm.id] !== false; // default open
                      return (
                        <div key={firm.id}>
                          {/* Firm sub-header */}
                          <button
                            onClick={() => toggleFirm(firm.id)}
                            className="w-full flex items-center gap-2 mb-1.5 group cursor-pointer"
                          >
                            {firm.logo_url ? (
                              <img src={firm.logo_url} alt={firm.name} className="w-4 h-4 object-contain rounded" />
                            ) : null}
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide group-hover:text-gray-700">
                              {firm.name}
                            </span>
                            <div className="h-px flex-1 bg-gray-100" />
                            <span className="text-xs text-gray-400">{firmProducts.length}</span>
                            {isFirmExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </button>
                          {/* Products list */}
                          {isFirmExpanded && (
                            <div className="space-y-1">
                              {firmProducts.map((product) => (
                                <button
                                  key={product.id}
                                  onClick={() => onProductClick(product)}
                                  className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-violet-50 hover:border-violet-200 transition-colors flex items-center gap-2 group"
                                >
                                  <Package className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-800 group-hover:text-violet-700 font-medium truncate">
                                    {product.name}
                                  </span>
                                  {product.asset_class && (
                                    <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
                                      {product.asset_class}
                                    </span>
                                  )}
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