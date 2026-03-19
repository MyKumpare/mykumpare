import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Plus, X, ChevronDown, Check, Pencil, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import AddFirmDialog from "@/components/firms/AddFirmDialog";

// ── Searchable dropdown ────────────────────────────────────────────────────────
function SearchableSelect({ options, value, onChange, placeholder, onAddNew, addNewLabel }) {
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
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400 italic">No results</div>
          )}
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => { onChange(opt.value); setOpen(false); setSearch(""); }}
            >
              <Check className={cn("w-3.5 h-3.5 shrink-0", value === opt.value ? "opacity-100 text-indigo-600" : "opacity-0")} />
              {opt.label}
            </button>
          ))}
        </div>
        {onAddNew && (
          <div className="border-t p-1">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 rounded"
              onClick={() => { setOpen(false); setSearch(""); onAddNew(); }}
            >
              <Plus className="w-3.5 h-3.5" />
              {addNewLabel || "Add new..."}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Date picker helper ─────────────────────────────────────────────────────────
function DatePicker({ value, onChange, minDate, placeholder = "Select date...", error }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full h-9 text-sm justify-start font-normal", error && "border-red-400")}
            type="button"
          >
            <CalendarIcon className="w-3.5 h-3.5 mr-2 text-gray-400" />
            {value ? format(value, "MMM d, yyyy") : <span className="text-gray-400">{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => { onChange(d); setOpen(false); }}
            disabled={minDate ? (d) => d < minDate : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Multi-select product picker ────────────────────────────────────────────────
function ProductMultiSelect({ options, value = [], onChange, onAddNew, momInceptionDate, portfolioInceptionDate }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  const toggle = (opt) => {
    const exists = value.find((v) => v.product_id === opt.value);
    if (exists) {
      onChange(value.filter((v) => v.product_id !== opt.value));
    } else {
      onChange([...value, { product_id: opt.value, product_name: opt.label, firm_name: opt.firm_name, inception_date: "" }]);
    }
  };

  const updateInceptionDate = (productId, date) => {
    onChange(value.map((v) => v.product_id === productId ? { ...v, inception_date: date ? format(date, "yyyy-MM-dd") : "" } : v));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal" type="button">
            <span className="text-gray-400">
              {value.length === 0 ? "Select sub-managers..." : `${value.length} selected`}
            </span>
            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
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
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400 italic">No results</div>
            )}
            {filtered.map((opt) => {
              const selected = !!value.find((v) => v.product_id === opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => toggle(opt)}
                >
                  <div className={cn("w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center", selected ? "bg-indigo-600 border-indigo-600" : "border-gray-300")}>
                    {selected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{opt.label}</div>
                    {opt.firm_name && <div className="text-xs text-gray-400 truncate">{opt.firm_name}</div>}
                  </div>
                </button>
              );
            })}
          </div>
          {onAddNew && (
            <div className="border-t p-1">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 rounded"
                onClick={() => { setOpen(false); setSearch(""); onAddNew(); }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add new IM product...
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Selected items with inception date inputs */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((v) => {
            const subDate = v.inception_date ? parseISO(v.inception_date) : null;
            // The effective minimum is the later of portfolio inception date and MoM inception date
            const effectiveMin = momInceptionDate && portfolioInceptionDate
              ? (momInceptionDate > portfolioInceptionDate ? momInceptionDate : portfolioInceptionDate)
              : momInceptionDate || portfolioInceptionDate || undefined;
            const isBeforeMoM = momInceptionDate && subDate && subDate < momInceptionDate;
            const isBeforePortfolio = portfolioInceptionDate && subDate && subDate < portfolioInceptionDate;
            const subError = isBeforeMoM
              ? "Cannot be before MoM inception date"
              : isBeforePortfolio
              ? "Cannot be before portfolio inception date"
              : undefined;
            return (
              <div key={v.product_id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate block">{v.product_name}</span>
                    {v.firm_name && <span className="text-xs text-gray-400">{v.firm_name}</span>}
                  </div>
                  <button type="button" onClick={() => onChange(value.filter((x) => x.product_id !== v.product_id))} className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Inception Date <span className="text-red-400">*</span></Label>
                  <div className="mt-1">
                    <DatePicker
                      value={subDate}
                      onChange={(d) => updateInceptionDate(v.product_id, d)}
                      minDate={effectiveMin}
                      error={subError}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main dialog ────────────────────────────────────────────────────────────────
export default function AddPortfolioDialog({ open, onOpenChange, onSuccess, preselectedAllocatorId, editingPortfolio, preselectedAdvisorFirmId, preselectedAdvisorType, onDelete }) {
  const queryClient = useQueryClient();

  // Form state
  const [allocatorId, setAllocatorId] = useState("");
  const [portfolioName, setPortfolioName] = useState("");
  const [inceptionDate, setInceptionDate] = useState(null);
  const [advisorType, setAdvisorType] = useState("");
  const [advisorFirmId, setAdvisorFirmId] = useState("");
  const [advisorInceptionDate, setAdvisorInceptionDate] = useState(null);
  const [subManagers, setSubManagers] = useState([]);

  // View mode: when opening an existing portfolio, start in view mode
  const [isEditing, setIsEditing] = useState(false);

  // Inline add-firm dialog state
  const [addFirmOpen, setAddFirmOpen] = useState(false);
  const [addFirmPreselectedType, setAddFirmPreselectedType] = useState(null);
  // What we do after a new firm is saved
  const [pendingFirmTarget, setPendingFirmTarget] = useState(null); // "allocator" | "advisor"

  // Add product dialog (for adding a new IM product)
  const [addProductOpen, setAddProductOpen] = useState(false);

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });

  // Reset on open
  useEffect(() => {
    if (open) {
      setIsEditing(!editingPortfolio); // view mode when editing, edit mode when adding
      if (editingPortfolio) {
        setAllocatorId(editingPortfolio.firm_id || "");
        setPortfolioName(editingPortfolio.portfolio_name || "");
        setInceptionDate(editingPortfolio.inception_date ? parseISO(editingPortfolio.inception_date) : null);
        setAdvisorType(editingPortfolio.advisor_type || "");
        setAdvisorFirmId(editingPortfolio.advisor_firm_id || "");
        setAdvisorInceptionDate(editingPortfolio.advisor_inception_date ? parseISO(editingPortfolio.advisor_inception_date) : null);
        setSubManagers(editingPortfolio.sub_managers || []);
      } else {
        setAllocatorId(preselectedAllocatorId || "");
        setPortfolioName("");
        setInceptionDate(null);
        setAdvisorType(preselectedAdvisorType || "");
        setAdvisorFirmId(preselectedAdvisorFirmId || "");
        setAdvisorInceptionDate(null);
        setSubManagers([]);
      }
    }
  }, [open, preselectedAllocatorId, editingPortfolio]);

  // Reset advisor fields when advisor type changes (but not on initial mount/open)
  const isFirstAdvisorTypeChange = useRef(true);
  useEffect(() => {
    if (isFirstAdvisorTypeChange.current) {
      isFirstAdvisorTypeChange.current = false;
      return;
    }
    setAdvisorFirmId("");
    setAdvisorInceptionDate(null);
    setSubManagers([]);
  }, [advisorType]);

  // Reset the ref when dialog opens/closes
  useEffect(() => {
    isFirstAdvisorTypeChange.current = true;
  }, [open]);

  const getFirmTypes = (f) =>
    f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];

  const allocatorOptions = useMemo(
    () =>
      firms
        .filter((f) => getFirmTypes(f).includes("Allocator"))
        .map((f) => ({ value: f.id, label: f.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [firms]
  );

  const momOptions = useMemo(
    () =>
      firms
        .filter((f) => getFirmTypes(f).includes("Manager of Managers"))
        .map((f) => ({ value: f.id, label: f.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [firms]
  );

  const imOptions = useMemo(
    () =>
      firms
        .filter((f) => getFirmTypes(f).includes("Investment Manager"))
        .map((f) => ({ value: f.id, label: f.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [firms]
  );

  // IM products for sub-manager picker
  const imProductOptions = useMemo(() => {
    const imFirmIds = new Set(
      firms.filter((f) => getFirmTypes(f).includes("Investment Manager")).map((f) => f.id)
    );
    return products
      .filter((p) => imFirmIds.has(p.firm_id))
      .map((p) => ({ value: p.id, label: p.name, firm_name: p.firm_name || "" }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [firms, products]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Portfolio.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Portfolio.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
  });

  const handleSave = () => {
    const allocatorFirm = firms.find((f) => f.id === allocatorId);
    const advisorFirm = firms.find((f) => f.id === advisorFirmId);
    const payload = {
      firm_id: allocatorId,
      allocator_name: allocatorFirm?.name || "",
      portfolio_name: portfolioName.trim(),
      inception_date: inceptionDate ? format(inceptionDate, "yyyy-MM-dd") : "",
      advisor_type: advisorType || undefined,
      advisor_firm_id: advisorFirmId || undefined,
      advisor_firm_name: advisorFirm?.name || undefined,
      advisor_inception_date: advisorType && advisorInceptionDate ? format(advisorInceptionDate, "yyyy-MM-dd") : undefined,
      sub_managers: advisorType === "Manager of Managers" ? subManagers : undefined,
    };
    if (editingPortfolio) {
      updateMutation.mutate({ id: editingPortfolio.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Open AddFirmDialog for allocator
  const handleAddAllocator = () => {
    setPendingFirmTarget("allocator");
    setAddFirmPreselectedType("Allocator");
    setAddFirmOpen(true);
  };

  // Open AddFirmDialog for advisor firm
  const handleAddAdvisorFirm = () => {
    setPendingFirmTarget("advisor");
    setAddFirmPreselectedType(advisorType || null);
    setAddFirmOpen(true);
  };

  // Called when AddFirmDialog saves
  const handleFirmSubmit = async (firmData) => {
    const created = await base44.entities.Firm.create(firmData);
    queryClient.invalidateQueries({ queryKey: ["firms"] });
    if (pendingFirmTarget === "allocator") setAllocatorId(created.id);
    if (pendingFirmTarget === "advisor") setAdvisorFirmId(created.id);
    setAddFirmOpen(false);
  };

  const advisorFirmOptions = advisorType === "Manager of Managers" ? momOptions : imOptions;

  const momInceptionDate = advisorType === "Manager of Managers" ? advisorInceptionDate : null;

  const subManagersValid =
    advisorType !== "Manager of Managers" ||
    subManagers.every((s) => {
      if (!s.inception_date) return false;
      const d = parseISO(s.inception_date);
      if (momInceptionDate && d < momInceptionDate) return false;
      if (inceptionDate && d < inceptionDate) return false;
      return true;
    });

  const advisorDateValid = !advisorType || (
    advisorInceptionDate &&
    (!inceptionDate || advisorInceptionDate >= inceptionDate)
  );

  const isValid =
    allocatorId &&
    portfolioName.trim() &&
    inceptionDate &&
    advisorDateValid &&
    subManagersValid;

  const viewAllocatorName = firms.find((f) => f.id === allocatorId)?.name || allocatorId;
  const viewAdvisorFirmName = firms.find((f) => f.id === advisorFirmId)?.name || advisorFirmId;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              {editingPortfolio && !isEditing ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <LayoutList className="w-5 h-5 text-gray-300" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-base font-semibold leading-tight">Portfolio Details</DialogTitle>
                    <p className="text-sm text-indigo-600 font-medium mt-0.5 truncate">{portfolioName}</p>
                  </div>
                </div>
              ) : (
                <DialogTitle className="text-xl font-semibold">
                  {editingPortfolio ? "Edit Portfolio" : "Add Portfolio"}
                </DialogTitle>
              )}
              {editingPortfolio && !isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1.5"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* View mode */}
          {editingPortfolio && !isEditing ? (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Allocator</p>
                  <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{viewAllocatorName || <span className="text-gray-400">—</span>}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Inception Date</p>
                  <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">
                    {inceptionDate ? format(inceptionDate, "MMM d, yyyy") : <span className="text-gray-400">—</span>}
                  </p>
                </div>
              </div>
              {advisorType && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Advisor Type</p>
                    <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{advisorType}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Advisor Firm</p>
                    <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{viewAdvisorFirmName || <span className="text-gray-400">—</span>}</p>
                  </div>
                </div>
              )}
              {advisorType && advisorInceptionDate && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">{advisorType === "Manager of Managers" ? "MoM" : "Investment Manager"} Inception Date</p>
                  <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{format(advisorInceptionDate, "MMM d, yyyy")}</p>
                </div>
              )}
              {subManagers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Sub-Managers</p>
                  <div className="space-y-1.5">
                    {subManagers.map((sm) => (
                      <div key={sm.product_id} className="px-3 py-2 rounded-md border bg-gray-50 text-sm">
                        <span className="font-medium text-gray-800">{sm.product_name}</span>
                        {sm.firm_name && <span className="text-gray-400 ml-1">· {sm.firm_name}</span>}
                        {sm.inception_date && <span className="text-gray-400 ml-1">· {format(parseISO(sm.inception_date), "MMM d, yyyy")}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Edit / Add mode */
            <div className="space-y-4 py-2">
              {/* Allocator Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">
                  Allocator Name <span className="text-red-400">*</span>
                </Label>
                <SearchableSelect
                  options={allocatorOptions}
                  value={allocatorId}
                  onChange={setAllocatorId}
                  placeholder="Select allocator..."
                  onAddNew={handleAddAllocator}
                  addNewLabel="Add new Allocator..."
                />
              </div>

              {/* Portfolio Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">
                  Portfolio Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder="Enter portfolio name..."
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              {/* Inception Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">
                  Inception Date <span className="text-red-400">*</span>
                </Label>
                <DatePicker value={inceptionDate} onChange={setInceptionDate} />
              </div>

              {/* Advisor Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Advisor Type</Label>
                <div className="flex gap-2">
                  {["Manager of Managers", "Investment Manager"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAdvisorType(advisorType === t ? "" : t)}
                      className={cn(
                        "flex-1 h-9 rounded-md border text-sm font-medium transition-colors",
                        advisorType === t
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advisor Firm (conditional) */}
              {advisorType && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">
                    {advisorType === "Manager of Managers" ? "Manager of Managers Firm" : "Investment Manager Firm"}
                  </Label>
                  <SearchableSelect
                    options={advisorFirmOptions}
                    value={advisorFirmId}
                    onChange={setAdvisorFirmId}
                    placeholder={`Select ${advisorType}...`}
                    onAddNew={handleAddAdvisorFirm}
                    addNewLabel={`Add new ${advisorType}...`}
                  />
                </div>
              )}

              {/* Advisor Inception Date (conditional) */}
              {advisorType && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">
                    {advisorType === "Manager of Managers" ? "MoM" : "Investment Manager"} Inception Date <span className="text-red-400">*</span>
                  </Label>
                  <DatePicker
                    value={advisorInceptionDate}
                    onChange={setAdvisorInceptionDate}
                    minDate={inceptionDate || undefined}
                    error={advisorInceptionDate && inceptionDate && advisorInceptionDate < inceptionDate
                      ? "Cannot be before portfolio inception date"
                      : undefined}
                  />
                </div>
              )}

              {/* Sub-managers (only for MoM) */}
              {advisorType === "Manager of Managers" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Sub-Managers (IM Products)</Label>
                  <ProductMultiSelect
                    options={imProductOptions}
                    value={subManagers}
                    onChange={setSubManagers}
                    onAddNew={() => setAddProductOpen(true)}
                    momInceptionDate={advisorInceptionDate}
                    portfolioInceptionDate={inceptionDate}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2 border-t">
            <div>
              {editingPortfolio && onDelete && (
                <Button
                  variant="ghost"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 w-full sm:w-auto"
                  onClick={() => { onOpenChange(false); onDelete(editingPortfolio); }}
                >
                  Delete Portfolio
                </Button>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              {editingPortfolio && !isEditing ? (
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              ) : editingPortfolio && isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button
                    onClick={handleSave}
                    disabled={!isValid || updateMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button
                    onClick={handleSave}
                    disabled={!isValid || createMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Save Portfolio
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Add Firm dialog */}
      <AddFirmDialog
        open={addFirmOpen}
        onOpenChange={(o) => { if (!o) setAddFirmOpen(false); }}
        onSubmit={handleFirmSubmit}
        editingFirm={null}
        preselectedType={addFirmPreselectedType}
        existingFirms={firms}
      />

      {/* Add IM Product mini-dialog */}
      {addProductOpen && (
        <AddIMProductInlineDialog
          open={addProductOpen}
          onOpenChange={setAddProductOpen}
          firms={firms}
          onCreated={(product) => {
            queryClient.invalidateQueries({ queryKey: ["products"] });
            setSubManagers((prev) => [
              ...prev,
              { product_id: product.id, product_name: product.name, firm_name: product.firm_name || "" },
            ]);
          }}
        />
      )}
    </>
  );
}

// ── Lightweight inline Add IM Product dialog ───────────────────────────────────
function AddIMProductInlineDialog({ open, onOpenChange, firms, onCreated }) {
  const [name, setName] = useState("");
  const [firmId, setFirmId] = useState("");
  const [saving, setSaving] = useState(false);

  const imFirms = useMemo(() => {
    const getFirmTypes = (f) =>
      f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
    return firms
      .filter((f) => getFirmTypes(f).includes("Investment Manager"))
      .map((f) => ({ value: f.id, label: f.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [firms]);

  useEffect(() => {
    if (open) { setName(""); setFirmId(""); }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim() || !firmId) return;
    setSaving(true);
    const firmName = firms.find((f) => f.id === firmId)?.name || "";
    const product = await base44.entities.Product.create({
      name: name.trim(),
      firm_id: firmId,
      firm_name: firmName,
      product_type: "Investment Manager Product",
    });
    setSaving(false);
    onCreated(product);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add IM Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Product Name <span className="text-red-400">*</span></Label>
            <Input placeholder="Enter product name..." value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Investment Manager Firm <span className="text-red-400">*</span></Label>
            <SearchableSelect
              options={imFirms}
              value={firmId}
              onChange={setFirmId}
              placeholder="Select IM firm..."
            />
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!name.trim() || !firmId || saving}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Add Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}