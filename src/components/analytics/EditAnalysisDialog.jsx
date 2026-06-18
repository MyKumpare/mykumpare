import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { CalendarDays, RefreshCw, Link2, Trash2, BarChart2, Plus, Pencil, CheckCircle } from "lucide-react";
import BenchmarkMultiSelect from "./BenchmarkMultiSelect";
import AnalysisResults from "./AnalysisResults";

const ym = (d) => (d ? d.slice(0, 7) : "");
// Clean and validate MM/DD/YYYY dates
const cleanDate = (dateStr) => {
  if (!dateStr) return "";
  // Fix corrupted dates like "undefined/01/09/30/2008"
  if (dateStr.includes("undefined")) {
    const parts = dateStr.split("/").filter(p => p !== "undefined" && p !== "");
    if (parts.length === 3) {
      return parts.join("/");
    }
    return "";
  }
  return dateStr;
};
const toMonthEnd = (ymStr) => {
  if (!ymStr) return "";
  // If already in MM/DD/YYYY format, return as-is
  if (ymStr.includes("/")) return ymStr;
  const [year, month] = ymStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${String(month).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${year}`;
};
// Get prior month-end date from a YYYY-MM string
const getPriorMonthEnd = (ymStr) => {
  if (!ymStr) return "";
  if (ymStr.includes("/")) return ymStr;
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

function commonPeriod(productConfigs, allProducts, allBenchmarks, allSeries) {
  const starts = [], ends = [];
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



function TogBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
      {children}
    </button>
  );
}

const MEASUREMENT_CATEGORIES = [
  { value: "performance", label: "Performance", attributes: ["Return","Cumulative Return","Excess Return","Cumulative Excess Return","Excess Return Geometric","Average Return","Average Positive Return","Average Negative Return","Growth of $100","Best Period","Worst Period","Number of Consecutive Periods","Number of Consecutive Negative Periods","Down Period Percent","Up Period Percent","Percent Profitable Period","Manager Consistency","Number of Observations","Periods Above the Benchmark","Percentage Above the Benchmark"] },
  { value: "risk", label: "Risk and Regression", attributes: ["Standard Deviation","Downside Deviation","Variance","Skewness","Kurtosis","Information Ratio","Sharpe Ratio","Sortino Ratio","Beta","Alpha","R-Squared","Tracking Error","Treynor Ratio"] },
  { value: "efficiency", label: "Efficiency", attributes: ["Efficiency Ratio","Calmar Ratio","Sterling Ratio","Burke Ratio","Pain Index","Pain Ratio"] },
  { value: "valueAtRisk", label: "Value at Risk", attributes: ["Value at Risk (VaR)","Conditional VaR (CVaR)","Maximum Drawdown","Average Drawdown","Drawdown Duration","Recovery Factor"] },
  { value: "population", label: "Population Calculations", attributes: ["Population Variance","Population Standard Deviation","Population Skewness","Population Kurtosis"] },
];

const TRAILING_OPTIONS = [
  { value: "1M", label: "Trailing 1 Month" },
  { value: "3M", label: "Trailing 3 Months" },
  { value: "QTD", label: "QTD" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1 Year" },
  { value: "2Y", label: "2 Years" },
  { value: "3Y", label: "3 Years" },
  { value: "4Y", label: "4 Years" },
  { value: "5Y", label: "5 Years" },
  { value: "7Y", label: "7 Years" },
  { value: "10Y", label: "10 Years" },
  { value: "since_inception", label: "Since Inception" },
  { value: "custom", label: "Custom Period" },
];

const ROLLING_OPTIONS = [
  { value: "1M", label: "Rolling 1 Month" },
  { value: "2M", label: "Rolling 2 Months" },
  { value: "3M", label: "Rolling 3 Months" },
  { value: "6M", label: "Rolling 6 Months" },
  { value: "1Y", label: "Rolling 1 Year" },
  { value: "3Y", label: "Rolling 3 Years" },
  { value: "5Y", label: "Rolling 5 Years" },
  { value: "10Y", label: "Rolling 10 Years" },
  { value: "custom", label: "Custom Period" },
];

const HISTORICAL_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annual" },
];

const emptyPeriodConfig = () => ({
  trailing: [],
  trailing_custom_periods: [],
  rolling: [],
  rolling_custom_periods: [],
  cumulative: false,
  calendar_years: [],
  calendar_include_ctd: false,
  historical: [],
});

const emptyBenchmarkConfig = () => ({
  show_default: true,
  secondary_benchmark_ids: [],
});

function CustomPeriodsEditor({ periods, onChange }) {
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const addPeriod = () => {
    if (!newStart || !newEnd) return;
    const label = `${newStart} – ${newEnd}`;
    onChange([...periods, { start: newStart, end: newEnd, label }]);
    setNewStart("");
    setNewEnd("");
  };

  const removePeriod = (idx) => onChange(periods.filter((_, i) => i !== idx));

  return (
    <div className="mt-2 space-y-2">
      {periods.length > 0 && (
        <div className="space-y-1">
          {periods.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs">
              <span className="text-indigo-700 font-medium">{p.start} – {p.end}</span>
              <button type="button" onClick={() => removePeriod(idx)} className="text-gray-400 hover:text-red-500 ml-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg flex-wrap">
        <div>
          <input type="text" value={newStart} onChange={e => setNewStart(e.target.value)}
            placeholder="MM/DD/YYYY"
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28" />
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Start Date</p>
        </div>
        <span className="text-xs text-gray-400 pb-4">to</span>
        <div>
          <input type="text" value={newEnd} onChange={e => setNewEnd(e.target.value)}
            placeholder="MM/DD/YYYY"
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28" />
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">End Date</p>
        </div>
        <button type="button" onClick={addPeriod} disabled={!newStart || !newEnd}
          className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors mb-0.5">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

function PeriodConfigPanel({ periodConfig, setPeriodConfig, periodStart, periodEnd }) {
  const [expanded, setExpanded] = useState({ trailing: true, rolling: false, cumulative: false, calendar: false, historical: false });
  const toggle = (type) => setExpanded(prev => ({ ...prev, [type]: !prev[type] }));
  const toggleArr = (field, val) => setPeriodConfig(prev => {
    const cur = prev[field] || [];
    return { ...prev, [field]: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] };
  });

  const availableYears = useMemo(() => {
    if (!periodStart || !periodEnd) return [];
    const parseMDY = (mdy) => { const [m, d, y] = mdy.split("/").map(Number); return new Date(y, m - 1, d); };
    const start = parseMDY(periodStart), end = parseMDY(periodEnd);
    const years = [];
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) years.push(y);
    return years;
  }, [periodStart, periodEnd]);

  const SectionHeader = ({ type, label, badge }) => (
    <button type="button" onClick={() => toggle(type)}
      className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        {badge > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{badge} selected</span>}
        {badge === true && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">On</span>}
      </div>
      {expanded[type] ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-400"><path d="M18 15l-6-6-6 6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-400"><path d="M6 9l6 6 6-6" /></svg>}
    </button>
  );

  return (
    <div className="space-y-2">
      {/* Trailing */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader type="trailing" label="Trailing Period" badge={(periodConfig.trailing || []).length} />
        {expanded.trailing && (
          <div className="p-4 border-t border-gray-200 space-y-3">
            <div className="flex flex-wrap gap-2">
              {TRAILING_OPTIONS.filter(o => o.value !== "custom").map(({ value, label }) => (
                <TogBtn key={value} active={(periodConfig.trailing || []).includes(value)}
                  onClick={() => toggleArr("trailing", value)}>{label}</TogBtn>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Custom Periods</p>
              <CustomPeriodsEditor
                periods={periodConfig.trailing_custom_periods || []}
                onChange={(val) => setPeriodConfig(prev => ({ ...prev, trailing_custom_periods: val }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Rolling */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader type="rolling" label="Rolling Period" badge={(periodConfig.rolling || []).length} />
        {expanded.rolling && (
          <div className="p-4 border-t border-gray-200 space-y-3">
            <div className="flex flex-wrap gap-2">
              {ROLLING_OPTIONS.filter(o => o.value !== "custom").map(({ value, label }) => (
                <TogBtn key={value} active={(periodConfig.rolling || []).includes(value)}
                  onClick={() => toggleArr("rolling", value)}>{label}</TogBtn>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Custom Periods</p>
              <CustomPeriodsEditor
                periods={periodConfig.rolling_custom_periods || []}
                onChange={(val) => setPeriodConfig(prev => ({ ...prev, rolling_custom_periods: val }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cumulative */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader type="cumulative" label="Cumulative Period" badge={periodConfig.cumulative ? true : 0} />
        {expanded.cumulative && (
          <div className="p-4 border-t border-gray-200">
            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!!periodConfig.cumulative}
                onChange={(e) => setPeriodConfig(prev => ({ ...prev, cumulative: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600" />
              Show cumulative result over analysis period
            </label>
          </div>
        )}
      </div>

      {/* Calendar Year */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader type="calendar" label="Calendar Year Period" badge={(periodConfig.calendar_years || []).length} />
        {expanded.calendar && (
          <div className="p-4 border-t border-gray-200 space-y-3">
            {availableYears.length > 0 ? (
              <>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setPeriodConfig(prev => ({ ...prev, calendar_years: availableYears }))}
                    className="text-xs text-indigo-600 hover:underline font-medium">Select All</button>
                  <button type="button" onClick={() => setPeriodConfig(prev => ({ ...prev, calendar_years: [] }))}
                    className="text-xs text-gray-500 hover:underline font-medium">Clear All</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableYears.map((year) => (
                    <TogBtn key={year} active={(periodConfig.calendar_years || []).includes(year)}
                      onClick={() => toggleArr("calendar_years", year)}>{year}</TogBtn>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mt-1">
                  <input type="checkbox" checked={!!periodConfig.calendar_include_ctd}
                    onChange={(e) => setPeriodConfig(prev => ({ ...prev, calendar_include_ctd: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600" />
                  Include Calendar-to-Date (CTD)
                </label>
              </>
            ) : (
              <p className="text-xs text-gray-400">Set analysis period first to see available calendar years.</p>
            )}
          </div>
        )}
      </div>

      {/* Historical */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader type="historical" label="Historical Return Period" badge={(periodConfig.historical || []).length} />
        {expanded.historical && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              {HISTORICAL_OPTIONS.map(({ value, label }) => (
                <TogBtn key={value} active={(periodConfig.historical || []).includes(value)}
                  onClick={() => toggleArr("historical", value)}>{label}</TogBtn>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditAnalysisDialog({ open, onOpenChange, analysis }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [showResults, setShowResults] = useState(true); // Show existing results immediately
  const [savedAnalysis, setSavedAnalysis] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track if user has edited anything
  const [resultsKey, setResultsKey] = useState(0); // Force Results tab remount after save
  const autoSaveTimeoutRef = useRef(null);

  // Form state
  const [analysisName, setAnalysisName] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [visibility, setVisibility] = useState("personal");
  const [productConfigs, setProductConfigs] = useState({});
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [measurementCategories, setMeasurementCategories] = useState([]);
  const [editingCategoryIndex, setEditingCategoryIndex] = useState(null);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [periodConfig, setPeriodConfig] = useState({
    trailing: [],
    trailing_custom_periods: [],
    rolling: [],
    rolling_custom_periods: [],
    cumulative: false,
    calendar_years: [],
    calendar_include_ctd: false,
    historical: [],
  });
  const [benchmarkConfig, setBenchmarkConfig] = useState({
    show_default: true,
    secondary_benchmark_ids: [],
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
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });
  const activeProducts = products.filter((p) => !p.deleted_at);

  // Populate form when analysis changes
  useEffect(() => {
    if (!analysis) return;
    setAnalysisName(analysis.name ?? "");
    setIsTemplate(analysis.is_template ?? false);
    setVisibility(analysis.visibility ?? "personal");
    // Clean and validate period dates (handle corrupted "undefined" dates)
    const startDate = cleanDate(analysis.period_start || "");
    const endDate = cleanDate(analysis.period_end || "");
    setPeriodStart(startDate);
    setPeriodEnd(endDate);
    const configs = {};
    (analysis.product_configs ?? []).forEach((cfg) => {
      // Support both old single benchmark_id and new benchmark_ids array
      const bmIds = cfg.benchmark_ids ?? (cfg.benchmark_id ? [cfg.benchmark_id] : []);
      configs[cfg.product_id] = {
        benchmark_ids: bmIds,
        return_type: cfg.return_type ?? "gross",
        include_clone_product: cfg.include_clone_product ?? false,
        include_clone_benchmark: cfg.include_clone_benchmark ?? false,
      };
    });
    setProductConfigs(configs);
    // Load measurement categories (categories_config)
    setMeasurementCategories(analysis.categories_config || []);
    setConfirmDelete(false);
    setHasUnsavedChanges(false);
    setShowResults(true);
  }, [analysis]);

  const selectedProductIds = (analysis?.product_configs ?? []).map((c) => c.product_id);

  const updateConfig = (productId, key, value) => {
    setProductConfigs((prev) => ({ ...prev, [productId]: { ...prev[productId], [key]: value } }));
    setHasUnsavedChanges(true);
  };

  const handleCommonPeriod = () => {
    const { start, end } = commonPeriod(
      selectedProductIds.map((id) => ({ product_id: id, ...productConfigs[id] })),
      activeProducts, benchmarks, allSeries
    );
    setPeriodStart(getPriorMonthEnd(start));
    setPeriodEnd(toMonthEnd(end));
  };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Analysis.update(analysis?.id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      setHasUnsavedChanges(false);
      setSavedAnalysis(updated);
      setShowResults(true);
      setActiveTab("results");
      setResultsKey(prev => prev + 1); // Force Results tab to remount with fresh data
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Analysis.delete(analysis?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      onOpenChange(false);
    },
  });

  const handleSave = () => {
    const data = {
      name: analysisName,
      is_template: isTemplate,
      visibility,
      analysis_type: analysis?.analysis_type || "single",
      product_configs: selectedProductIds.map((id) => {
        const cfg = productConfigs[id] ?? {};
        const product = activeProducts.find((p) => p.id === id);
        const savedCfg = (analysis.product_configs ?? []).find((c) => c.product_id === id) ?? {};
        const bmIds = cfg.benchmark_ids ?? [];
        return {
          product_id: id,
          product_name: product?.name ?? savedCfg.product_name ?? "",
          firm_name: product?.firm_name ?? savedCfg.firm_name ?? "",
          benchmark_ids: bmIds,
          benchmark_names: bmIds.map((bmId) => benchmarks.find((b) => b.id === bmId)?.name ?? ""),
          return_type: cfg.return_type ?? "gross",
          include_clone_product: cfg.include_clone_product ?? false,
          include_clone_benchmark: cfg.include_clone_benchmark ?? false,
        };
      }),
      period_start: cleanDate(periodStart),
      period_end: cleanDate(periodEnd),
      use_common_period: false,
      created_by_id: analysis?.created_by_id || user?.id,
      categories_config: measurementCategories,
      measurement_type: {
        selected_types: measurementCategories.map(c => c.category),
        attributes: measurementCategories.flatMap(c => c.attributes ?? []),
        view_mode: "table",
      },
    };
    saveMutation.mutate(data);
  };

  // Auto-save and re-process when on Results tab with unsaved changes (debounced)
  useEffect(() => {
    if (activeTab === "results" && hasUnsavedChanges && analysisName.trim() && analysis && !saveMutation.isPending) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      // Debounce auto-save by 500ms to avoid rapid saves while typing
      autoSaveTimeoutRef.current = setTimeout(() => {
        const data = {
          name: analysisName,
          is_template: isTemplate,
          visibility,
          analysis_type: analysis?.analysis_type || "single",
          product_configs: selectedProductIds.map((id) => {
            const cfg = productConfigs[id] ?? {};
            const product = activeProducts.find((p) => p.id === id);
            const savedCfg = (analysis.product_configs ?? []).find((c) => c.product_id === id) ?? {};
            const bmIds = cfg.benchmark_ids ?? [];
            return {
              product_id: id,
              product_name: product?.name ?? savedCfg.product_name ?? "",
              firm_name: product?.firm_name ?? savedCfg.firm_name ?? "",
              benchmark_ids: bmIds,
              benchmark_names: bmIds.map((bmId) => benchmarks.find((b) => b.id === bmId)?.name ?? ""),
              return_type: cfg.return_type ?? "gross",
              include_clone_product: cfg.include_clone_product ?? false,
              include_clone_benchmark: cfg.include_clone_benchmark ?? false,
            };
          }),
          period_start: cleanDate(periodStart),
          period_end: cleanDate(periodEnd),
          use_common_period: false,
          created_by_id: analysis?.created_by_id || user?.id,
          categories_config: measurementCategories,
          measurement_type: {
            selected_types: measurementCategories.map(c => c.category),
            attributes: measurementCategories.flatMap(c => c.attributes ?? []),
            view_mode: "table",
          },
        };
        saveMutation.mutate(data);
      }, 500);
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [activeTab, hasUnsavedChanges, analysisName, isTemplate, visibility, analysis, selectedProductIds, productConfigs, activeProducts, benchmarks, periodStart, periodEnd, measurementCategories, saveMutation.isPending]);

  const isOwner = !analysis?.created_by_id || analysis?.created_by_id === user?.id;

  if (!analysis) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            Edit Analysis
            {isTemplate && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Template</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <span>Details</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2" disabled={!showResults}>
              <BarChart2 className="w-4 h-4" />
              <span>Results</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-5 mt-1">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Analysis Name</label>
            <input
              value={analysisName}
              onChange={(e) => { setAnalysisName(e.target.value); setHasUnsavedChanges(true); }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Template toggle */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Analysis Mode</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: false, label: "Standard Analysis", desc: "A one-time analysis with fixed product, benchmark & period" },
                { key: true, label: "Template", desc: "Reusable — product, benchmark & period can be changed each time" },
              ].map(({ key, label, desc }) => (
                <button key={String(key)} type="button" onClick={() => { setIsTemplate(key); setHasUnsavedChanges(true); }}
                  className={`text-left p-3 rounded-xl border-2 transition-colors ${isTemplate === key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <p className={`text-sm font-semibold ${isTemplate === key ? "text-indigo-700" : "text-gray-700"}`}>{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "personal", label: "Personal", desc: "Only you can view, edit, or delete" },
                { key: "firm", label: "Firm", desc: "Anyone can view & edit; only you can delete" },
              ].map(({ key, label, desc }) => (
                <button key={key} type="button" onClick={() => { setVisibility(key); setHasUnsavedChanges(true); }}
                  className={`text-left p-3 rounded-xl border-2 transition-colors ${visibility === key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <p className={`text-sm font-semibold ${visibility === key ? "text-indigo-700" : "text-gray-700"}`}>{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Per-product configuration */}
          {selectedProductIds.length > 0 && analysis && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
                {analysis?.analysis_type === "single" ? "Product" : "Products"}
              </label>
              {selectedProductIds.map((id) => {
                const product = activeProducts.find((p) => p.id === id);
                const savedCfg = (analysis.product_configs ?? []).find((c) => c.product_id === id) ?? {};
                const cfg = productConfigs[id] ?? {};
                const displayName = product?.name ?? savedCfg.product_name ?? id;
                const displayFirm = product?.firm_name ?? savedCfg.firm_name ?? "";
                return (
                  <div key={id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{displayName}</p>
                      {displayFirm && <p className="text-xs text-gray-500">{displayFirm}</p>}
                    </div>

                    <div className="grid grid-cols-[auto_1fr] items-start gap-2">
                      <label className="text-xs text-gray-500 font-medium whitespace-nowrap mt-1.5">Benchmarks</label>
                      <BenchmarkMultiSelect
                        benchmarks={benchmarks}
                        selectedIds={cfg.benchmark_ids ?? []}
                        onChange={(ids) => updateConfig(id, "benchmark_ids", ids)}
                        productBenchmarks={activeProducts.find((p) => p.id === id)?.inv_desc_benchmarks ?? []}
                      />
                    </div>

                    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                      <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Return Type</label>
                      <div className="flex gap-1">
                        {["gross", "net", "both"].map((rt) => (
                          <TogBtn key={rt} active={cfg.return_type === rt} onClick={() => updateConfig(id, "return_type", rt)}>
                            {rt.charAt(0).toUpperCase() + rt.slice(1)}
                          </TogBtn>
                        ))}
                      </div>
                    </div>

                    {cfg.return_type !== "both" && (
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={cfg.include_clone_product ?? false}
                            onChange={(e) => updateConfig(id, "include_clone_product", e.target.checked)}
                            className="rounded border-gray-300 text-indigo-600" />
                          <span>Include clone return (product)</span>
                        </label>
                        {(cfg.benchmark_ids ?? []).length > 0 && (
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={cfg.include_clone_benchmark ?? false}
                              onChange={(e) => updateConfig(id, "include_clone_benchmark", e.target.checked)}
                              className="rounded border-gray-300 text-indigo-600" />
                            <span>Include clone return (benchmark)</span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Analysis period */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Analysis Period</label>
              <button type="button" onClick={handleCommonPeriod}
                className="ml-auto flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                <RefreshCw className="w-3 h-3" /> Common Period
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={periodStart || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(val) || val === "") {
                    setPeriodStart(val);
                    setHasUnsavedChanges(true);
                  }
                }}
                placeholder="MM/DD/YYYY"
                className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="text"
                value={periodEnd || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(val) || val === "") {
                    setPeriodEnd(val);
                    setHasUnsavedChanges(true);
                  }
                }}
                placeholder="MM/DD/YYYY"
                className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28"
              />
              {(periodStart || periodEnd) && (
                <button type="button" onClick={() => { setPeriodStart(""); setPeriodEnd(""); }} className="text-xs text-gray-400 hover:text-indigo-600 hover:underline">Clear</button>
              )}
            </div>
            {!periodStart && !periodEnd && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Link2 className="w-3 h-3" /> No period set — click "Common Period" to set automatically.
              </p>
            )}
          </div>

          {/* Measurement categories management */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Measurement Categories</label>
              <button type="button" onClick={() => { setShowCategoryEditor(true); setEditingCategoryIndex(null); setSelectedCategory(""); setSelectedAttributes([]); setPeriodConfig(emptyPeriodConfig()); setBenchmarkConfig(emptyBenchmarkConfig()); }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Category
              </button>
            </div>
            {measurementCategories.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-4 text-center bg-gray-50 rounded-lg">No measurement categories added yet. Click "Add Category" to configure your analysis metrics.</p>
            ) : (
              <div className="space-y-2">
                {measurementCategories.map((cat, idx) => {
                  const pc = cat.periodConfig || {};
                  const trailingCount = (pc.trailing || []).length + (pc.trailing_custom_periods || []).length;
                  const rollingCount = (pc.rolling || []).length + (pc.rolling_custom_periods || []).length;
                  const historicalCount = (pc.historical || []).length;
                  const calCount = (pc.calendar_years || []).length;
                  const parts = [
                    trailingCount > 0 && `${trailingCount} trailing`,
                    rollingCount > 0 && `${rollingCount} rolling`,
                    pc.cumulative && "cumulative",
                    calCount > 0 && `${calCount} cal. years`,
                    historicalCount > 0 && `${historicalCount} historical`,
                  ].filter(Boolean).join(", ");
                  return (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-2.5 rounded-lg border border-gray-200">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <span className="font-semibold text-gray-700 capitalize">{cat.category}</span>
                        {parts && <span className="text-gray-400 ml-1">· {parts}</span>}
                        <span className="text-gray-400 ml-1">· {cat.attributes?.length ?? 0} attrs</span>
                      </div>
                      <button type="button" onClick={() => { setEditingCategoryIndex(idx); setSelectedCategory(cat.category); setSelectedAttributes(cat.attributes || []); setPeriodConfig(cat.periodConfig || emptyPeriodConfig()); setBenchmarkConfig(cat.benchmarkConfig || emptyBenchmarkConfig()); setShowCategoryEditor(true); }}
                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setMeasurementCategories((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Category Editor Modal */}
          {showCategoryEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCategoryEditor(false)}>
              <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-200">
                  <h3 className="text-base font-bold text-gray-800">{editingCategoryIndex !== null ? "Edit" : "Add"} Measurement Category</h3>
                </div>
                <div className="p-5 space-y-5">
                  {/* Category selector */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Select Category</label>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      disabled={editingCategoryIndex !== null}>
                      <option value="">Choose a measurement category...</option>
                      {MEASUREMENT_CATEGORIES.map((cat) => {
                        const alreadyAdded = measurementCategories.some((c, i) => c.category === cat.value && i !== editingCategoryIndex);
                        return (
                          <option key={cat.value} value={cat.value} disabled={alreadyAdded}>
                            {cat.label}{alreadyAdded ? " (already added)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Attributes selector */}
                  {selectedCategory && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Attributes</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setSelectedAttributes(MEASUREMENT_CATEGORIES.find(c => c.value === selectedCategory)?.attributes || [])} className="text-xs text-indigo-600 hover:underline">Select All</button>
                          <button type="button" onClick={() => setSelectedAttributes([])} className="text-xs text-gray-400 hover:underline">Clear</button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-200">
                        {(MEASUREMENT_CATEGORIES.find(c => c.value === selectedCategory)?.attributes || []).map((attr) => (
                          <button key={attr} type="button" onClick={() => setSelectedAttributes((prev) => prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr])}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${selectedAttributes.includes(attr) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                            {attr}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Period configuration */}
                  {selectedCategory && selectedAttributes.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">Configure Periods</label>
                      <PeriodConfigPanel
                        periodConfig={periodConfig}
                        setPeriodConfig={setPeriodConfig}
                        periodStart={periodStart}
                        periodEnd={periodEnd}
                      />
                    </div>
                  )}
                </div>
                <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowCategoryEditor(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                  <button type="button"
                    onClick={() => {
                      if (!selectedCategory || selectedAttributes.length === 0) return;
                      const entry = {
                        category: selectedCategory,
                        attributes: selectedAttributes,
                        periodConfig,
                        benchmarkConfig,
                        periods: [
                          ...(periodConfig.trailing?.length || periodConfig.trailing_custom_periods?.length ? ["trailing"] : []),
                          ...(periodConfig.rolling?.length || periodConfig.rolling_custom_periods?.length ? ["rolling"] : []),
                          ...(periodConfig.cumulative ? ["cumulative"] : []),
                          ...(periodConfig.calendar_years?.length ? ["calendar"] : []),
                          ...(periodConfig.historical?.length ? ["historical"] : []),
                        ],
                      };
                      if (editingCategoryIndex !== null) {
                        setMeasurementCategories((prev) => prev.map((c, i) => i === editingCategoryIndex ? entry : c));
                      } else {
                        setMeasurementCategories((prev) => [...prev, entry]);
                      }
                      setShowCategoryEditor(false);
                      setHasUnsavedChanges(true);
                    }}
                    disabled={!selectedCategory || selectedAttributes.length === 0}
                    className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                    {editingCategoryIndex !== null ? "Update Category" : "Add Category"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            {/* Delete — only owner */}
            {isOwner && !confirmDelete && (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
            {isOwner && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Delete this analysis?</span>
                <button type="button" onClick={() => deleteMutation.mutate()}
                  className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-40"
                  disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? "Deleting…" : "Yes, Delete"}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            )}
            {!isOwner && <div />}

            <div className="flex gap-2">
              <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button type="button" onClick={handleSave} disabled={!analysisName.trim() || saveMutation.isPending}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                {saveMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
          </TabsContent>

          <TabsContent value="results" className="mt-1">
            {saveMutation.isPending ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-gray-500">Processing analysis...</p>
              </div>
            ) : (
              <AnalysisResults
                key={resultsKey}
                analysis={{
                  ...analysis,
                  name: analysisName,
                  is_template: isTemplate,
                  visibility,
                  analysis_type: analysis?.analysis_type || "single",
                  product_configs: selectedProductIds.map((id) => {
                    const cfg = productConfigs[id] ?? {};
                    const product = activeProducts.find((p) => p.id === id);
                    const savedCfg = (analysis.product_configs ?? []).find((c) => c.product_id === id) ?? {};
                    const bmIds = cfg.benchmark_ids ?? [];
                    return {
                      product_id: id,
                      product_name: product?.name ?? savedCfg.product_name ?? "",
                      firm_name: product?.firm_name ?? savedCfg.firm_name ?? "",
                      benchmark_ids: bmIds,
                      benchmark_names: bmIds.map((bmId) => benchmarks.find((b) => b.id === bmId)?.name ?? ""),
                      return_type: cfg.return_type ?? "gross",
                      include_clone_product: cfg.include_clone_product ?? false,
                      include_clone_benchmark: cfg.include_clone_benchmark ?? false,
                    };
                  }),
                  period_start: cleanDate(periodStart),
                  period_end: cleanDate(periodEnd),
                  use_common_period: false,
                  categories_config: measurementCategories,
                  measurement_type: {
                    selected_types: measurementCategories.map(c => c.category),
                    attributes: measurementCategories.flatMap(c => c.attributes ?? []),
                    view_mode: "table",
                  },
                }}
                products={activeProducts}
                benchmarks={benchmarks}
                returnSeries={allSeries}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}