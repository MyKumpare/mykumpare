import React, { useState, useEffect, useMemo } from "react";
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
import { format, parseISO, startOfDay } from "date-fns";
import { CalendarIcon, Plus, X, ChevronDown, Check, Pencil, LayoutList, AlertTriangle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import AddFirmDialog from "@/components/firms/AddFirmDialog";
import AddIMProductValidatedDialog from "@/components/products/AddIMProductValidatedDialog";
import BenchmarkPicker from "./BenchmarkPicker";
import SecondaryBenchmarksPicker from "./SecondaryBenchmarksPicker";
import CapitalFlowFields from "./CapitalFlowFields";
import AllocationValidation from "./AllocationValidation";
import { calculateCapitalFlow, formatCurrency } from "./capitalFlowCalculator";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { syncProductFundingStatus } from "@/components/products/fundingStatusSync";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PortfolioGuidelinesTab from "./PortfolioGuidelinesTab";
import PortfolioHistoricalAumTab from "./PortfolioHistoricalAumTab";
import PortfolioAllocationHistoryTab from "./PortfolioAllocationHistoryTab";
import PortfolioReportModal from "./PortfolioReportModal";
import PortfolioDashboardTab from "./PortfolioDashboardTab";
import PortfolioLineupTab from "./PortfolioLineupTab";
import PortfolioBenchmarkComparisonTab from "./PortfolioBenchmarkComparisonTab";

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
              <Check className={cn("w-3.5 h-3.5 shrink-0", value === opt.value ? "opacity-100 text-primary" : "opacity-0")} />
              {opt.label}
            </button>
          ))}
        </div>
        {onAddNew && (
          <div className="border-t p-1">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm text-primary hover:bg-indigo-50 flex items-center gap-1.5 rounded"
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
              {value ? format(value, "MM/dd/yyyy") : <span className="text-gray-400">{placeholder}</span>}
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
function ProductMultiSelect({ options, value = [], onChange, onAddNew, momInceptionDate, portfolioInceptionDate, allocationHistory, totalAllocation }) {
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
      const defaultDate = portfolioInceptionDate ? format(portfolioInceptionDate, "yyyy-MM-dd") : "";
      onChange([...value, { product_id: opt.value, product_name: opt.label, firm_name: opt.firm_name, inception_date: defaultDate, initial_allocation_amount: "", termination_date: "", funding_status: "Active" }]);
    }
  };

  const updateInceptionDate = (productId, date) => {
    onChange(value.map((v) => v.product_id === productId ? { ...v, inception_date: date ? format(date, "yyyy-MM-dd") : "" } : v));
  };

  const updateAllocationAmount = (productId, amount) => {
    onChange(value.map((v) => v.product_id === productId ? { ...v, initial_allocation_amount: amount } : v));
  };

  const updateTerminationDate = (productId, date) => {
    onChange(value.map((v) => v.product_id === productId ? { ...v, termination_date: date ? format(date, "yyyy-MM-dd") : "" } : v));
  };

  const updateFundingStatus = (productId, status) => {
    onChange(value.map((v) => v.product_id === productId ? { ...v, funding_status: status } : v));
  };

  const subManagerAllocTotal = value.reduce((sum, v) => sum + (parseFloat(v.initial_allocation_amount) || 0), 0);

  const handleDistributeRemaining = () => {
    const total = parseFloat(totalAllocation) || 0;
    if (!total || value.length === 0) return;
    const remaining = total - subManagerAllocTotal;
    if (remaining <= 0) return;
    const unallocated = value.filter((v) => !v.initial_allocation_amount || parseFloat(v.initial_allocation_amount) === 0);
    const targets = unallocated.length > 0 ? unallocated : value;
    const share = remaining / targets.length;
    const targetIds = new Set(targets.map((v) => v.product_id));
    onChange(value.map((v) =>
      targetIds.has(v.product_id)
        ? { ...v, initial_allocation_amount: Math.round(((parseFloat(v.initial_allocation_amount) || 0) + share) * 100) / 100 }
        : v
    ));
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
                  <div className={cn("w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center", selected ? "bg-primary border-indigo-600" : "border-gray-300")}>
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
                className="w-full text-left px-3 py-1.5 text-sm text-primary hover:bg-indigo-50 flex items-center gap-1.5 rounded"
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
            const isBeforeMoM = momInceptionDate && subDate && startOfDay(subDate) < startOfDay(momInceptionDate);
            const isBeforePortfolio = portfolioInceptionDate && subDate && startOfDay(subDate) < startOfDay(portfolioInceptionDate);
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
                <div>
                  <Label className="text-xs font-medium text-gray-600">Initial Allocation Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter amount..."
                    value={v.initial_allocation_amount != null ? String(v.initial_allocation_amount) : ""}
                    onChange={(e) => updateAllocationAmount(v.product_id, e.target.value ? parseFloat(e.target.value) : "")}
                    className="h-9 text-sm mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Termination Date</Label>
                    <div className="mt-1">
                      <DatePicker
                        value={v.termination_date ? parseISO(v.termination_date) : null}
                        onChange={(d) => updateTerminationDate(v.product_id, d)}
                        minDate={subDate || effectiveMin}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Funding Status</Label>
                    <Select
                      value={v.funding_status || "Active"}
                      onValueChange={(s) => updateFundingStatus(v.product_id, s)}
                    >
                      <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {allocationHistory && (
                  <CapitalFlowFields
                    totalAdditions={calculateCapitalFlow(allocationHistory, "sub_manager", v.product_id).totalAdditions}
                    totalRedemptions={calculateCapitalFlow(allocationHistory, "sub_manager", v.product_id).totalRedemptions}
                    initialAllocation={v.initial_allocation_amount}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      {value.length > 0 && totalAllocation && (
        <div className="space-y-2">
          <AllocationValidation
            allocated={subManagerAllocTotal}
            total={totalAllocation}
            label="initial allocation amount"
          />
          {(parseFloat(totalAllocation) || 0) > subManagerAllocTotal && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDistributeRemaining}
              className="w-full text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Distribute Remaining {formatCurrency((parseFloat(totalAllocation) || 0) - subManagerAllocTotal)} Equally
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main dialog ────────────────────────────────────────────────────────────────
export default function AddPortfolioDialog({ open, onOpenChange, onSuccess, preselectedAllocatorId, editingPortfolio, preselectedAdvisorFirmId, preselectedAdvisorType, onDelete, onFirmClick, onProductClick }) {
  const queryClient = useQueryClient();

  // Form state
  const [allocatorId, setAllocatorId] = useState("");
  const [portfolioName, setPortfolioName] = useState("");
  const [inceptionDate, setInceptionDate] = useState(null);
  const [terminationDate, setTerminationDate] = useState(null);
  const [fundingStatus, setFundingStatus] = useState("Active");
  const [initialAllocationAmount, setInitialAllocationAmount] = useState("");
  const [advisorType, setAdvisorType] = useState("");
  const [advisorProductType, setAdvisorProductType] = useState("");
  const [advisorFirmId, setAdvisorFirmId] = useState("");
  const [advisorProductId, setAdvisorProductId] = useState("");
  const [advisorProductName, setAdvisorProductName] = useState("");
  const [advisorInceptionDate, setAdvisorInceptionDate] = useState(null);
  const [advisorTerminationDate, setAdvisorTerminationDate] = useState(null);
  const [advisorFundingStatus, setAdvisorFundingStatus] = useState("Active");
  const [advisorInitialAllocationAmount, setAdvisorInitialAllocationAmount] = useState("");
  const [advisorAllocationTouched, setAdvisorAllocationTouched] = useState(false);
  const [subManagers, setSubManagers] = useState([]);
  const [primaryBenchmarkId, setPrimaryBenchmarkId] = useState("");
  const [primaryBenchmarkName, setPrimaryBenchmarkName] = useState("");
  const [secondaryBenchmarks, setSecondaryBenchmarks] = useState([]);

  // Guidelines state
  const [guidelinesInvestments, setGuidelinesInvestments] = useState("");
  const [guidelinesProgram, setGuidelinesProgram] = useState("");
  const [guidelinesCompliance, setGuidelinesCompliance] = useState("");

  // Tab state
  const [activeTab, setActiveTab] = useState("details");
  const [reportOpen, setReportOpen] = useState(false);

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
        setTerminationDate(editingPortfolio.termination_date ? parseISO(editingPortfolio.termination_date) : null);
        setFundingStatus(editingPortfolio.funding_status || "Active");
        setInitialAllocationAmount(editingPortfolio.initial_allocation_amount != null ? String(editingPortfolio.initial_allocation_amount) : "");
        setAdvisorType(editingPortfolio.advisor_type || "");
        setAdvisorProductType(
          editingPortfolio.advisor_product_type ||
          (editingPortfolio.advisor_type === "Manager of Managers" || (editingPortfolio.sub_managers && editingPortfolio.sub_managers.length > 0)
            ? "Multi-Manager Product"
            : editingPortfolio.advisor_type ? "Investment Manager Product" : "")
        );
        setAdvisorFirmId(editingPortfolio.advisor_firm_id || "");
        setAdvisorProductId(editingPortfolio.advisor_product_id || "");
        setAdvisorProductName(editingPortfolio.advisor_product_name || "");
        setAdvisorInceptionDate(editingPortfolio.advisor_inception_date ? parseISO(editingPortfolio.advisor_inception_date) : null);
        setAdvisorTerminationDate(editingPortfolio.advisor_termination_date ? parseISO(editingPortfolio.advisor_termination_date) : null);
        setAdvisorFundingStatus(editingPortfolio.advisor_funding_status || "Active");
        setAdvisorInitialAllocationAmount(editingPortfolio.advisor_initial_allocation_amount != null ? String(editingPortfolio.advisor_initial_allocation_amount) : "");
        setSubManagers(editingPortfolio.sub_managers || []);
        setPrimaryBenchmarkId(editingPortfolio.primary_benchmark_id || "");
        setPrimaryBenchmarkName(editingPortfolio.primary_benchmark_name || "");
        setSecondaryBenchmarks(editingPortfolio.secondary_benchmarks || []);
        setGuidelinesInvestments(editingPortfolio.guidelines_investments || "");
        setGuidelinesProgram(editingPortfolio.guidelines_program || "");
        setGuidelinesCompliance(editingPortfolio.guidelines_compliance || "");
        setActiveTab("details");
      } else {
        setAllocatorId(preselectedAllocatorId || "");
        setPortfolioName("");
        setInceptionDate(new Date());
        setTerminationDate(null);
        setFundingStatus("Active");
        setInitialAllocationAmount("");
        setAdvisorType(preselectedAdvisorType || "");
        setAdvisorProductType(
          preselectedAdvisorType === "Manager of Managers" ? "Multi-Manager Product"
          : preselectedAdvisorType === "Investment Manager" ? "Investment Manager Product"
          : ""
        );
        setAdvisorFirmId(preselectedAdvisorFirmId || "");
        setAdvisorProductId("");
        setAdvisorProductName("");
        setAdvisorInceptionDate(inceptionDate || null);
        setAdvisorTerminationDate(null);
        setAdvisorFundingStatus("Active");
        setAdvisorInitialAllocationAmount("");
        setAdvisorAllocationTouched(false);
        setSubManagers([]);
        setPrimaryBenchmarkId("");
        setPrimaryBenchmarkName("");
        setSecondaryBenchmarks([]);
        setGuidelinesInvestments("");
        setGuidelinesProgram("");
        setGuidelinesCompliance("");
        setActiveTab("details");
      }
    }
  }, [open, preselectedAllocatorId, editingPortfolio]);

  // Default advisor and sub-manager inception dates to the portfolio inception date
  useEffect(() => {
    if (!inceptionDate) return;
    if (!advisorInceptionDate) setAdvisorInceptionDate(inceptionDate);
    setSubManagers((prev) => {
      if (!prev.some((s) => !s.inception_date)) return prev;
      const dateStr = format(inceptionDate, "yyyy-MM-dd");
      return prev.map((s) => (!s.inception_date ? { ...s, inception_date: dateStr } : s));
    });
  }, [inceptionDate]);

  // Default advisor initial allocation amount to the portfolio's initial allocation amount.
  // Only applies when creating a new portfolio and the user hasn't manually edited the field.
  useEffect(() => {
    if (editingPortfolio) return;
    if (!initialAllocationAmount) return;
    if (!advisorAllocationTouched) setAdvisorInitialAllocationAmount(initialAllocationAmount);
  }, [initialAllocationAmount, advisorAllocationTouched, editingPortfolio]);

  // Calculated capital flow fields from allocation history
  const portfolioFlow = useMemo(() => {
    if (!editingPortfolio) return { totalAdditions: 0, totalRedemptions: 0 };
    return calculateCapitalFlow(editingPortfolio.allocation_history, "portfolio");
  }, [editingPortfolio]);

  const advisorFlow = useMemo(() => {
    if (!editingPortfolio || !advisorFirmId) return { totalAdditions: 0, totalRedemptions: 0 };
    return calculateCapitalFlow(editingPortfolio.allocation_history, "advisor", advisorFirmId);
  }, [editingPortfolio, advisorFirmId]);

  const [pendingAdvisorType, setPendingAdvisorType] = useState(null);
  const [showAdvisorTypeWarning, setShowAdvisorTypeWarning] = useState(false);
  const [showAllocatorChangeWarning, setShowAllocatorChangeWarning] = useState(false);
  const [pendingAllocatorId, setPendingAllocatorId] = useState(null);
  const [showAdvisorFirmChangeWarning, setShowAdvisorFirmChangeWarning] = useState(false);
  const [pendingAdvisorFirmId, setPendingAdvisorFirmId] = useState(null);

  const handleAdvisorProductTypeChange = (newType) => {
    const next = advisorProductType === newType ? "" : newType;
    if (editingPortfolio && isEditing && (advisorProductId || subManagers.length > 0)) {
      setPendingAdvisorType(next);
      setShowAdvisorTypeWarning(true);
    } else {
      setAdvisorProductType(next);
      setAdvisorType(next ? "Investment Manager" : "");
      setAdvisorProductId("");
      setAdvisorProductName("");
      setAdvisorInceptionDate(inceptionDate || null);
      setAdvisorTerminationDate(null);
      setAdvisorFundingStatus("Active");
      setSubManagers([]);
    }
  };

  const confirmAdvisorTypeChange = () => {
    setAdvisorProductType(pendingAdvisorType);
    setAdvisorType(pendingAdvisorType ? "Investment Manager" : "");
    setAdvisorProductId("");
    setAdvisorProductName("");
    setAdvisorInceptionDate(inceptionDate || null);
    setAdvisorTerminationDate(null);
    setAdvisorFundingStatus("Active");
    setSubManagers([]);
    setPendingAdvisorType(null);
    setShowAdvisorTypeWarning(false);
  };

  const handleAllocatorChange = (newId) => {
    if (editingPortfolio && isEditing && allocatorId && newId !== allocatorId) {
      setPendingAllocatorId(newId);
      setShowAllocatorChangeWarning(true);
    } else {
      setAllocatorId(newId);
    }
  };

  const confirmAllocatorChange = () => {
    setAllocatorId(pendingAllocatorId);
    setPendingAllocatorId(null);
    setShowAllocatorChangeWarning(false);
  };

  const handleAdvisorFirmChange = (newId) => {
    if (editingPortfolio && isEditing && advisorFirmId && newId !== advisorFirmId) {
      setPendingAdvisorFirmId(newId);
      setShowAdvisorFirmChangeWarning(true);
    } else {
      setAdvisorFirmId(newId);
      setAdvisorProductType("");
      setAdvisorType("");
      setAdvisorProductId("");
      setAdvisorProductName("");
      setAdvisorInceptionDate(inceptionDate || null);
      setAdvisorTerminationDate(null);
      setAdvisorFundingStatus("Active");
      setSubManagers([]);
    }
  };

  const confirmAdvisorFirmChange = () => {
    setAdvisorFirmId(pendingAdvisorFirmId);
    setAdvisorProductType("");
    setAdvisorType("");
    setAdvisorProductId("");
    setAdvisorProductName("");
    setAdvisorInceptionDate(inceptionDate || null);
    setAdvisorTerminationDate(null);
    setAdvisorFundingStatus("Active");
    setSubManagers([]);
    setPendingAdvisorFirmId(null);
    setShowAdvisorFirmChangeWarning(false);
  };

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
      .filter((p) => p.product_type === "Investment Manager Product" && imFirmIds.has(p.firm_id) && !p.deleted_at)
      .map((p) => ({ value: p.id, label: p.name, firm_name: p.firm_name || "" }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [firms, products]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Portfolio.create(data),
    onSuccess: (_created, variables) => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
      // Portfolio added — recompute the advisor product's funding status.
      if (variables?.advisor_product_id) {
        const prod = products.find((p) => p.id === variables.advisor_product_id);
        syncProductFundingStatus({ id: variables.advisor_product_id, firm_id: prod?.firm_id }, queryClient);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Portfolio.update(id, data),
    onSuccess: (_updated, { data }) => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
      // Portfolio funding status or linked product may have changed — recompute.
      const productId = data?.advisor_product_id || editingPortfolio?.advisor_product_id;
      if (productId) {
        const prod = products.find((p) => p.id === productId);
        syncProductFundingStatus({ id: productId, firm_id: prod?.firm_id }, queryClient);
      }
    },
  });

  // Sync initial allocation amounts from the form into the allocation_history array
  // as "Initial Allocation" records. Preserves manually-added Capital Addition /
  // Redemption records; only creates/updates/removes Initial Allocation entries.
  const syncInitialAllocations = (existingHistory) => {
    const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    let history = (existingHistory || []).map((e) => ({ ...e }));
    const fmtDate = (d) => (d ? format(d, "yyyy-MM-dd") : "");

    const upsertInitial = (level, refId, refName, amount, date) => {
      const existing = history.find(
        (e) =>
          e.level === level &&
          (e.reference_id || "") === (refId || "") &&
          e.activity_type === "Initial Allocation"
      );
      if (!amount || !date) {
        if (existing) history = history.filter((e) => e !== existing);
        return;
      }
      if (existing) {
        existing.amount = parseFloat(amount);
        existing.activity_date = date;
        existing.reference_name = refName;
      } else {
        history.push({
          id: genId(),
          activity_date: date,
          activity_type: "Initial Allocation",
          amount: parseFloat(amount),
          level,
          reference_id: refId || undefined,
          reference_name: refName,
        });
      }
    };

    // Portfolio level
    upsertInitial("portfolio", "", "Portfolio Total", initialAllocationAmount, fmtDate(inceptionDate));

    // Advisor level — remove stale records for a different firm, then upsert current
    if (advisorFirmId) {
      history = history.filter(
        (e) =>
          !(e.level === "advisor" && e.activity_type === "Initial Allocation" && (e.reference_id || "") !== advisorFirmId)
      );
      upsertInitial("advisor", advisorFirmId, `IM: ${firms.find((f) => f.id === advisorFirmId)?.name || ""}`, advisorInitialAllocationAmount, fmtDate(advisorInceptionDate));
    } else {
      history = history.filter((e) => !(e.level === "advisor" && e.activity_type === "Initial Allocation"));
    }

    // Sub-manager level — remove records for sub-managers no longer in the list
    const currentSmIds = new Set(
      advisorProductType === "Multi-Manager Product" ? subManagers.map((sm) => sm.product_id) : []
    );
    history = history.filter(
      (e) =>
        !(e.level === "sub_manager" && e.activity_type === "Initial Allocation" && !currentSmIds.has(e.reference_id))
    );
    if (advisorProductType === "Multi-Manager Product") {
      subManagers.forEach((sm) => {
        upsertInitial("sub_manager", sm.product_id, `Sub-Manager: ${sm.product_name}`, sm.initial_allocation_amount, sm.inception_date);
      });
    }

    return history;
  };

  const handleSave = () => {
    const allocatorFirm = firms.find((f) => f.id === allocatorId);
    const advisorFirm = firms.find((f) => f.id === advisorFirmId);
    const payload = {
      firm_id: allocatorId,
      allocator_name: allocatorFirm?.name || "",
      portfolio_name: portfolioName.trim(),
      inception_date: inceptionDate ? format(inceptionDate, "yyyy-MM-dd") : "",
      termination_date: terminationDate ? format(terminationDate, "yyyy-MM-dd") : undefined,
      funding_status: fundingStatus || "Active",
      initial_allocation_amount: initialAllocationAmount ? parseFloat(initialAllocationAmount) : undefined,
      advisor_type: advisorProductType ? "Investment Manager" : undefined,
      advisor_product_type: advisorProductType || undefined,
      advisor_firm_id: advisorFirmId || undefined,
      advisor_firm_name: advisorFirm?.name || undefined,
      advisor_product_id: advisorProductId || undefined,
      advisor_product_name: advisorProductName || undefined,
      advisor_inception_date: advisorProductType && advisorInceptionDate ? format(advisorInceptionDate, "yyyy-MM-dd") : undefined,
      advisor_termination_date: advisorProductType && advisorTerminationDate ? format(advisorTerminationDate, "yyyy-MM-dd") : undefined,
      advisor_funding_status: advisorProductType ? (advisorFundingStatus || "Active") : undefined,
      advisor_initial_allocation_amount: advisorProductType && advisorInitialAllocationAmount ? parseFloat(advisorInitialAllocationAmount) : undefined,
      sub_managers: advisorProductType === "Multi-Manager Product" ? subManagers : undefined,
      allocation_history: syncInitialAllocations(editingPortfolio?.allocation_history),
      primary_benchmark_id: primaryBenchmarkId || undefined,
      primary_benchmark_name: primaryBenchmarkName || undefined,
      secondary_benchmarks: secondaryBenchmarks.length > 0 ? secondaryBenchmarks : undefined,
      guidelines_investments: guidelinesInvestments || undefined,
      guidelines_program: guidelinesProgram || undefined,
      guidelines_compliance: guidelinesCompliance || undefined,
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
    setAddFirmPreselectedType("Investment Manager");
    setAddFirmOpen(true);
  };

  // Called when AddFirmDialog saves
  const handleFirmSubmit = async (firmData) => {
    const created = await base44.entities.Firm.create(firmData);
    queryClient.invalidateQueries({ queryKey: ["firms"] });
    if (pendingFirmTarget === "allocator") setAllocatorId(created.id);
    if (pendingFirmTarget === "advisor") {
      setAdvisorFirmId(created.id);
      setAdvisorProductType("");
      setAdvisorType("");
      setAdvisorProductId("");
      setAdvisorProductName("");
      setAdvisorInceptionDate(inceptionDate || null);
      setAdvisorTerminationDate(null);
      setAdvisorFundingStatus("Active");
      setSubManagers([]);
    }
    setAddFirmOpen(false);
  };

  const advisorFirmOptions = imOptions;

  const advisorProductOptions = useMemo(() => {
    if (!advisorFirmId || !advisorProductType) return [];
    return products
      .filter((p) => p.firm_id === advisorFirmId && p.product_type === advisorProductType)
      .map((p) => ({ value: p.id, label: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products, advisorFirmId, advisorProductType]);

  const momInceptionDate = advisorProductType === "Multi-Manager Product" ? advisorInceptionDate : null;

  const subManagersValid =
    advisorProductType !== "Multi-Manager Product" ||
    subManagers.every((s) => {
      if (!s.inception_date) return false;
      const d = parseISO(s.inception_date);
      if (momInceptionDate && startOfDay(d) < startOfDay(momInceptionDate)) return false;
      if (inceptionDate && startOfDay(d) < startOfDay(inceptionDate)) return false;
      return true;
    });

  const advisorDateValid = !advisorProductType || (
    advisorInceptionDate &&
    (!inceptionDate || advisorInceptionDate >= inceptionDate)
  );

  const portfolioTotal = parseFloat(initialAllocationAmount) || 0;
  const advisorAmount = parseFloat(advisorInitialAllocationAmount) || 0;
  const subManagersTotal = subManagers.reduce((sum, s) => sum + (parseFloat(s.initial_allocation_amount) || 0), 0);

  // Advisor allocation must match portfolio total exactly — no over, no under
  const advisorOverAllocated = advisorProductType && portfolioTotal > 0 && advisorInitialAllocationAmount &&
    advisorAmount > portfolioTotal;
  const advisorUnderAllocated = advisorProductType && portfolioTotal > 0 && advisorInitialAllocationAmount &&
    advisorAmount < portfolioTotal;

  // Sub-managers allocation must match portfolio total exactly — no over, no under
  const subManagersOverAllocated = advisorProductType === "Multi-Manager Product" && portfolioTotal > 0 && subManagers.length > 0 &&
    subManagersTotal > portfolioTotal;
  const subManagersUnderAllocated = advisorProductType === "Multi-Manager Product" && portfolioTotal > 0 && subManagers.length > 0 &&
    subManagersTotal < portfolioTotal;

  const isValid =
    allocatorId &&
    portfolioName.trim() &&
    inceptionDate &&
    advisorDateValid &&
    subManagersValid &&
    !advisorOverAllocated &&
    !advisorUnderAllocated &&
    !subManagersOverAllocated &&
    !subManagersUnderAllocated;

  const viewAllocatorName = firms.find((f) => f.id === allocatorId)?.name || allocatorId;
  const viewAdvisorFirmName = firms.find((f) => f.id === advisorFirmId)?.name || advisorFirmId;

  const hasPortfolioChanges = (() => {
    if (editingPortfolio && !isEditing) return false;
    const fmt = (d) => d ? format(d, "yyyy-MM-dd") : "";
    if (editingPortfolio) {
      return allocatorId !== (editingPortfolio.firm_id || "") ||
        portfolioName.trim() !== (editingPortfolio.portfolio_name || "") ||
        fmt(inceptionDate) !== (editingPortfolio.inception_date || "") ||
        fmt(terminationDate) !== (editingPortfolio.termination_date || "") ||
        (fundingStatus || "Active") !== (editingPortfolio.funding_status || "Active") ||
        (initialAllocationAmount || "") !== (editingPortfolio.initial_allocation_amount != null ? String(editingPortfolio.initial_allocation_amount) : "") ||
        advisorType !== (editingPortfolio.advisor_type || "") ||
        advisorProductType !== (editingPortfolio.advisor_product_type || (editingPortfolio.advisor_type === "Manager of Managers" || (editingPortfolio.sub_managers && editingPortfolio.sub_managers.length > 0) ? "Multi-Manager Product" : editingPortfolio.advisor_type ? "Investment Manager Product" : "")) ||
        advisorFirmId !== (editingPortfolio.advisor_firm_id || "") ||
        advisorProductId !== (editingPortfolio.advisor_product_id || "") ||
        fmt(advisorInceptionDate) !== (editingPortfolio.advisor_inception_date || "") ||
        fmt(advisorTerminationDate) !== (editingPortfolio.advisor_termination_date || "") ||
        (advisorFundingStatus || "Active") !== (editingPortfolio.advisor_funding_status || "Active") ||
        (advisorInitialAllocationAmount || "") !== (editingPortfolio.advisor_initial_allocation_amount != null ? String(editingPortfolio.advisor_initial_allocation_amount) : "") ||
        JSON.stringify(subManagers) !== JSON.stringify(editingPortfolio.sub_managers || []) ||
        primaryBenchmarkId !== (editingPortfolio.primary_benchmark_id || "") ||
        JSON.stringify(secondaryBenchmarks) !== JSON.stringify(editingPortfolio.secondary_benchmarks || []) ||
        guidelinesInvestments !== (editingPortfolio.guidelines_investments || "") ||
        guidelinesProgram !== (editingPortfolio.guidelines_program || "") ||
        guidelinesCompliance !== (editingPortfolio.guidelines_compliance || "");
    }
    return !!(allocatorId || portfolioName.trim() || inceptionDate || initialAllocationAmount || advisorType || advisorProductType || advisorFirmId || advisorProductId || advisorInceptionDate || advisorInitialAllocationAmount || subManagers.length > 0 || primaryBenchmarkId || secondaryBenchmarks.length > 0 || guidelinesInvestments || guidelinesProgram || guidelinesCompliance);
  })();

  const { guardedClose, guardDialog } = useUnsavedChangesGuard(hasPortfolioChanges, () => onOpenChange(false), handleSave);

  return (
    <>
      {/* Advisor type change warning */}
      {showAdvisorTypeWarning && (
        <Dialog open={showAdvisorTypeWarning} onOpenChange={() => setShowAdvisorTypeWarning(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Change Advisor Type?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">Changing the product type will clear the selected product and sub-managers. Do you want to proceed?</p>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdvisorTypeWarning(false)}>Cancel</Button>
              <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={confirmAdvisorTypeChange}>Yes, Change It</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Allocator change warning */}
      {showAllocatorChangeWarning && (
        <Dialog open={showAllocatorChangeWarning} onOpenChange={() => setShowAllocatorChangeWarning(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Change Allocator?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">You are about to change the allocator firm for this portfolio. Do you want to proceed?</p>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAllocatorChangeWarning(false)}>Cancel</Button>
              <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={confirmAllocatorChange}>Yes, Change It</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Advisor firm change warning */}
      {showAdvisorFirmChangeWarning && (
        <Dialog open={showAdvisorFirmChangeWarning} onOpenChange={() => setShowAdvisorFirmChangeWarning(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Change Advisor Firm?</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">You are about to change the associated advisor firm. Do you want to proceed?</p>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdvisorFirmChangeWarning(false)}>Cancel</Button>
              <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={confirmAdvisorFirmChange}>Yes, Change It</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={open} onOpenChange={(v) => { if (!v) guardedClose(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              {editingPortfolio && !isEditing ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <LayoutList className="w-5 h-5 text-gray-300" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-base font-semibold leading-tight">Portfolio Details</DialogTitle>
                    <p className="text-sm text-primary font-medium mt-0.5 truncate">{portfolioName}</p>
                  </div>
                </div>
              ) : (
                <DialogTitle className="text-xl font-semibold">
                  {editingPortfolio ? "Edit Portfolio" : "Add Portfolio"}
                </DialogTitle>
              )}
              {editingPortfolio && !isEditing && (
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-indigo-700 hover:bg-indigo-50 gap-1.5"
                    onClick={() => setReportOpen(true)}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Report
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-indigo-700 hover:bg-indigo-50 gap-1.5"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={cn("grid w-full mb-1", editingPortfolio ? "grid-cols-7" : "grid-cols-2")}>
              <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
              <TabsTrigger value="guidelines" className="text-xs">Guidelines</TabsTrigger>
              {editingPortfolio && <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>}
              {editingPortfolio && <TabsTrigger value="lineup" className="text-xs">Lineup</TabsTrigger>}
              {editingPortfolio && <TabsTrigger value="benchmark" className="text-xs">Benchmark</TabsTrigger>}
              {editingPortfolio && <TabsTrigger value="historical-aum" className="text-xs">Historical AUM</TabsTrigger>}
              {editingPortfolio && <TabsTrigger value="allocation-history" className="text-xs">Allocation History</TabsTrigger>}
            </TabsList>
            <TabsContent value="details">
          {/* View mode */}
          {editingPortfolio && !isEditing ? (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Allocator</p>
                  <button
                    type="button"
                    onClick={() => {
                      const firm = firms.find((f) => f.id === allocatorId);
                      if (firm && onFirmClick) { onOpenChange(false); onFirmClick(firm); }
                    }}
                    className="w-full text-left text-sm text-primary hover:text-indigo-700 px-3 py-2 rounded-md border bg-gray-50 hover:bg-indigo-50 transition-colors"
                  >
                    {viewAllocatorName || <span className="text-gray-400">—</span>}
                  </button>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Inception Date</p>
                  <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">
                    {inceptionDate ? format(inceptionDate, "MM/dd/yyyy") : <span className="text-gray-400">—</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Termination Date</p>
                  <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">
                    {terminationDate ? format(terminationDate, "MM/dd/yyyy") : <span className="text-gray-400">—</span>}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Funding Status</p>
                <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{fundingStatus || "Active"}</p>
              </div>
              {initialAllocationAmount && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Initial Allocation Amount</p>
                  <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{initialAllocationAmount}</p>
                </div>
              )}
              {editingPortfolio && (
                <CapitalFlowFields
                  totalAdditions={portfolioFlow.totalAdditions}
                  totalRedemptions={portfolioFlow.totalRedemptions}
                  initialAllocation={initialAllocationAmount}
                />
              )}
              {advisorProductType && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Product Type</p>
                    <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{advisorProductType}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Investment Manager Firm</p>
                    <button
                      type="button"
                      onClick={() => {
                        const firm = firms.find((f) => f.id === advisorFirmId);
                        if (firm && onFirmClick) { onOpenChange(false); onFirmClick(firm); }
                      }}
                      className="w-full text-left text-sm text-primary hover:text-indigo-700 px-3 py-2 rounded-md border bg-gray-50 hover:bg-indigo-50 transition-colors"
                    >
                      {viewAdvisorFirmName || <span className="text-gray-400">—</span>}
                    </button>
                  </div>
                </div>
              )}
              {advisorProductName && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Selected Product</p>
                  <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{advisorProductName}</p>
                </div>
              )}
              {advisorType && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Investment Manager Inception Date</p>
                    <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">
                      {advisorInceptionDate ? format(advisorInceptionDate, "MM/dd/yyyy") : <span className="text-gray-400">—</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Investment Manager Termination Date</p>
                    <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">
                      {advisorTerminationDate ? format(advisorTerminationDate, "MM/dd/yyyy") : <span className="text-gray-400">—</span>}
                    </p>
                  </div>
                </div>
              )}
              {advisorType && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Investment Manager Funding Status</p>
                  <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{advisorFundingStatus || "Active"}</p>
                </div>
              )}
              {advisorType && advisorInitialAllocationAmount && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Investment Manager Initial Allocation Amount</p>
                  <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{advisorInitialAllocationAmount}</p>
                </div>
              )}
              {advisorType && editingPortfolio && (
                <CapitalFlowFields
                  totalAdditions={advisorFlow.totalAdditions}
                  totalRedemptions={advisorFlow.totalRedemptions}
                  initialAllocation={advisorInitialAllocationAmount}
                />
              )}
              {subManagers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Sub-Managers</p>
                  <div className="space-y-1.5">
                    {subManagers.map((sm) => {
                      const product = products.find((p) => p.id === sm.product_id);
                      return (
                        <button
                          key={sm.product_id}
                          type="button"
                          onClick={() => {
                            if (product && onProductClick) { onOpenChange(false); onProductClick(product); }
                          }}
                          className="w-full text-left px-3 py-2 rounded-md border bg-gray-50 hover:bg-indigo-50 transition-colors text-sm"
                        >
                          <span className="font-medium text-primary hover:text-indigo-700">{sm.product_name}</span>
                          {sm.firm_name && <span className="text-gray-400 ml-1">· {sm.firm_name}</span>}
                          {sm.inception_date && <span className="text-gray-400 ml-1">· {format(parseISO(sm.inception_date), "MM/dd/yyyy")}</span>}
                          {sm.termination_date && <span className="text-gray-400 ml-1">· Term: {format(parseISO(sm.termination_date), "MM/dd/yyyy")}</span>}
                          {sm.funding_status && <span className="text-gray-400 ml-1">· {sm.funding_status}</span>}
                          {sm.initial_allocation_amount != null && sm.initial_allocation_amount !== "" && <span className="text-gray-400 ml-1">· ${sm.initial_allocation_amount}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {primaryBenchmarkName && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Primary Benchmark</p>
                  <p className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">{primaryBenchmarkName}</p>
                </div>
              )}
              {secondaryBenchmarks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Secondary Benchmark</p>
                  <div className="flex flex-wrap gap-1.5">
                    {secondaryBenchmarks.map((b) => (
                      <span key={b.benchmark_id} className="inline-flex px-2 py-1 rounded-md bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700">
                        {b.benchmark_name}
                      </span>
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
                  onChange={handleAllocatorChange}
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

              {/* Inception Date + Termination Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">
                    Inception Date <span className="text-red-400">*</span>
                  </Label>
                  <DatePicker value={inceptionDate} onChange={setInceptionDate} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Termination Date</Label>
                  <DatePicker
                    value={terminationDate}
                    onChange={setTerminationDate}
                    minDate={inceptionDate || undefined}
                  />
                </div>
              </div>

              {/* Funding Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Funding Status</Label>
                <Select value={fundingStatus || "Active"} onValueChange={setFundingStatus}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Initial Allocation Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">
                  Initial Allocation Amount
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter amount..."
                  value={initialAllocationAmount}
                  onChange={(e) => setInitialAllocationAmount(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              {/* Calculated Capital Flow Fields (only when editing existing portfolio) */}
              {editingPortfolio && (
                <CapitalFlowFields
                  totalAdditions={portfolioFlow.totalAdditions}
                  totalRedemptions={portfolioFlow.totalRedemptions}
                  initialAllocation={initialAllocationAmount}
                />
              )}

              {/* Investment Manager Firm (first step) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Investment Manager Firm</Label>
                <SearchableSelect
                  options={advisorFirmOptions}
                  value={advisorFirmId}
                  onChange={handleAdvisorFirmChange}
                  placeholder="Select Investment Manager..."
                  onAddNew={handleAddAdvisorFirm}
                  addNewLabel="Add new Investment Manager..."
                />
              </div>

              {/* Product Type (conditional on firm selection) */}
              {advisorFirmId && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Product Type</Label>
                  <div className="flex gap-2">
                    {["Investment Manager Product", "Multi-Manager Product"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleAdvisorProductTypeChange(t)}
                        className={cn(
                          "flex-1 h-9 rounded-md border text-sm font-medium transition-colors",
                          advisorProductType === t
                            ? "bg-primary border-indigo-600 text-white"
                            : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-primary"
                        )}
                      >
                        {t === "Investment Manager Product" ? "Investment Manager" : "Multi-Manager"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Products (conditional on product type) */}
              {advisorFirmId && advisorProductType && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">
                    Available Products
                    {advisorProductOptions.length === 0 && (
                      <span className="text-gray-400 font-normal"> (no products found)</span>
                    )}
                  </Label>
                  {advisorProductOptions.length > 0 ? (
                    <SearchableSelect
                      options={advisorProductOptions}
                      value={advisorProductId}
                      onChange={(id) => {
                        setAdvisorProductId(id);
                        const prod = products.find((p) => p.id === id);
                        setAdvisorProductName(prod?.name || "");
                      }}
                      placeholder="Select a product..."
                    />
                  ) : (
                    <p className="text-sm text-gray-400 px-3 py-2 rounded-md border bg-gray-50">
                      No {advisorProductType === "Investment Manager Product" ? "Investment Manager" : "Multi-Manager"} products found for this firm.
                    </p>
                  )}
                </div>
              )}

              {/* Advisor Inception Date + Termination Date (conditional) */}
              {advisorType && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                      Investment Manager Inception Date <span className="text-red-400">*</span>
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
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                      Investment Manager Termination Date
                    </Label>
                    <DatePicker
                      value={advisorTerminationDate}
                      onChange={setAdvisorTerminationDate}
                      minDate={advisorInceptionDate || inceptionDate || undefined}
                    />
                  </div>
                </div>
              )}

              {/* Advisor Funding Status (conditional) */}
              {advisorType && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">
                    Investment Manager Funding Status
                  </Label>
                  <Select value={advisorFundingStatus || "Active"} onValueChange={setAdvisorFundingStatus}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Advisor Initial Allocation Amount (conditional) */}
              {advisorType && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">
                    Investment Manager Initial Allocation Amount
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter amount..."
                    value={advisorInitialAllocationAmount}
                    onChange={(e) => { setAdvisorInitialAllocationAmount(e.target.value); setAdvisorAllocationTouched(true); }}
                    className={cn(
                      "h-9 text-sm",
                      initialAllocationAmount && advisorInitialAllocationAmount && (parseFloat(advisorInitialAllocationAmount) || 0) !== (parseFloat(initialAllocationAmount) || 0) && "border-red-400 focus-visible:ring-red-400"
                    )}
                  />
                  {initialAllocationAmount && (
                    <AllocationValidation
                      allocated={advisorInitialAllocationAmount}
                      total={initialAllocationAmount}
                    />
                  )}
                </div>
              )}

              {/* Advisor Calculated Capital Flow Fields (conditional) */}
              {advisorType && editingPortfolio && (
                <CapitalFlowFields
                  totalAdditions={advisorFlow.totalAdditions}
                  totalRedemptions={advisorFlow.totalRedemptions}
                  initialAllocation={advisorInitialAllocationAmount}
                />
              )}

                  {/* Sub-managers (only for Multi-Manager Product) */}
              {advisorProductType === "Multi-Manager Product" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Sub-Managers (IM Products)</Label>
                  <ProductMultiSelect
                    options={imProductOptions}
                    value={subManagers}
                    onChange={setSubManagers}
                    onAddNew={() => setAddProductOpen(true)}
                    momInceptionDate={advisorInceptionDate}
                    portfolioInceptionDate={inceptionDate}
                    allocationHistory={editingPortfolio?.allocation_history}
                    totalAllocation={initialAllocationAmount}
                  />
                </div>
              )}

              {/* Primary Benchmark */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Primary Benchmark</Label>
                <BenchmarkPicker
                  value={primaryBenchmarkId}
                  onChange={(id, name) => { setPrimaryBenchmarkId(id); setPrimaryBenchmarkName(name); }}
                  excludeIds={secondaryBenchmarks.map((b) => b.benchmark_id)}
                  placeholder="Select primary benchmark..."
                />
              </div>

              {/* Secondary Benchmarks */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Secondary Benchmark</Label>
                <SecondaryBenchmarksPicker
                  value={secondaryBenchmarks}
                  onChange={setSecondaryBenchmarks}
                  excludeIds={primaryBenchmarkId ? [primaryBenchmarkId] : []}
                />
              </div>
            </div>
          )}
            </TabsContent>
            <TabsContent value="guidelines">
              <PortfolioGuidelinesTab
                investments={guidelinesInvestments}
                program={guidelinesProgram}
                compliance={guidelinesCompliance}
                isEditing={!editingPortfolio || isEditing}
                onInvestmentsChange={setGuidelinesInvestments}
                onProgramChange={setGuidelinesProgram}
                onComplianceChange={setGuidelinesCompliance}
              />
            </TabsContent>
            {editingPortfolio && (
              <>
                <TabsContent value="dashboard">
                  <PortfolioDashboardTab portfolio={editingPortfolio} />
                </TabsContent>
                <TabsContent value="lineup">
                  <PortfolioLineupTab portfolio={editingPortfolio} />
                </TabsContent>
                <TabsContent value="benchmark">
                  <PortfolioBenchmarkComparisonTab portfolio={editingPortfolio} />
                </TabsContent>
                <TabsContent value="historical-aum">
                  <PortfolioHistoricalAumTab portfolio={editingPortfolio} />
                </TabsContent>
                <TabsContent value="allocation-history">
                  <PortfolioAllocationHistoryTab portfolio={editingPortfolio} />
                </TabsContent>
              </>
            )}
          </Tabs>

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
                <Button variant="outline" onClick={guardedClose}>Close</Button>
              ) : editingPortfolio && isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button
                    onClick={handleSave}
                    disabled={!isValid || updateMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={guardedClose}>Cancel</Button>
                  <Button
                    onClick={handleSave}
                    disabled={!isValid || createMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-white"
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

      {/* Add IM Product (validated) */}
      <AddIMProductValidatedDialog
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
        firms={firms}
        existingProducts={products}
        onCreated={(product) => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
          setSubManagers((prev) =>
            prev.some((s) => s.product_id === product.id)
              ? prev
              : [...prev, { product_id: product.id, product_name: product.name, firm_name: product.firm_name || "", inception_date: inceptionDate ? format(inceptionDate, "yyyy-MM-dd") : "", initial_allocation_amount: "", termination_date: "", funding_status: "Active" }]
          );
        }}
      />
      {guardDialog}

      {editingPortfolio && (
        <PortfolioReportModal
          portfolio={editingPortfolio}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />
      )}
    </>
  );
}