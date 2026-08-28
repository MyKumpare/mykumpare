import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Package, ChevronDown, ChevronRight, LayoutList, MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import FirmStatusBadges from "./FirmStatusBadges";

const FIRM_TYPE_TO_PRODUCT_TYPE = {
  "Investment Manager": "Investment Manager Product",
};

export default function FirmCard({ firm, onEdit, onDelete, onAddProduct, onEditProduct, onAddPortfolio, products = [], forceExpand = false, selectionMode = false, selected = false, onToggleSelect }) {
  const ALLOWED_FIRM_TYPES = ["Investment Manager"];
  const effectiveTypes = firm.firm_types?.length > 0 ? firm.firm_types : (firm.firm_type ? [firm.firm_type] : []);
  const allowedType = effectiveTypes.find(t => ALLOWED_FIRM_TYPES.includes(t));
  const productType = allowedType ? FIRM_TYPE_TO_PRODUCT_TYPE[allowedType] : null;
  const isAllocator = effectiveTypes.includes("Allocator");
  const isInvestmentManager = effectiveTypes.includes("Investment Manager");
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpand || expanded;

  const firmProducts = products.filter((p) => p.firm_id === firm.id).sort((a, b) => a.name.localeCompare(b.name));
  const showProducts = !!productType;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
    >
      <div className="group flex items-center justify-between p-4">
        {/* Clicking the card body opens the edit dialog */}
        <div
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          onClick={() => !selectionMode && onEdit(firm)}
          title={selectionMode ? `Select ${firm.name}` : `Edit ${firm.name}`}
        >
          {/* Selection checkbox — shown only in bulk-select mode */}
          {selectionMode && (
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onToggleSelect?.(firm.id, !!checked)}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            />
          )}
          {/* Logo / icon */}
          <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-indigo-300 transition-all">
            {firm.logo_url ? (
              <img src={firm.logo_url} alt={firm.name} className="w-full h-full object-contain p-1" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            ) : null}
          </div>

          {/* Firm name + location */}
          <span className="font-medium text-gray-900 truncate hover:text-indigo-600 transition-colors text-left">
            {firm.name}
          </span>
          {firm.location && (
            <span className="hidden sm:flex items-center gap-0.5 text-xs text-gray-400 flex-shrink-0">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[140px]">{firm.location}</span>
            </span>
          )}

          {/* Product count — chevron is an explicit expand toggle */}
          {showProducts && (
            <button
              className="flex items-center gap-1 flex-shrink-0 ml-1 rounded hover:bg-gray-100 px-1"
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              title="Toggle products"
            >
              <span className="text-xs text-gray-400 font-medium">
                {firmProducts.length > 0 ? firmProducts.length : ""}
              </span>
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                : <ChevronRight className="w-4 h-4 text-gray-400" />
              }
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {isInvestmentManager && (
            <FirmStatusBadges firm={firm} products={products} onEditProduct={onEditProduct} />
          )}
          {showProducts && onAddProduct && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddProduct(firm, productType); }}
              className="flex items-center gap-1 px-2 h-8 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
              title={`Add ${productType}`}
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">Add Product</span>
            </button>
          )}
          {isAllocator && onAddPortfolio && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddPortfolio(firm); }}
              className="flex items-center gap-1 px-2 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
              title="Add Portfolio"
            >
              <LayoutList className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">Add Portfolio</span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && showProducts && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1.5 border-t border-gray-50 pt-3">
              {firmProducts.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-1 pl-1">No products yet</p>
              ) : (
                firmProducts.map((product) => (
                  <div
                    key={product.id}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 hover:bg-violet-100 text-sm text-violet-800 transition-colors"
                  >
                    <button
                      onClick={() => onEditProduct?.(product)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <Package className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                      <span className="truncate font-medium">{product.name}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}