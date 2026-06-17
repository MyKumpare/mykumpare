import React, { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Search, X, ChevronDown, BarChart2, LayoutList, Link2, CalendarDays, RefreshCw, Play, CheckCircle
} from "lucide-react";
import BenchmarkMultiSelect from "./BenchmarkMultiSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// ── helpers ──────────────────────────────────────────────────────────────────

const ym = (d) => (d ? d.slice(0, 7) : "");
const isMDYFormat = (str) => str && typeof str === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(str);
const formatMDY = (ymStr) => {
  if (!ymStr) return "";
  if (isMDYFormat(ymStr)) return ymStr;
  const [year, month] = ymStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${String(month).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${year}`;
};
const toMonthEnd = (ymStr) => {
  if (!ymStr) return "";
  if (isMDYFormat(ymStr)) return ymStr;
  const [year, month] = ymStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${String(month).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${year}`;
};
const getPriorMonthEnd = (ymStr) => {
  if (!ymStr) return "";
  if (isMDYFormat(ymStr)) return ymStr;
  const [year, month] = ymStr.split("-").map(Number);
  let priorYear = year;
  let priorMonth = month - 1;
  if (priorMonth === 0) {
    priorMonth = 12;
    priorYear = year - 1;
  }
  const lastDay = new Date(priorYear, priorMonth, 0).getDate();
  return `${String(priorMonth).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${priorYear}`;
};
const cleanDate = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes("undefined")) {
    const parts = dateStr.split("/").filter(p => p !== "undefined" && p !== "");
    if (parts.length === 3) return parts.join("/");
    return "";
  }
  return dateStr;
};

const DateRangeTooltip = ({ period, children }) => {
  if (!period) return children;
  return (
    <div className="group relative inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {formatMDY(period.start)} – {formatMDY(period.end)}
      </div>
    </div>
  );
};

