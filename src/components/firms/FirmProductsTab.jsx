import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, Trash2, X } from "lucide-react";

const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];

function ProductRow({ product, onDelete, disabled }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <Package className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <div className="text-sm font-medium text-gray-800 truncate">{product.name}</div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="ml-2 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
        disabled={disabled}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function FirmProductsTab({ firmId, firmName }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", firmId],
    queryFn: () => base44.entities.Product.filter({ firm_id: firmId }),
    enabled: !!firmId,
  });

  const investmentManagerProducts = [...products]
    .filter(p => p.product_type === "Investment Manager Product")
    .sort((a, b) => a.name.localeCompare(b.name));

  const multiManagerProducts = [...products]
    .filter(p => p.product_type === "Multi-Manager Product")
    .sort((a, b) => a.name.localeCompare(b.name));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", firmId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setProductName("");
      setProductType("");
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", firmId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const handleAdd = () => {
    if (!productName.trim() || !productType) return;
    createMutation.mutate({
      name: productName.trim(),
      product_type: productType,
      firm_id: firmId,
      firm_name: firmName,
    });
  };

  const isValid = productName.trim() && productType;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-3.5 h-3.5" /> Add Product
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700">New Product</span>
            <button type="button" onClick={() => { setShowForm(false); setProductName(""); setProductType(""); }}>
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Product Name</Label>
              <Input
                autoFocus
                placeholder="Enter product name..."
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && isValid && handleAdd()}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Product Type</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowForm(false); setProductName(""); setProductType(""); }}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={!isValid || createMutation.isPending}
              onClick={handleAdd}
            >
              {createMutation.isPending ? "Adding..." : "Add Product"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : products.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No products added yet
        </div>
      ) : (
        <div className="space-y-4">
          {investmentManagerProducts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-0.5">Investment Manager Products</div>
              <div className="space-y-1.5">
                {investmentManagerProducts.map((product) => (
                  <ProductRow key={product.id} product={product} onDelete={() => deleteMutation.mutate(product.id)} disabled={deleteMutation.isPending} />
                ))}
              </div>
            </div>
          )}
          {multiManagerProducts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-0.5">Multi-Manager Products</div>
              <div className="space-y-1.5">
                {multiManagerProducts.map((product) => (
                  <ProductRow key={product.id} product={product} onDelete={() => deleteMutation.mutate(product.id)} disabled={deleteMutation.isPending} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}