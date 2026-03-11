import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Plus, Package, ChevronDown, ChevronRight } from "lucide-react";

const FIRM_TYPE_TO_PRODUCT_TYPE = {
  "Investment Manager": "Investment Manager Product",
  "Manager of Managers": "Multi-Manager Product",
};

export default function FirmCard({ firm, onEdit, onDelete, onAddProduct, onEditProduct, products = [], forceExpand = false }) {
  const productType = FIRM_TYPE_TO_PRODUCT_TYPE[firm.firm_type];
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpand || expanded;

  const firmProducts = products.filter((p) => p.firm_id === firm.id).sort((a, b) => a.name.localeCompare(b.name));
  const showProducts = !!productType;

  const handleFirmClick = () => {
    if (showProducts) {
      setExpanded((v) => !v);
    } else {
      onEdit(firm);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
    >
      <div className="group flex items-center justify-between p-4">
        <button
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
          onClick={handleFirmClick}
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="font-medium text-gray-900 truncate hover:text-indigo-600 transition-colors">{firm.name}</span>
          {showProducts && (
            <span className="flex-shrink-0 text-xs text-gray-400 font-medium ml-1">
              {firmProducts.length > 0 ? `${firmProducts.length}` : ""}
            </span>
          )}
          {showProducts && (
            isExpanded
              ? <ChevronDown className="flex-shrink-0 w-4 h-4 text-gray-400" />
              : <ChevronRight className="flex-shrink-0 w-4 h-4 text-gray-400" />
          )}
        </button>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {showProducts && onAddProduct && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddProduct(firm, productType); }}
              className="w-7 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 flex items-center justify-center text-violet-600 transition-colors opacity-0 group-hover:opacity-100"
              title={`Add ${productType}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          {!showProducts && (
            <button
              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onEdit(firm); }}
              title="Edit firm"
            />
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