import React from "react";
import { motion } from "framer-motion";
import { Building2, Plus } from "lucide-react";

const FIRM_TYPE_TO_PRODUCT_TYPE = {
  "Investment Manager": "Investment Manager Product",
  "Manager of Managers": "Multi-Manager Product",
};

export default function FirmCard({ firm, onEdit, onDelete, onAddProduct }) {
  const productType = FIRM_TYPE_TO_PRODUCT_TYPE[firm.firm_type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="group flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
    >
      <button
        className="flex items-center gap-3 min-w-0 flex-1 text-left"
        onClick={() => onEdit(firm)}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-indigo-600" />
        </div>
        <span className="font-medium text-gray-900 truncate hover:text-indigo-600 transition-colors">{firm.name}</span>
      </button>
      {productType && onAddProduct && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddProduct(firm, productType); }}
          className="flex-shrink-0 ml-2 w-7 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 flex items-center justify-center text-violet-600 transition-colors opacity-0 group-hover:opacity-100"
          title={`Add ${productType}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}