function commonPeriod(productConfigs, allProducts, allBenchmarks, allSeries) {
  const starts = [];
  const ends = [];
  for (const cfg of productConfigs) {
    const series = allSeries.filter((s) => s.product_id === cfg.product_id);
    const mr = series.flatMap((s) => s.monthly_returns ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (mr.length) { starts.push(ym(mr[0].date)); ends.push(ym(mr[mr.length - 1].date)); }
    const bmIds = cfg.benchmark_ids ?? (cfg.benchmark_id ? [cfg.benchmark_id] : []);
    for (const bmId of bmIds) {
      const bm = allBenchmarks.find((b) => b.id === bmId);
      const bmr = (bm?.monthly_returns ?? []).sort((a, b) => a.date.localeCompare(b.date));
      if (bmr.length) { starts.push(ym(bmr[0].date)); ends.push(ym(bmr[bmr.length - 1].date)); }
    }
  }
  if (!starts.length) return { start: "", end: "" };
  return { start: starts.sort().pop(), end: ends.sort()[0] };
}

// Measurement type categories
const MEASUREMENT_CATEGORIES = [
  { value: "performance", label: "Performance" },
  { value: "risk", label: "Risk" },
  { value: "efficiency", label: "Efficiency" },
  { value: "valueAtRisk", label: "Value at Risk" },
  { value: "population", label: "Population" },
];

// Measurement periods
const MEASUREMENT_PERIODS = [
  { value: "trailing", label: "Trailing Period" },
  { value: "rolling", label: "Rolling Period" },
  { value: "cumulative", label: "Cumulative Period" },
  { value: "calendar", label: "Calendar Year Period" },
  { value: "historical", label: "Historical Return Period" },
];

// ── ProductSearchDropdown ─────────────────────────────────────────────────────

function ProductSearchDropdown({ products, selectedIds, onToggle, multi, allSeries }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const sorted = useMemo(() =>
    [...products].sort((a, b) => {
      const fa = (a.firm_name || "").toLowerCase();
      const fb = (b.firm_name || "").toLowerCase();
      if (fa !== fb) return fa.localeCompare(fb);
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }), [products]);

  const filtered = sorted.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.firm_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const getProductPeriod = (productId) => {
    const series = allSeries.filter((s) => s.product_id === productId);
    const mr = series.flatMap((s) => s.monthly_returns ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (mr.length === 0) return null;
    return { start: ym(mr[0].date), end: ym(mr[mr.length - 1].date) };
  };

  const selectedProduct = products.find((p) => p.id === selectedIds[0]);
  const selectedProductPeriod = selectedProduct ? getProductPeriod(selectedProduct.id) : null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {!multi && selectedIds.length === 1 && selectedProduct && (
        <div className="px-3 py-2.5 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{selectedProduct.name}</p>
              {selectedProductPeriod && (
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                  {formatMDY(selectedProductPeriod.start)} – {formatMDY(selectedProductPeriod.end)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(selectedProduct.id); }}
              className="text-gray-400 hover:text-red-500 flex-shrink-0"
              title="Remove product"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {selectedProduct.firm_name && <p className="text-xs text-gray-500 mt-0.5">{selectedProduct.firm_name}</p>}
        </div>
      )}
      <div className="p-2 border-b border-gray-100 bg-gray-50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product or firm…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
          />
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">No products found</p>
        ) : (
          filtered.map((p) => {
            const checked = selectedIds.includes(p.id);
            const period = getProductPeriod(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onToggle(p.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs hover:bg-gray-50 transition-colors ${checked ? "bg-indigo-50" : ""}`}
              >
                <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                  {checked && (
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <DateRangeTooltip period={period}>
                    <p className="font-medium text-gray-800 truncate">{p.name}</p>
                  </DateRangeTooltip>
                  {p.firm_name && <p className="text-gray-400 truncate">{p.firm_name}</p>}
                </div>
                {period && (
                  <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                    {formatMDY(period.start)} – {formatMDY(period.end)}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── ToggleButton ──────────────────────────────────────────────────────────────

function TogBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-300 hover:border-indigo-400"}`}
    >
      {children}
    </button>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

export default function NewAnalysisDialog({ open, onOpenChange, onSaved, onProductClick, onBenchmarkClick }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Steps: "meta" → "products" → "period" → "measurement_type" → "measurement_periods" → "review" → "saved"
  const [step, setStep] = useState("meta");
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [measurementCategories, setMeasurementCategories] = useState([]); // [{ category, periods, attributes }]

  // Meta
  const [analysisName, setAnalysisName] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [visibility, setVisibility] = useState("personal");
  const [analysisType, setAnalysisType] = useState(null);

  // Products
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [productConfigs, setProductConfigs] = useState({});

  // Period
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  // Current measurement type selection
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPeriods, setSelectedPeriods] = useState([]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });
  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks-all"],
    queryFn: () => base44.entities.Benchmark.list(),
  });
  const { data: allSeries = [] } = useQuery({
    queryKey: ["return-series-all"],
    queryFn: () => base44.entities.ReturnSeries.list(),
    enabled: open,
  });

  const activeProducts = products.filter((p) => !p.deleted_at);

  const addProduct = (id) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(id)) return prev;
      const product = activeProducts.find((p) => p.id === id);
      const productBms = product?.inv_desc_benchmarks ?? [];
      const defaultBmIds = productBms.map((b) => (typeof b === "object" ? b.id : b)).filter(Boolean);
      setProductConfigs((prev2) => ({
        ...prev2,
        [id]: {
          benchmark_ids: defaultBmIds,
          return_type: "gross",
          include_clone_product: false,
          include_clone_benchmark: false,
        },
      }));
      return [...prev, id];
    });
  };

  const removeProduct = (id) => {
    setSelectedProductIds((prev) => prev.filter((x) => x !== id));
    setProductConfigs((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const toggleProduct = (id) => {
    if (selectedProductIds.includes(id)) removeProduct(id);
    else addProduct(id);
  };

  const updateConfig = (productId, key, value) => {
    setProductConfigs((prev) => ({ ...prev, [productId]: { ...prev[productId], [key]: value } }));
  };

  useEffect(() => {
    selectedProductIds.forEach((id) => {
      if (!productConfigs[id]?.benchmark_ids?.length) {
        const product = activeProducts.find((p) => p.id === id);
        const productBms = product?.inv_desc_benchmarks ?? [];
        const defaultBmIds = productBms.map((b) => (typeof b === "object" ? b.id : b)).filter(Boolean);
        if (defaultBmIds.length) {
          updateConfig(id, "benchmark_ids", defaultBmIds);
        }
      }
    });
  }, [benchmarks, selectedProductIds]);

  useEffect(() => {
    if (selectedProductIds.length > 0 && !periodStart && !periodEnd) {
      const { start, end } = commonPeriod(
        selectedProductIds.map((id) => ({ product_id: id, ...productConfigs[id] })),
        activeProducts, benchmarks, allSeries
      );
      if (start && end) {
        setPeriodStart(getPriorMonthEnd(start));
        setPeriodEnd(toMonthEnd(end));
      }
    }
  }, [selectedProductIds, productConfigs, benchmarks, allSeries]);

  const handleCommonPeriod = () => {
    const { start, end } = commonPeriod(
      selectedProductIds.map((id) => ({ product_id: id, ...productConfigs[id] })),
      activeProducts, benchmarks, allSeries
    );
    setPeriodStart(getPriorMonthEnd(start));
    setPeriodEnd(toMonthEnd(end));
  };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Analysis.create(data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      if (onSaved) onSaved(saved);
      setStep("saved");
    },
  });

  const resetForm = () => {
    setStep("meta");
    setCurrentCategoryIndex(0);
    setMeasurementCategories([]);
    setAnalysisName("");
    setIsTemplate(false);
    setVisibility("personal");
    setAnalysisType(null);
    setSelectedProductIds([]);
    setProductConfigs({});
    setPeriodStart("");
    setPeriodEnd("");
    setSelectedCategory("");
    setSelectedPeriods([]);
  };

  const handleSave = () => {
    const data = {
      name: analysisName,
      is_template: isTemplate,
      visibility,
      analysis_type: analysisType,
      product_configs: selectedProductIds.map((id) => {
        const cfg = productConfigs[id] ?? {};
        const product = activeProducts.find((p) => p.id === id);
        const bmIds = cfg.benchmark_ids ?? [];
        return {
          product_id: id,
          product_name: product?.name ?? "",
          firm_name: product?.firm_name ?? "",
          benchmark_ids: bmIds,
          benchmark_names: bmIds.map((bmId) => benchmarks.find((b) => b.id === bmId)?.name ?? ""),
          return_type: cfg.return_type ?? "gross",
          include_clone_product: cfg.include_clone_product ?? false,
          include_clone_benchmark: cfg.include_clone_benchmark ?? false,
        };
      }),
      period_start: cleanDate(periodStart) || "",
      period_end: cleanDate(periodEnd) || "",
      use_common_period: false,
      created_by_id: user?.id ?? "",
      measurement_periods: {
        trailing_periods: [],
        trailing_custom_start: "",
        trailing_custom_end: "",
        rolling_periods: [],
        rolling_custom_start: "",
        rolling_custom_end: "",
        include_cumulative: false,
        calendar_years: [],
        historical_periods: [],
      },
      measurement_type: {
        selected_types: measurementCategories.map(c => c.category),
        attributes: [],
        view_mode: "chart",
        categories_config: measurementCategories,
      },
    };
    saveMutation.mutate(data);
  };

  const addMeasurementCategory = () => {
    setMeasurementCategories((prev) => [
      ...prev,
      { category: selectedCategory, periods: selectedPeriods, attributes: [] },
    ]);
    setSelectedCategory("");
    setSelectedPeriods([]);
    setCurrentCategoryIndex((prev) => prev + 1);
  };

  const canProceedMeta = analysisName.trim() && analysisType;
  const canProceedProducts = selectedProductIds.length > 0;
  const canProceedPeriod = periodStart && periodEnd;
  const canProceedMeasurementType = selectedCategory;
  const canProceedMeasurementPeriods = selectedPeriods.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            New Analysis
            {isTemplate && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Template</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === "meta" && (
          <div className="space-y-5 mt-1">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Analysis Name</label>
              <input
                autoFocus
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
                placeholder="e.g. Q2 2026 Manager Review"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Analysis Mode</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: false, label: "Standard Analysis", desc: "A one-time analysis with fixed product, benchmark & period" },
                  { key: true, label: "Template", desc: "Reusable — product, benchmark & period can be changed each time" },
                ].map(({ key, label, desc }) => (
                  <button
                    key={String(key)}
                    type="button"
                    onClick={() => setIsTemplate(key)}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${isTemplate === key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <p className={`text-sm font-semibold ${isTemplate === key ? "text-indigo-700" : "text-gray-700"}`}>{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Visibility</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "personal", label: "Personal", desc: "Only you can view, edit, or delete" },
                  { key: "firm", label: "Firm", desc: "Anyone can view & edit; only you can delete" },
                ].map(({ key, label, desc }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVisibility(key)}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${visibility === key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <p className={`text-sm font-semibold ${visibility === key ? "text-indigo-700" : "text-gray-700"}`}>{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Analysis Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "single", icon: <BarChart2 className="w-4 h-4" />, label: "Single Product", desc: "Analyze one product in depth" },
                  { key: "multiple", icon: <LayoutList className="w-4 h-4" />, label: "Multiple Products", desc: "Compare several products side-by-side" },
                ].map(({ key, icon, label, desc }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAnalysisType(key)}
                    className={`text-left p-3 rounded-xl border-2 transition-colors flex gap-3 items-start ${analysisType === key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <span className={`mt-0.5 ${analysisType === key ? "text-indigo-600" : "text-gray-400"}`}>{icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${analysisType === key ? "text-indigo-700" : "text-gray-700"}`}>{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setStep("products")}
                disabled={!canProceedMeta}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === "products" && (
          <div className="space-y-6 mt-1">
            <button type="button" onClick={() => setStep("meta")} className="text-xs text-indigo-600 hover:underline">← Back</button>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                {analysisType === "single" ? "Select Product" : "Select Products"}
              </label>
              <ProductSearchDropdown
                products={activeProducts}
                selectedIds={selectedProductIds}
                onToggle={analysisType === "single"
                  ? (id) => { setSelectedProductIds([]); setProductConfigs({}); setTimeout(() => addProduct(id), 0); }
                  : toggleProduct}
                multi={analysisType === "multiple"}
                allSeries={allSeries}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep("meta")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button
                type="button"
                onClick={() => setStep("period")}
                disabled={!canProceedProducts}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === "period" && (
          <div className="space-y-6 mt-1">
            <button type="button" onClick={() => setStep("products")} className="text-xs text-indigo-600 hover:underline">← Back</button>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Analysis Period</label>
                <button
                  type="button"
                  onClick={handleCommonPeriod}
                  title="Set to common period across all selected products & benchmarks"
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Common Period
                </button>
              </div>
              <div className="flex items-start gap-4 flex-wrap">
                <div>
                  <input
                    type="text"
                    value={periodStart || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(val) || val === "") {
                        setPeriodStart(val);
                      }
                    }}
                    placeholder="MM/DD/YYYY"
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28"
                  />
                  <p className="text-xs text-gray-500 mt-1 font-medium">Start Date</p>
                </div>
                <span className="text-xs text-gray-400 mt-2">to</span>
                <div>
                  <input
                    type="text"
                    value={periodEnd || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(val) || val === "") {
                        setPeriodEnd(val);
                      }
                    }}
                    placeholder="MM/DD/YYYY"
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28"
                  />
                  <p className="text-xs text-gray-500 mt-1 font-medium">End Date</p>
                </div>
                {(periodStart || periodEnd) && (
                  <button type="button" onClick={() => { setPeriodStart(""); setPeriodEnd(""); }} className="text-xs text-gray-400 hover:text-indigo-600 hover:underline mt-2">Clear</button>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep("products")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button
                type="button"
                onClick={() => setStep("measurement_type")}
                disabled={!canProceedPeriod}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === "measurement_type" && (
          <div className="space-y-6 mt-1">
            <button type="button" onClick={() => setStep("period")} className="text-xs text-indigo-600 hover:underline">← Back</button>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Select Measurement Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a measurement category..." />
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {measurementCategories.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Selected Categories</label>
                {measurementCategories.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{MEASUREMENT_CATEGORIES.find(c => c.value === cat.category)?.label}</span>
                    <span className="text-gray-400">({cat.periods.length} periods)</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep("period")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              {measurementCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStep("review")}
                  className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  Finish & Review
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep("measurement_periods")}
                disabled={!canProceedMeasurementType}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === "measurement_periods" && (
          <div className="space-y-6 mt-1">
            <button type="button" onClick={() => setStep("measurement_type")} className="text-xs text-indigo-600 hover:underline">← Back</button>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                Select Periods for {MEASUREMENT_CATEGORIES.find(c => c.value === selectedCategory)?.label}
              </label>
              <div className="space-y-3">
                {MEASUREMENT_PERIODS.map((period) => (
                  <div key={period.value} className="flex items-center gap-2">
                    <Checkbox
                      id={period.value}
                      checked={selectedPeriods.includes(period.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPeriods((prev) => [...prev, period.value]);
                        } else {
                          setSelectedPeriods((prev) => prev.filter((p) => p !== period.value));
                        }
                      }}
                    />
                    <label htmlFor={period.value} className="text-sm text-gray-700 cursor-pointer">{period.label}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep("measurement_type")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  addMeasurementCategory();
                  setStep("measurement_type");
                }}
                disabled={!canProceedMeasurementPeriods}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
              >
                {measurementCategories.length > 0 ? "Add Another Category" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-6 mt-1">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Analysis Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="text-gray-800 font-medium">{analysisName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Products:</span>
                  <span className="text-gray-800 font-medium">{selectedProductIds.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Period:</span>
                  <span className="text-gray-800 font-medium">{periodStart} to {periodEnd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Measurement Categories:</span>
                  <span className="text-gray-800 font-medium">{measurementCategories.length}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep("measurement_type")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">← Back</button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
              >
                {saveMutation.isPending ? "Saving..." : "Save Analysis"}
              </button>
            </div>
          </div>
        )}

        {step === "saved" && (
          <div className="space-y-6 mt-1 text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Analysis Saved Successfully!</h3>
            <p className="text-sm text-gray-600">Click the process button below to begin the analysis.</p>
            <div className="flex justify-center gap-2 pt-4">
              <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Close</button>
              <button
                type="button"
                onClick={() => {
                  // TODO: Trigger analysis processing
                  onOpenChange(false);
                }}
                className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Process Analysis
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}