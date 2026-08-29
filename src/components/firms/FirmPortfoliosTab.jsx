import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { fetchFirmAssociatedPortfolios } from "./firmPortfolioLookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import {
  LayoutList,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Plus,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AddPortfolioDialog from "@/components/portfolios/AddPortfolioDialog";

const ADVISOR_TYPE_FILTERS = ["All", "Manager of Managers", "Investment Manager", "None"];

const ACTIVITY_TYPES = ["Initial Allocation", "Capital Addition", "Redemption"];

const ACTIVITY_ICONS = {
  "Initial Allocation": { icon: DollarSign, color: "text-blue-600" },
  "Capital Addition": { icon: TrendingUp, color: "text-emerald-600" },
  Redemption: { icon: TrendingDown, color: "text-red-600" },
};

function formatCurrency(val) {
  const n = Number(val) || 0;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function genId() {
  return `alloc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Strip HTML for preview display
function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export default function FirmPortfoliosTab({
  firmId,
  firmName,
  onPortfolioClick,
  // advisorMode: show portfolios where this firm is the advisor (MoM or IM)
  advisorMode = false,
  advisorType = null,
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedPortfolios, setExpandedPortfolios] = useState({});
  const [addAllocOpen, setAddAllocOpen] = useState(null); // portfolio object or null
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState(null);
  const [search, setSearch] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("All");

  // Fetch all portfolios associated with this firm (allocator + advisor + sub-manager).
  // The shared helper covers the sub-manager case: portfolios whose advisor_firm_id
  // points at a different (MoM) firm but which hold this firm's products in their
  // sub_managers[] array. In advisor mode we only want portfolios where the firm is
  // the advisor, so we skip the sub-manager scan there.
  const { data: lookupData, isLoading } = useQuery({
    queryKey: advisorMode ? ["portfolios-advisor", firmId] : ["portfolios-firm-all", firmId],
    queryFn: () =>
      fetchFirmAssociatedPortfolios(firmId, { includeSubManager: !advisorMode }),
  });
  const portfolios = useMemo(() => {
    if (advisorMode) {
      return (lookupData?.portfolios || []).filter((p) => p.advisor_firm_id === firmId);
    }
    return lookupData?.portfolios || [];
  }, [lookupData, advisorMode, firmId]);
  const roleMap = lookupData?.roleMap || {};

  // Filter by search text and advisor type filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return portfolios
      .filter((p) => {
        if (p.deleted_at) return false;
        // Advisor type filter
        if (advisorFilter !== "All") {
          if (advisorFilter === "None") {
            if (p.advisor_type) return false;
          } else if (p.advisor_type !== advisorFilter) return false;
        }
        // Search filter
        if (!q) return true;
        return (
          (p.portfolio_name || "").toLowerCase().includes(q) ||
          (p.allocator_name || "").toLowerCase().includes(q) ||
          (p.advisor_firm_name || "").toLowerCase().includes(q) ||
          (p.advisor_type || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.portfolio_name || "").localeCompare(b.portfolio_name || ""));
  }, [portfolios, search, advisorFilter]);

  // For each portfolio, gather the allocation history records relevant to this firm.
  // - Allocator (firm_id === firmId): sees every level (portfolio, advisor, sub_manager).
  // - Advisor (advisor_firm_id === firmId): sees portfolio + advisor level (flows through the advisor).
  // - Sub-manager (firm's product in sub_managers[]): sees only the sub_manager records
  //   for this firm's products.
  const portfolioContext = useMemo(() => {
    return filtered.map((p) => {
      const role = roleMap[p.id] || {};
      const isAllocator = role.isAllocator || p.firm_id === firmId;
      const isAdvisor = role.isAdvisor || p.advisor_firm_id === firmId;
      let relevantRecords;
      if (isAllocator) {
        relevantRecords = [...(p.allocation_history || [])];
      } else if (isAdvisor) {
        relevantRecords = (p.allocation_history || []).filter(
          (r) => r.level === "portfolio" || r.level === "advisor"
        );
      } else if (role.isSubManager) {
        // Sub-manager: only the sub_manager records for this firm's products
        const idSet = new Set(role.matchedProductIds || []);
        relevantRecords = (p.allocation_history || []).filter(
          (r) => r.level === "sub_manager" && idSet.has(r.reference_id)
        );
      } else {
        relevantRecords = (p.allocation_history || []).filter(
          (r) => r.level === "portfolio" || r.level === "advisor"
        );
      }
      relevantRecords = [...relevantRecords].sort(
        (a, b) => (b.activity_date || "").localeCompare(a.activity_date || "")
      );

      return { portfolio: p, relevantRecords, role };
    });
  }, [filtered, advisorMode, roleMap]);

  const toggleExpand = (portfolioId) => {
    setExpandedPortfolios((prev) => ({ ...prev, [portfolioId]: !prev[portfolioId] }));
  };

  const handleOpenPortfolio = (portfolio) => {
    if (onPortfolioClick) {
      onPortfolioClick(portfolio);
    } else {
      setEditingPortfolio(portfolio);
      setPortfolioDialogOpen(true);
    }
  };

  const handleAddAllocation = async (data) => {
    const portfolio = addAllocOpen;
    if (!portfolio) return;

    const newRecord = {
      id: genId(),
      activity_date: data.activity_date,
      activity_type: data.activity_type,
      amount: Number(data.amount) || 0,
      notes: data.notes || "",
      level: "portfolio",
      reference_id: "",
      reference_name: "",
    };

    const updatedHistory = [...(portfolio.allocation_history || []), newRecord];

    try {
      await base44.entities.Portfolio.update(portfolio.id, {
        allocation_history: updatedHistory,
      });
      queryClient.invalidateQueries({ queryKey: advisorMode ? ["portfolios-advisor", firmId] : ["portfolios", firmId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios-all"] });
      toast({ title: "Historical allocation added successfully" });
      setAddAllocOpen(null);
    } catch (e) {
      toast({ title: "Failed to add allocation", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + filter + add button row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search portfolios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <select
          value={advisorFilter}
          onChange={(e) => setAdvisorFilter(e.target.value)}
          className="h-8 text-sm rounded-md border border-input bg-transparent px-2 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {ADVISOR_TYPE_FILTERS.map((t) => (
            <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>
          ))}
        </select>
      </div>

      {/* Result count */}
      {portfolios.length > 0 && (
        <p className="text-xs text-gray-400">
          {filtered.length} of {portfolios.length} portfolio{portfolios.length !== 1 ? "s" : ""}
        </p>
      )}

      {filtered.length === 0 && (
        <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
          {portfolios.length === 0 ? "No portfolios found" : "No portfolios match your search"}
        </div>
      )}

      {portfolioContext.map(({ portfolio: p, relevantRecords }) => {
        const expanded = !!expandedPortfolios[p.id];
        const totalAlloc = relevantRecords.reduce((sum, r) => {
          const amt = Number(r.amount) || 0;
          return r.activity_type === "Redemption" ? sum - amt : sum + amt;
        }, 0);

        const isAllocator = p.firm_id === firmId;
        const role = roleMap[p.id] || {};
        let roleLabel;
        if (role.isSubManager && !role.isAdvisor && !role.isAllocator) {
          roleLabel = "Sub-Manager";
        } else if (advisorMode || !isAllocator) {
          roleLabel = "Advisor";
        } else {
          roleLabel = "Allocator";
        }

        return (
          <div
            key={p.id}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            {/* Portfolio header row */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50/50 border-b border-gray-100">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => toggleExpand(p.id)}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <LayoutList className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <button
                  type="button"
                  onClick={() => handleOpenPortfolio(p)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline truncate text-left"
                >
                  {p.portfolio_name}
                </button>
                <span className="text-xs text-gray-400 truncate hidden sm:inline">
                  · {advisorMode ? p.allocator_name : p.advisor_firm_name}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  roleLabel === "Sub-Manager" ? "bg-purple-100 text-purple-700"
                  : advisorMode ? "bg-blue-100 text-blue-700"
                  : "bg-emerald-100 text-emerald-700"
                }`}>
                  {roleLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => handleOpenPortfolio(p)}
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </Button>
              </div>
            </div>

            {/* Portfolio meta row */}
            <div className="px-3 py-2 flex items-center gap-4 text-xs text-gray-500 border-b border-gray-100 flex-wrap">
              <span>Inception: {p.inception_date ? format(parseISO(p.inception_date), "MMM d, yyyy") : "—"}</span>
              {p.initial_allocation_amount != null && p.initial_allocation_amount !== "" && (
                <span>Initial: {formatCurrency(p.initial_allocation_amount)}</span>
              )}
              {p.funding_status && (
                <span className={`px-1.5 py-0.5 rounded-full ${p.funding_status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                  {p.funding_status}
                </span>
              )}
              {p.advisor_type && (
                <span>
                  {p.advisor_type === "Manager of Managers" ? "MoM" : "Investment Manager"}
                  {p.advisor_firm_name ? `: ${p.advisor_firm_name}` : ""}
                </span>
              )}
              {relevantRecords.length > 0 && (
                <span className="ml-auto font-medium text-gray-700">
                  Net Flow: {formatCurrency(totalAlloc)}
                </span>
              )}
            </div>

            {/* Expanded allocation history */}
            {expanded && (
              <div className="px-3 py-3">
                {relevantRecords.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-3">
                    No allocation history records for this portfolio yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {relevantRecords.map((r) => {
                      const IconCfg = ACTIVITY_ICONS[r.activity_type] || { icon: Minus, color: "text-gray-500" };
                      const Icon = IconCfg.icon;
                      return (
                        <div
                          key={r.id}
                          className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100"
                        >
                          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${IconCfg.color}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800">{r.activity_type}</span>
                              <span className="text-xs text-gray-400">
                                {r.activity_date ? format(parseISO(r.activity_date), "MMM d, yyyy") : "—"}
                              </span>
                              <span className={`text-sm font-semibold ${r.activity_type === "Redemption" ? "text-red-600" : "text-emerald-600"}`}>
                                {r.activity_type === "Redemption" ? "-" : ""}{formatCurrency(r.amount)}
                              </span>
                              {r.level && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 capitalize">
                                  {r.level.replace("_", " ")}
                                </span>
                              )}
                              {r.reference_name && (
                                <span className="text-xs text-gray-400 truncate">
                                  · {r.reference_name}
                                </span>
                              )}
                            </div>
                            {r.notes && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                {stripHtml(r.notes)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                  onClick={() => setAddAllocOpen(p)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Historical Allocation
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Allocation Dialog */}
      {addAllocOpen && (
        <AddAllocationDialog
          open={!!addAllocOpen}
          onOpenChange={(v) => !v && setAddAllocOpen(null)}
          portfolio={addAllocOpen}
          firmName={firmName}
          onSubmit={handleAddAllocation}
        />
      )}

      {/* Portfolio detail dialog (view mode) */}
      <AddPortfolioDialog
        open={portfolioDialogOpen}
        onOpenChange={setPortfolioDialogOpen}
        editingPortfolio={editingPortfolio}
        onSuccess={() => {
          setPortfolioDialogOpen(false);
          setEditingPortfolio(null);
          queryClient.invalidateQueries({ queryKey: advisorMode ? ["portfolios-advisor", firmId] : ["portfolios", firmId] });
          queryClient.invalidateQueries({ queryKey: ["portfolios-all"] });
        }}
      />
    </div>
  );
}

// ── Add Historical Allocation Dialog ───────────────────────────────────────────
function AddAllocationDialog({ open, onOpenChange, portfolio, firmName, onSubmit }) {
  const [activityDate, setActivityDate] = useState("");
  const [activityType, setActivityType] = useState("Capital Addition");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!activityDate || !amount) return;
    setSaving(true);
    try {
      await onSubmit({
        activity_date: activityDate,
        activity_type: activityType,
        amount: amount,
        notes: notes,
      });
      // Reset form
      setActivityDate("");
      setActivityType("Capital Addition");
      setAmount("");
      setNotes("");
    } finally {
      setSaving(false);
    }
  };

  const isValid = activityDate && amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4 text-indigo-500" />
            Add Historical Allocation
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Context info */}
          <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
            <span className="font-medium">{portfolio?.portfolio_name}</span>
            <span className="text-indigo-400"> · </span>
            <span>{firmName}</span>
          </div>

          {/* Cash Flow Date */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Cash Flow Date <span className="text-red-400">*</span>
            </Label>
            <Input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Allocation Type */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Allocation Type <span className="text-red-400">*</span>
            </Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Amount <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter amount..."
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Notes</Label>
            <Textarea
              placeholder="Add any notes about this allocation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[72px] text-sm"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {saving ? "Adding..." : "Add Allocation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}