import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, Star, StarOff, Plus, Check } from "lucide-react";

const PRODUCT_TYPE_ORDER = ["Investment Manager Product", "Multi-Manager Product"];

function groupByType(products) {
  const grouped = {};
  PRODUCT_TYPE_ORDER.forEach(type => {
    const items = products.filter(p => p.product_type === type);
    if (items.length > 0) grouped[type] = items;
  });
  products.forEach(p => {
    if (!PRODUCT_TYPE_ORDER.includes(p.product_type) && p.product_type && !grouped[p.product_type]) {
      grouped[p.product_type] = products.filter(x => x.product_type === p.product_type);
    }
  });
  return grouped;
}

export default function ContactProductsTab({ contactId, firmIds = [], onProductClick }) {
  const queryClient = useQueryClient();
  // Track pending key state for "available" products before saving
  const [pendingKeys, setPendingKeys] = useState({}); // productId -> boolean

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
    enabled: !!contactId,
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({ productId, newTeam }) =>
      base44.entities.Product.update(productId, { investment_team: newTeam }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  if (!contactId) return null;

  // Products this contact is already on
  const myProducts = allProducts
    .filter(p => p.investment_team?.some(m => m.contact_id === contactId))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Other products from the same firm(s) — not yet on team
  const availableProducts = allProducts
    .filter(p =>
      !p.investment_team?.some(m => m.contact_id === contactId) &&
      firmIds.some(fid => p.firm_id === fid)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleAddToProduct = (product) => {
    const isKey = pendingKeys[product.id] || false;
    const currentTeam = product.investment_team || [];
    const newTeam = [...currentTeam, { contact_id: contactId, is_key: isKey }];
    updateTeamMutation.mutate({ productId: product.id, newTeam });
    setPendingKeys(prev => { const next = { ...prev }; delete next[product.id]; return next; });
  };

  const handleRemoveFromProduct = (product) => {
    const newTeam = (product.investment_team || []).filter(m => m.contact_id !== contactId);
    updateTeamMutation.mutate({ productId: product.id, newTeam });
  };

  const handleToggleKey = (product) => {
    const currentTeam = product.investment_team || [];
    const newTeam = currentTeam.map(m =>
      m.contact_id === contactId ? { ...m, is_key: !m.is_key } : m
    );
    updateTeamMutation.mutate({ productId: product.id, newTeam });
  };

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-gray-400">Loading...</div>;
  }

  const myGrouped = groupByType(myProducts);
  const availableGrouped = groupByType(availableProducts);
  const hasAnything = myProducts.length > 0 || availableProducts.length > 0;

  if (!hasAnything) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <Package className="w-8 h-8 text-gray-300" />
        <p className="text-sm text-gray-400 italic">No products associated with this contact's firm(s).</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Products the contact is ON ── */}
      {myProducts.length > 0 && (
        <div className="space-y-3">
          {Object.entries(myGrouped).map(([type, products]) => (
            <div key={type}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{type}</p>
              <div className="rounded-lg border border-indigo-200 divide-y divide-indigo-100 overflow-hidden">
                {products.map(product => {
                  const member = product.investment_team?.find(m => m.contact_id === contactId);
                  const isKey = member?.is_key || false;
                  return (
                    <div key={product.id} className="flex items-center gap-2 px-3 py-2.5 bg-indigo-50">
                      {/* Product name — clickable to open */}
                      <button
                        type="button"
                        onClick={() => onProductClick && onProductClick(product)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="text-sm font-medium text-indigo-700 hover:underline truncate">{product.name}</div>
                        {product.firm_name && (
                          <div className="text-xs text-indigo-400 mt-0.5">{product.firm_name}</div>
                        )}
                      </button>

                      {/* Key toggle */}
                      <button
                        type="button"
                        title={isKey ? "Remove key flag" : "Flag as key"}
                        onClick={() => handleToggleKey(product)}
                        className="p-1 rounded hover:bg-amber-100 transition-colors flex-shrink-0"
                        disabled={updateTeamMutation.isPending}
                      >
                        {isKey
                          ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          : <StarOff className="w-4 h-4 text-gray-300 hover:text-amber-400" />}
                      </button>

                      {/* Remove */}
                      <button
                        type="button"
                        title="Remove from investment team"
                        onClick={() => handleRemoveFromProduct(product)}
                        className="p-1 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                        disabled={updateTeamMutation.isPending}
                      >
                        <Check className="w-4 h-4 text-indigo-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Available products (same firm, not yet on team) ── */}
      {availableProducts.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Other Products from Firm — Click to Join Investment Team
          </p>
          {Object.entries(availableGrouped).map(([type, products]) => (
            <div key={type}>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">{type}</p>
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {products.map(product => {
                  const pendingKey = pendingKeys[product.id] || false;
                  return (
                    <div key={product.id} className="flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-gray-50 transition-colors">
                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-400 truncate">{product.name}</div>
                        {product.firm_name && (
                          <div className="text-xs text-gray-300 mt-0.5">{product.firm_name}</div>
                        )}
                      </div>

                      {/* Key toggle (pre-select before adding) */}
                      <button
                        type="button"
                        title={pendingKey ? "Will be added as key" : "Mark as key when adding"}
                        onClick={() => setPendingKeys(prev => ({ ...prev, [product.id]: !prev[product.id] }))}
                        className="p-1 rounded hover:bg-amber-50 transition-colors flex-shrink-0"
                      >
                        {pendingKey
                          ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          : <StarOff className="w-4 h-4 text-gray-300 hover:text-amber-400" />}
                      </button>

                      {/* Add button */}
                      <button
                        type="button"
                        title="Add to investment team"
                        onClick={() => handleAddToProduct(product)}
                        disabled={updateTeamMutation.isPending}
                        className="p-1 rounded hover:bg-indigo-50 transition-colors flex-shrink-0"
                      >
                        <Plus className="w-4 h-4 text-gray-300 hover:text-indigo-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}