import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { CalendarDays, RefreshCw, Link2, Trash2, BarChart2 } from "lucide-react";
import BenchmarkMultiSelect from "./BenchmarkMultiSelect";
import MeasurementPeriodsSection from "./MeasurementPeriodsSection";
import MeasurementTypeSection from "./MeasurementTypeSection";
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
      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-300 hover:border-indigo-400"}`}>
      {children}
    </button>
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

  // Form state
  const [analysisName, setAnalysisName] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [visibility, setVisibility] = useState("personal");
  const [productConfigs, setProductConfigs] = useState({});
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [measurementPeriods, setMeasurementPeriods] = useState({
    trailing_periods: [],
    trailing_custom_start: "",
    trailing_custom_end: "",
    rolling_periods: [],
    rolling_custom_start: "",
    rolling_custom_end: "",
    include_cumulative: false,
    calendar_years: [],
    historical_periods: [],
  });
  const [measurementType, setMeasurementType] = useState({
    selected_types: [],
    attributes: [],
    view_mode: "table",
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
    // Load measurement periods
    const mp = analysis.measurement_periods || {};
    setMeasurementPeriods({
      trailing_periods: mp.trailing_periods || [],
      trailing_custom_start: mp.trailing_custom_start || "",
      trailing_custom_end: mp.trailing_custom_end || "",
      rolling_periods: mp.rolling_periods || [],
      rolling_custom_start: mp.rolling_custom_start || "",
      rolling_custom_end: mp.rolling_custom_end || "",
      include_cumulative: mp.include_cumulative || false,
      calendar_years: mp.calendar_years || [],
      historical_periods: mp.historical_periods || [],
    });
    // Load measurement type
    const mt = analysis.measurement_type || {};
    setMeasurementType({
      selected_types: mt.selected_types || [],
      attributes: mt.attributes || [],
      view_mode: mt.view_mode || "table",
    });
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
      // Preserve categories_config from new-format analyses
      categories_config: analysis?.categories_config ?? [],
      measurement_periods: measurementPeriods,
      measurement_type: measurementType,
    };
    saveMutation.mutate(data);
  };

  // Auto-save when switching to Results tab with unsaved changes
  useEffect(() => {
    if (activeTab === "results" && hasUnsavedChanges && analysisName.trim() && !saveMutation.isPending && analysis) {
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
        categories_config: analysis?.categories_config ?? [],
        measurement_periods: measurementPeriods,
        measurement_type: measurementType,
      };
      saveMutation.mutate(data);
    }
  }, [activeTab, hasUnsavedChanges, analysisName, isTemplate, visibility, analysis?.analysis_type, selectedProductIds, productConfigs, activeProducts, analysis?.product_configs, benchmarks, periodStart, periodEnd, measurementPeriods, measurementType, saveMutation.isPending, saveMutation.mutate]);

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

          {/* Measurement periods */}
          {selectedProductIds.length > 0 && (periodStart || periodEnd) && (
            <MeasurementPeriodsSection
              periodStart={periodStart}
              periodEnd={periodEnd}
              measurementPeriods={measurementPeriods}
              setMeasurementPeriods={(mp) => { setMeasurementPeriods(mp); setHasUnsavedChanges(true); }}
            />
          )}

          {/* Measurement type */}
          {selectedProductIds.length > 0 && (periodStart || periodEnd) && (
            <MeasurementTypeSection
              measurementType={measurementType}
              setMeasurementType={(mt) => { setMeasurementType(mt); setHasUnsavedChanges(true); }}
            />
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
                analysis={savedAnalysis || analysis}
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