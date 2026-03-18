import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package } from "lucide-react";

const PRODUCT_TYPE_ORDER = ["Investment Manager Product", "Multi-Manager Product"];

export default function ContactProductsTab({ contactId, onProductClick }) {
  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
    enabled: !!contactId,
  });

  // Find products where this contact is on the investment team
  const contactProducts = allProducts
    .filter(p => p.investment_team?.some(m => m.contact_id === contactId))
    .sort((a, b) => a.name.localeCompare(b.name));

  const grouped = PRODUCT_TYPE_ORDER.reduce((acc, type) => {
    const items = contactProducts.filter(p => p.product_type === type);
    if (items.length > 0) acc[type] = items;
    return acc;
  }, {});

  // Also catch any types not in the predefined order
  contactProducts.forEach(p => {
    if (!PRODUCT_TYPE_ORDER.includes(p.product_type) && p.product_type) {
      if (!grouped[p.product_type]) grouped[p.product_type] = [];
      if (!grouped[p.product_type].find(x => x.id === p.id)) grouped[p.product_type].push(p);
    }
  });

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-gray-400">Loading...</div>;
  }

  if (contactProducts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <Package className="w-8 h-8 text-gray-300" />
        <p className="text-sm text-gray-400 italic">No products associated with this contact.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, products]) => (
        <div key={type}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{type}</p>
          <div className="rounded-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {products.map(product => (
              <button
                key={product.id}
                type="button"
                onClick={() => onProductClick && onProductClick(product)}
                className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <div className="text-sm font-medium text-indigo-700 group-hover:text-indigo-800">{product.name}</div>
                {product.firm_name && (
                  <div className="text-xs text-gray-400 mt-0.5">{product.firm_name}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}