import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Plus, Package, ChevronDown, ChevronRight, LayoutList } from "lucide-react";

const FIRM_TYPE_TO_PRODUCT_TYPE = {
  "Investment Manager": "Investment Manager Product",
  "Manager of Managers": "Multi-Manager Product",
};

export default function FirmCard({ firm, onEdit, onDelete, onAddProduct, onEditProduct, products = [], forceExpand = false }) {
  const ALLOWED_FIRM_TYPES = ["Investment Manager", "Manager of Managers"];
  const effectiveTypes = firm.firm_types?.length > 0 ? firm.firm_types : (firm.firm_type ? [firm.firm_type] : []);
  const allowedType = effectiveTypes.find(t => ALLOWED_FIRM_TYPES.includes(t));
  const productType = allowedType ? FIRM_TYPE_TO_PRODUCT_TYPE[allowedType] : null;
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
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Logo / icon — clicking opens form */}
          <button
            className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-indigo-300 transition-all"
            onClick={() => onEdit(firm)}
          >
            {firm.logo_url ? (
              <img src={firm.logo_url} alt={firm.name} className="w-full h-full object-contain p-1" />
            ) : (
              <Building2 className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* Firm name — clicking opens form */}
          <button
            className="font-medium text-gray-900 truncate hover:text-indigo-600 transition-colors text-left"
            onClick={() => onEdit(firm)}
          >
            {firm.name}
          </button>

          {/* Product count + chevron — clicking toggles expansion */}
          {showProducts && (
            <button
              className="flex items-center gap-1 flex-shrink-0 ml-1"
              onClick={() => setExpanded((v) => !v)}
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
          {showProducts && onAddProduct && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddProduct(firm, productType); }}
              className="flex items-center gap-1 px-2 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 transition-colors opacity-0 group-hover:opacity-100"
              title={`Add ${productType}`}
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs font-medium whitespace-nowrap">Add Product</span>
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
                  <button
                    key={product.id}
                    onClick={() => onEditProduct?.(product)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 hover:bg-violet-100 text-sm text-violet-800 transition-colors text-left"
                  >
                    <Package className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                    <span className="truncate font-medium">{product.name}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}