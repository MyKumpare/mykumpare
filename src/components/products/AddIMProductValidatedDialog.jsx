import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared inline "Add IM Product" dialog that uses the SAME validation as
// AddProductDialog: requires firm + name, and blocks duplicate product names
// within the same firm (case-insensitive substring match).
export default function AddIMProductValidatedDialog({
  open,
  onOpenChange,
  firms = [],
  existingProducts = [],
  onCreated,
  preselectedFirmId,
}) {
  const [name, setName] = useState("");
  const [firmId, setFirmId] = useState("");
  const [saving, setSaving] = useState(false);

  const getFirmTypes = (f) =>
    f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];

  const imFirms = useMemo(
    () =>
      firms
        .filter((f) => getFirmTypes(f).includes("Investment Manager"))
        .map((f) => ({ value: f.id, label: f.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [firms]
  );

  useEffect(() => {
    if (open) {
      setName("");
      setFirmId(preselectedFirmId || "");
    }
  }, [open, preselectedFirmId]);

  const matchingProducts =
    name.trim().length >= 2
      ? existingProducts.filter((p) => {
          if (firmId && p.firm_id !== firmId) return false;
          const existing = (p.name || "").toLowerCase();
          const input = name.trim().toLowerCase();
          return existing.includes(input) || input.includes(existing);
        })
      : [];
  const isDuplicate = matchingProducts.length > 0;
  const isValid = firmId && name.trim() && !isDuplicate;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const firmName = firms.find((f) => f.id === firmId)?.name || "";
      const product = await base44.entities.Product.create({
        name: name.trim(),
        firm_id: firmId,
        firm_name: firmName,
        product_type: "Investment Manager Product",
      });
      onCreated?.(product);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add IM Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">
              Product Name <span className="text-red-400">*</span>
            </Label>
            <Input
              placeholder="Enter product name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn("h-9 text-sm", isDuplicate && "border-amber-400 focus-visible:ring-amber-400")}
              onKeyDown={(e) => e.key === "Enter" && isValid && handleSave()}
              autoFocus
            />
            {matchingProducts.length > 0 && (
              <div className="mt-1.5 space-y-1">
                <p className="text-xs font-medium text-amber-600">
                  Similar product already in the system:
                </p>
                {matchingProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                      {p.firm_name && <p className="text-xs text-gray-500 truncate">{p.firm_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">
              Investment Manager Firm <span className="text-red-400">*</span>
            </Label>
            <SearchableSelect
              options={imFirms}
              value={firmId}
              onChange={setFirmId}
              placeholder="Select IM firm..."
            />
            {imFirms.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No Investment Manager firms found. Add one first.
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!isValid || saving}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? "Adding..." : "Add Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Lightweight searchable single-select (firm picker) reused inside this dialog.
function SearchableSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-9 text-sm font-normal"
          type="button"
        >
          <span className={selected ? "text-gray-900" : "text-gray-400"}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-52 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 italic">No results</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => { onChange(opt.value); setOpen(false); setSearch(""); }}
              >
                <Check className={cn("w-3.5 h-3.5 shrink-0", value === opt.value ? "opacity-100 text-indigo-600" : "opacity-0")} />
                {opt.label}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}