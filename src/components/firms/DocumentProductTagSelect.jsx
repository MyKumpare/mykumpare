import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import AddIMProductValidatedDialog from "@/components/products/AddIMProductValidatedDialog";

// Multi-select of products for a firm, with validated "add new product".
// Reuses AddIMProductValidatedDialog so duplicate validation (accept/use-existing
// or block) is identical to the main product creation flow.
export default function DocumentProductTagSelect({
  firmId,
  value = [],
  onChange,
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["firm-products", firmId],
    queryFn: () =>
      base44.entities.Product.filter({ firm_id: firmId }, "-created_date", 500),
    enabled: !!firmId,
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 500),
  });

  const activeProducts = useMemo(
    () => products.filter((p) => !p.deleted_at),
    [products]
  );

  const filtered = useMemo(
    () =>
      activeProducts.filter((p) =>
        (p.name || "").toLowerCase().includes(search.toLowerCase())
      ),
    [activeProducts, search]
  );

  const selected = activeProducts.filter((p) => value.includes(p.id));

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const remove = (id) => onChange(value.filter((x) => x !== id));

  return (
    <div className="space-y-1.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded"
            >
              {p.name}
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="hover:text-indigo-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between h-9 text-sm font-normal"
          >
            <span className="text-gray-400">Search or add product...</span>
            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400 italic">
                No products found
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => toggle(p.id)}
                >
                  <Check
                    className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      value.includes(p.id)
                        ? "opacity-100 text-indigo-600"
                        : "opacity-0"
                    )}
                  />
                  <span className="truncate">{p.name}</span>
                </button>
              ))
            )}
          </div>
          <div className="border-t p-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={() => {
                setOpen(false);
                setAddOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Add New Product
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <AddIMProductValidatedDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        firms={firms}
        existingProducts={activeProducts}
        preselectedFirmId={firmId}
        onCreated={(product) => {
          queryClient.invalidateQueries({ queryKey: ["firm-products", firmId] });
          onChange([...value, product.id]);
          toast({ title: "Product added & tagged", description: product.name });
        }}
      />
    </div>
  );
}