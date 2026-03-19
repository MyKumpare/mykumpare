import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import FirmTypeSection from "./FirmTypeSection";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

export default function FirmsSection({
  groupedFirms,
  totalFirms,
  products,
  searchQuery,
  onEdit,
  onDelete,
  onAddToType,
  onAddFirm,
  onAddProduct,
  onEditProduct,
  onAddPortfolio,
}) {
  const [expanded, setExpanded] = useState(false);

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
            Firms
          </span>
          <span className="text-xs text-gray-400 font-normal">({totalFirms})</span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={onAddFirm}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Firm
        </Button>
      </div>

      {/* Firm type sub-sections */}
      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100">
          {FIRM_TYPES.map((type) =>
            groupedFirms[type] ? (
              <FirmTypeSection
                key={type}
                type={type}
                firms={groupedFirms[type]}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddToType={onAddToType}
                onAddProduct={onAddProduct}
                onEditProduct={onEditProduct}
                onAddPortfolio={onAddPortfolio}
                forceExpand={!!searchQuery}
                products={products}
              />
            ) : null
          )}
          {Object.keys(groupedFirms).length === 0 && (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              {searchQuery ? "No firms found" : 'Click "Add Firm" to create your first firm'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}