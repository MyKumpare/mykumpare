import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Search, Check, Plus, Building2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

const FIRM_TYPE_OPTIONS = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

/**
 * Firm picker for the Send Questionnaire dialog.
 * - Filter by firm type
 * - Alphabetical sort
 * - Add a new firm inline when search returns no match
 */
export default function QuestionnaireFirmPicker({
  value,
  onChange,
  firms = [],
  user,
  placeholder = "Select a firm...",
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [adding, setAdding] = useState(false);

  const sortedFirms = useMemo(
    () => [...firms].filter((f) => !f.deleted_at).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [firms]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sortedFirms.filter((f) => {
      if (typeFilter !== "all" && !(f.firm_types || []).includes(typeFilter) && f.firm_type !== typeFilter) {
        return false;
      }
      if (!q) return true;
      return (f.name || "").toLowerCase().includes(q);
    });
  }, [sortedFirms, search, typeFilter]);

  const selectedLabel = value
    ? firms.find((f) => f.id === value)?.name || placeholder
    : placeholder;

  const canAddNew = search.trim().length > 0 && filtered.length === 0 && !adding;

  const handleAddNew = async () => {
    const name = search.trim();
    if (!name) return;
    setAdding(true);
    try {
      const created = await base44.entities.Firm.create({
        name,
        tenant_id: user?.linked_firm_id,
      });
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      toast({ title: "Firm created", description: `"${name}" was added.` });
      onChange(created.id, created);
      setOpen(false);
      setSearch("");
    } catch (err) {
      toast({ title: "Failed to create firm", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
          onClick={() => setOpen(!open)}
        >
          <span className={value ? "text-gray-900" : "text-gray-400"}>{selectedLabel}</span>
          <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
        {/* Firm type filter */}
        <div className="p-2 border-b">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All firm types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All firm types</SelectItem>
              {FIRM_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              autoFocus
              placeholder="Search firms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        </div>
        {/* List */}
        <div className="max-h-[200px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400">
              {search.trim() ? "No firms match your search." : "No firms found."}
            </div>
          ) : (
            filtered.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { onChange(f.id, f); setOpen(false); setSearch(""); }}
                className="flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-gray-50 text-left"
              >
                <span className="truncate">{f.name}</span>
                {value === f.id && <Check className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 ml-2" />}
              </button>
            ))
          )}
        </div>
        {/* Add new */}
        {canAddNew && (
          <div className="border-t p-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-start text-indigo-600"
              onClick={handleAddNew}
              disabled={adding}
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {adding ? "Creating..." : `Add new firm: "${search.trim()}"`}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}