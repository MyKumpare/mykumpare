import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Package } from "lucide-react";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const PRODUCT_TYPES = [
  "Investment Manager Product",
  "Multi-Manager Product",
];

const TYPE_COLORS = {
  "Manager of Managers": "bg-violet-100 text-violet-700",
  "Investment Manager": "bg-blue-100 text-blue-700",
  "Allocator": "bg-emerald-100 text-emerald-700",
  "Investment Consultant": "bg-amber-100 text-amber-700",
  "Securities Brokerage": "bg-rose-100 text-rose-700",
  "Trade Organizations": "bg-cyan-100 text-cyan-700",
  "Investment Manager Product": "bg-blue-100 text-blue-700",
  "Multi-Manager Product": "bg-violet-100 text-violet-700",
};

export default function StatsListModal({ open, onOpenChange, mode, firms = [], products = [] }) {
  const isFirms = mode === "firms";

  const renderFirms = () => {
    return FIRM_TYPES.map((type) => {
      const group = firms
        .filter((f) => f.firm_type === type)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (group.length === 0) return null;
      return (
        <div key={type} className="mb-5">
          <div className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider mb-2 ${TYPE_COLORS[type] || "bg-gray-100 text-gray-700"}`}>
            {type}
          </div>
          <div className="space-y-1">
            {group.map((firm) => (
              <div key={firm.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-800">
                <Building2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span>{firm.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  const renderProducts = () => {
    return PRODUCT_TYPES.map((type) => {
      const group = products
        .filter((p) => p.product_type === type)
        .sort((a, b) => {
          const firmCmp = (a.firm_name || "").localeCompare(b.firm_name || "");
          return firmCmp !== 0 ? firmCmp : a.name.localeCompare(b.name);
        });
      if (group.length === 0) return null;
      return (
        <div key={type} className="mb-5">
          <div className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider mb-2 ${TYPE_COLORS[type] || "bg-gray-100 text-gray-700"}`}>
            {type}
          </div>
          <div className="space-y-1">
            {group.map((product) => (
              <div key={product.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-800">
                <Package className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                <span className="truncate">{product.name}</span>
                {product.firm_name && (
                  <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{product.firm_name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFirms ? <Building2 className="w-4 h-4 text-indigo-500" /> : <Package className="w-4 h-4 text-violet-500" />}
            {isFirms ? `All Firms (${firms.length})` : `All Products (${products.length})`}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-1">
          {isFirms ? renderFirms() : renderProducts()}
        </div>
      </DialogContent>
    </Dialog>
  );
}