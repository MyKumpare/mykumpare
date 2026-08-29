import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ChevronDown, ChevronRight, Package, ClipboardCheck, X } from "lucide-react";
import ViewModeToggle from "@/components/common/ViewModeToggle";
import SectionSearch from "@/components/common/SectionSearch";
import SectionTypeFilter from "@/components/common/SectionTypeFilter";
import SectionExpandCollapse from "@/components/common/SectionExpandCollapse";
import ProductStatusBadge from "@/components/products/ProductStatusBadge";
import ProductFundingSummary from "@/components/products/ProductFundingSummary";
import ProductAlignmentHeatmap from "@/components/products/ProductAlignmentHeatmap";
import { useViewMode } from "@/hooks/useViewMode";
import { useAuth } from "@/lib/AuthContext";
import BulkScoringDialog from "@/components/templates/BulkScoringDialog";
import EntityFilterSidebar from "@/components/common/EntityFilterSidebar";
import { productFilterGroups } from "./productFilterGroups";
import { SlidersHorizontal } from "lucide-react";

const PRODUCT_GROUP_TYPES = ["Investment Manager"];

const GROUP_COLORS = {
  "Investment Manager": "bg-blue-100 text-blue-700",
};

export default function ProductsSection({ products, firms, onProductClick, onAddProduct, onFirmClick, forceExpanded }) {
  const { user: currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedFirms, setExpandedFirms] = useState({});
  const [viewMode, setViewMode] = useViewMode("products");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkScoring, setShowBulkScoring] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [filterValues, setFilterValues] = useState({
    product_type: new Set(),
    product_status: new Set(),
    funding_status: new Set(),
    product_availability_status: new Set(),
    asset_class: "",
    geography: "",
  });
  const handleFilterChange = (key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }));
  const clearAllFilters = () => setFilterValues({
    product_type: new Set(),
    product_status: new Set(),
    funding_status: new Set(),
    product_availability_status: new Set(),
    asset_class: "",
    geography: "",
  });
  const hasActiveSidebarFilters =
    filterValues.product_type.size > 0 ||
    filterValues.product_status.size > 0 ||
    filterValues.funding_status.size > 0 ||
    filterValues.product_availability_status.size > 0 ||
    (filterValues.asset_class || "").trim() ||
    (filterValues.geography || "").trim();

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const toggleGroup = (type) =>
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }));

  const toggleSelect = (productId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const selectAllVisible = () => {
    const allIds = new Set(filteredProducts.map((p) => p.id));
    setSelectedIds(allIds);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    clearSelection();
  };

  const toggleFirm = (firmId) =>
    setExpandedFirms((prev) => ({ ...prev, [firmId]: !prev[firmId] }));

  // Build a firmId -> firm map for quick lookup
  const firmMap = Object.fromEntries(firms.map((f) => [f.id, f]));

  const searchLower = search.toLowerCase().trim();
  const filteredProducts = React.useMemo(() => {
    let result = products;
    if (searchLower) {
      result = result.filter((p) => {
        const name = (p.name || "").toLowerCase();
        const assetClass = (p.asset_class || "").toLowerCase();
        const firm = (firmMap[p.firm_id]?.name || "").toLowerCase();
        return name.includes(searchLower) || assetClass.includes(searchLower) || firm.includes(searchLower);
      });
    }
    if (filterValues.product_type.size > 0)
      result = result.filter((p) => filterValues.product_type.has(p.product_type));
    if (filterValues.product_status.size > 0)
      result = result.filter((p) => filterValues.product_status.has(p.product_status || "Not Reviewed"));
    if (filterValues.funding_status.size > 0)
      result = result.filter((p) => filterValues.funding_status.has(p.funding_status || ""));
    if (filterValues.product_availability_status.size > 0)
      result = result.filter((p) => filterValues.product_availability_status.has(p.product_availability_status || "Active"));
    if ((filterValues.asset_class || "").trim()) {
      const q = filterValues.asset_class.toLowerCase().trim();
      result = result.filter((p) => (p.asset_class || "").toLowerCase().includes(q));
    }
    if ((filterValues.geography || "").trim()) {
      const q = filterValues.geography.toLowerCase().trim();
      result = result.filter((p) => (p.geography || "").toLowerCase().includes(q));
    }
    return result;
  }, [products, searchLower, firmMap, filterValues]);

  const filterCounts = React.useMemo(() => {
    const productType = {}, productStatus = {}, fundingStatus = {}, availability = {};
    for (const p of products) {
      if (p.deleted_at) continue;
      if (p.product_type) productType[p.product_type] = (productType[p.product_type] || 0) + 1;
      const ps = p.product_status || "Not Reviewed";
      productStatus[ps] = (productStatus[ps] || 0) + 1;
      if (p.funding_status) fundingStatus[p.funding_status] = (fundingStatus[p.funding_status] || 0) + 1;
      const av = p.product_availability_status || "Active";
      availability[av] = (availability[av] || 0) + 1;
    }
    return { product_type: productType, product_status: productStatus, funding_status: fundingStatus, product_availability_status: availability };
  }, [products]);

  const selectedProducts = filteredProducts.filter((p) => selectedIds.has(p.id));

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
        products: filteredProducts
          .filter((p) => p.firm_id === firm.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.products.length > 0);

    if (firmGroups.length > 0) acc[groupType] = firmGroups;
    return acc;
  }, [filteredProducts]);

  const totalProducts = products.length;

  const handleExpandAll = () => {
    const groups = {};
    const firmsOpen = {};
    PRODUCT_GROUP_TYPES.forEach((t) => { groups[t] = true; });
    firms.forEach((f) => {
      const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
      if (types.some((t) => PRODUCT_GROUP_TYPES.includes(t))) firmsOpen[f.id] = true;
    });
    setExpandedGroups(groups);
    setExpandedFirms(firmsOpen);
  };

  const handleCollapseAll = () => {
    const groups = {};
    const firmsOpen = {};
    PRODUCT_GROUP_TYPES.forEach((t) => { groups[t] = false; });
    firms.forEach((f) => { firmsOpen[f.id] = false; });
    setExpandedGroups(groups);
    setExpandedFirms(firmsOpen);
  };

  const productColor = (gt) => GROUP_COLORS[gt] || "bg-gray-100 text-gray-700";

  function ProductMiniCard({ product }) {
    const firm = firmMap[product.firm_id];
    return (
      <div className={`relative p-3 rounded-xl border bg-white transition-colors w-full ${
        selectMode && selectedIds.has(product.id)
          ? "border-indigo-300 bg-indigo-50/50"
          : "border-gray-100 hover:bg-violet-50 hover:border-violet-200"
      }`}>
        {selectMode && (
          <div className="absolute top-2 right-2 z-10">
            <Checkbox
              checked={selectedIds.has(product.id)}
              onCheckedChange={() => toggleSelect(product.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <button
          onClick={() => selectMode ? toggleSelect(product.id) : onProductClick(product)}
          className="text-left w-full"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <span className="text-sm font-medium text-gray-800 truncate">{product.name}</span>
            <ProductStatusBadge status={product.product_status} className="ml-auto" />
          </div>
          {firm && <p className="text-xs text-gray-400 truncate pl-9">{firm.name}</p>}
          {product.asset_class && (
            <p className="text-xs text-gray-400 pl-9">{product.asset_class}</p>
          )}
        </button>
      </div>
    );
  }

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
          <Package className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Products
          </span>
          <span className="text-xs text-gray-400 font-normal">({totalProducts})</span>
        </button>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={(m) => { setViewMode(m); setExpanded(true); }} />
          {selectMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1 text-xs"
                onClick={exitSelectMode}
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1 text-xs"
                  onClick={clearSelection}
                >
                  Clear ({selectedIds.size})
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1 text-xs"
                onClick={selectAllVisible}
              >
                Select All
              </Button>
              <Button
                size="sm"
                className="h-7 px-3 text-xs gap-1"
                disabled={selectedIds.size === 0}
                onClick={() => setShowBulkScoring(true)}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Score Selected ({selectedIds.size})
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
                onClick={() => { setSelectMode(true); setExpanded(true); }}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Select
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50 gap-1 text-xs"
                onClick={onAddProduct}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Product
              </Button>
            </>
          )}
        </div>
      </div>

      {selectMode && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span className="text-xs text-indigo-700 font-medium">
            {selectedIds.size} product{selectedIds.size === 1 ? "" : "s"} selected — check products below, then click "Score Selected" to initiate scoring for all at once.
          </span>
        </div>
      )}

      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100 space-y-4">
          <ProductFundingSummary products={filteredProducts} firms={firms} onProductClick={onProductClick} />
          <ProductAlignmentHeatmap />
          <SectionSearch value={search} onChange={setSearch} placeholder="Search by product, firm, or type..." />
          <div className="flex flex-col md:flex-row gap-3">
            {showFilters && (
              <div className="w-full md:w-56 flex-shrink-0">
                <EntityFilterSidebar
                  sectionKey="products"
                  groups={productFilterGroups}
                  values={filterValues}
                  onChange={handleFilterChange}
                  counts={filterCounts}
                  onClearAll={clearAllFilters}
                  hasActiveFilters={hasActiveSidebarFilters}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 gap-1 text-xs ${showFilters ? "text-indigo-700 bg-indigo-50" : "text-gray-500 hover:text-indigo-700 hover:bg-indigo-50"}`}
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {showFilters ? "Hide Filters" : "Filters"}
                </Button>
                {viewMode === "list" && (
                  <SectionExpandCollapse onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} />
                )}
              </div>
          {viewMode === "list" && PRODUCT_GROUP_TYPES.filter((gt) => typeFilter === "all" || gt === typeFilter).map((groupType) => {
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
                          <div className="w-full flex items-center gap-2 mb-1.5 group">
                            {firm.logo_url ? (
                              <img src={firm.logo_url} alt={firm.name} className="w-4 h-4 object-contain rounded flex-shrink-0" />
                            ) : null}
                            <button
                              onClick={() => onFirmClick && onFirmClick(firm)}
                              className="text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-primary hover:underline cursor-pointer text-left"
                            >
                              {firm.name}
                            </button>
                            <div className="h-px flex-1 bg-gray-100" />
                            <span className="text-xs text-gray-400">{firmProducts.length}</span>
                            <button onClick={() => toggleFirm(firm.id)} className="cursor-pointer">
                              {isFirmExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </button>
                          </div>
                          {/* Products list */}
                          {isFirmExpanded && (
                            <div className="space-y-1">
                              {firmProducts.map((product) => (
                                <div
                                  key={product.id}
                                  className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-violet-50 hover:border-violet-200 transition-colors flex items-center gap-2 group"
                                >
                                  {selectMode && (
                                    <Checkbox
                                      checked={selectedIds.has(product.id)}
                                      onCheckedChange={() => toggleSelect(product.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex-shrink-0"
                                    />
                                  )}
                                  <button
                                    onClick={() => selectMode ? toggleSelect(product.id) : onProductClick(product)}
                                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                                  >
                                    <Package className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400 flex-shrink-0" />
                                    <span className={`text-sm font-medium truncate ${selectedIds.has(product.id) ? "text-indigo-700" : "text-gray-800 group-hover:text-violet-700"}`}>
                                      {product.name}
                                    </span>
                                  </button>
                                  <ProductStatusBadge status={product.product_status} className="ml-auto" />
                                  {product.asset_class && (
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                      {product.asset_class}
                                    </span>
                                  )}
                                </div>
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

          {viewMode === "card" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 py-1">
              {filteredProducts
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((product) => (
                  <ProductMiniCard key={product.id} product={product} />
                ))}
            </div>
          )}

          {viewMode === "kanban" && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {PRODUCT_GROUP_TYPES.filter((gt) => grouped[gt] && (typeFilter === "all" || gt === typeFilter)).map((gt) => {
                const firmGroups = grouped[gt];
                const allProducts = firmGroups.flatMap((g) => g.products);
                return (
                  <div key={gt} className="flex-shrink-0 w-72">
                    <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg ${productColor(gt)}`}>
                      <span className="text-xs font-semibold uppercase tracking-wide truncate">{gt}</span>
                      <span className="text-xs ml-auto">{allProducts.length}</span>
                    </div>
                    <div className="space-y-2">
                      {allProducts.map((product) => (
                        <ProductMiniCard key={product.id} product={product} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {Object.keys(grouped).length === 0 && (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              No products yet. Click "Add Product" to create one.
            </div>
          )}
            </div>
          </div>
        </div>
      )}

      {showBulkScoring && (
        <BulkScoringDialog
          open={showBulkScoring}
          onClose={() => setShowBulkScoring(false)}
          selectedProducts={selectedProducts}
          currentUser={currentUser}
          onCompleted={() => {
            exitSelectMode();
            setShowBulkScoring(false);
          }}
        />
      )}

    </div>
  );
}