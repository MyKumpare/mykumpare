import React, { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Search, X, ChevronDown, BarChart2, LayoutList, Link2, CalendarDays, RefreshCw
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

const ym = (d) => (d ? d.slice(0, 7) : "");

function commonPeriod(productConfigs, allProducts, allBenchmarks, allSeries) {
  const starts = [];
  const ends = [];
  for (const cfg of productConfigs) {
    const series = allSeries.filter((s) => s.product_id === cfg.product_id);
    const mr = series.flatMap((s) => s.monthly_returns ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (mr.length) { starts.push(ym(mr[0].date)); ends.push(ym(mr[mr.length - 1].date)); }
    if (cfg.benchmark_id) {
      const bm = allBenchmarks.find((b) => b.id === cfg.benchmark_id);
      const bmr = (bm?.monthly_returns ?? []).sort((a, b) => a.date.localeCompare(b.date));
      if (bmr.length) { starts.push(ym(bmr[0].date)); ends.push(ym(bmr[bmr.length - 1].date)); }
    }
  }
  if (!starts.length) return { start: "", end: "" };
  return { start: starts.sort().pop(), end: ends.sort()[0] };
}

// ── ProductSearchDropdown ─────────────────────────────────────────────────────

function ProductSearchDropdown({ products, selectedIds, onToggle, multi }) {
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

  const label = multi
    ? selectedIds.length === 0 ? "Choose products…" : `${selectedIds.length} product${selectedIds.length > 1 ? "s" : ""} selected`
    : selectedIds.length === 0 ? "Choose a product…" : (products.find((p) => p.id === selectedIds[0])?.name ?? "");

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Search box always visible */}
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
      {/* Product list — no max-height cap, shows everything */}
      <div className="divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">No products found</p>
        ) : (
          filtered.map((p) => {
            const checked = selectedIds.includes(p.id);
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
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{p.name}</p>
                  {p.firm_name && <p className="text-gray-400 truncate">{p.firm_name}</p>}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── BenchmarkDropdown ─────────────────────────────────────────────────────────

function BenchmarkDropdown({ benchmarks, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = benchmarks.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );
  const selected = benchmarks.find((b) => b.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs hover:border-indigo-400 bg-white transition-colors"
      >
        <span className={!selected ? "text-gray-400" : "text-gray-800 truncate"}>{selected ? selected.name : "None"}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-[9999] top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search benchmarks…"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(null); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${!value ? "text-indigo-600 font-semibold bg-indigo-50" : "text-gray-500"}`}
            >
              None
            </button>
            {filtered.map((b) => (
              <button
                key={b.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(b.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${b.id === value ? "text-indigo-600 font-semibold bg-indigo-50" : "text-gray-700"}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}
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

export default function NewAnalysisDialog({ open, onOpenChange, onSaved }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // ── Step: "meta" → "config"
  const [step, setStep] = useState("meta"); // "meta" | "config"

  // ── Meta
  const [analysisName, setAnalysisName] = useState("");
  const [visibility, setVisibility] = useState("personal");
  const [analysisType, setAnalysisType] = useState(null); // "single" | "multiple"

  // ── Config
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [productConfigs, setProductConfigs] = useState({}); // { [productId]: { benchmark_id, return_type, include_clone_product, include_clone_benchmark } }
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

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

  // When a product is selected, seed its config with its primary benchmark
  const addProduct = (id) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(id)) return prev;
      const product = activeProducts.find((p) => p.id === id);
      const primaryBmId = product?.inv_desc_benchmarks?.find((b) => (typeof b === "object" ? b.role === "Primary" : false))?.id
        ?? product?.inv_desc_benchmarks?.[0]?.id
        ?? null;
      const primaryBm = benchmarks.find((b) => b.id === primaryBmId);
      setProductConfigs((prev2) => ({
        ...prev2,
        [id]: {
          benchmark_id: primaryBmId ?? null,
          benchmark_name: primaryBm?.name ?? "",
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

  // Also seed when benchmarks load after product is added
  useEffect(() => {
    selectedProductIds.forEach((id) => {
      if (!productConfigs[id]?.benchmark_id) {
        const product = activeProducts.find((p) => p.id === id);
        const primaryBmId = product?.inv_desc_benchmarks?.find((b) => typeof b === "object" && b.role === "Primary")?.id
          ?? product?.inv_desc_benchmarks?.[0]?.id ?? null;
        if (primaryBmId) {
          const bm = benchmarks.find((b) => b.id === primaryBmId);
          updateConfig(id, "benchmark_id", primaryBmId);
          updateConfig(id, "benchmark_name", bm?.name ?? "");
        }
      }
    });
  }, [benchmarks, selectedProductIds]);

  const handleCommonPeriod = () => {
    const { start, end } = commonPeriod(
      selectedProductIds.map((id) => ({ product_id: id, ...productConfigs[id] })),
      activeProducts, benchmarks, allSeries
    );
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Analysis.create(data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      onOpenChange(false);
      if (onSaved) onSaved(saved);
      resetForm();
    },
  });

  const resetForm = () => {
    setStep("meta");
    setAnalysisName("");
    setVisibility("personal");
    setAnalysisType(null);
    setSelectedProductIds([]);
    setProductConfigs({});
    setPeriodStart("");
    setPeriodEnd("");
  };

  const handleSave = () => {
    const data = {
      name: analysisName,
      visibility,
      analysis_type: analysisType,
      product_configs: selectedProductIds.map((id) => {
        const cfg = productConfigs[id] ?? {};
        const product = activeProducts.find((p) => p.id === id);
        const bm = benchmarks.find((b) => b.id === cfg.benchmark_id);
        return {
          product_id: id,
          product_name: product?.name ?? "",
          firm_name: product?.firm_name ?? "",
          benchmark_id: cfg.benchmark_id ?? null,
          benchmark_name: bm?.name ?? "",
          return_type: cfg.return_type ?? "gross",
          include_clone_product: cfg.include_clone_product ?? false,
          include_clone_benchmark: cfg.include_clone_benchmark ?? false,
        };
      }),
      period_start: periodStart,
      period_end: periodEnd,
      use_common_period: false,
      created_by_id: user?.id ?? "",
    };
    saveMutation.mutate(data);
  };

  const canProceed = analysisName.trim() && analysisType;
  const canSave = selectedProductIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-800">New Analysis</DialogTitle>
        </DialogHeader>

        {step === "meta" && (
          <div className="space-y-5 mt-1">
            {/* Name */}
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

            {/* Visibility */}
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

            {/* Analysis type */}
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
                onClick={() => setStep("config")}
                disabled={!canProceed}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === "config" && (
          <div className="space-y-6 mt-1">
            {/* Back */}
            <button type="button" onClick={() => setStep("meta")} className="text-xs text-indigo-600 hover:underline">← Back</button>

            {/* Product selection */}
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
              />
            </div>

            {/* Per-product configuration */}
            {selectedProductIds.length > 0 && (
              <div className="space-y-4">
                {selectedProductIds.map((id) => {
                  const product = activeProducts.find((p) => p.id === id);
                  const cfg = productConfigs[id] ?? {};
                  return (
                    <div key={id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{product?.name}</p>
                          {product?.firm_name && <p className="text-xs text-gray-500">{product.firm_name}</p>}
                        </div>
                        {analysisType === "multiple" && (
                          <button type="button" onClick={() => removeProduct(id)} className="text-gray-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Benchmark */}
                      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Benchmark</label>
                        <BenchmarkDropdown
                          benchmarks={benchmarks}
                          value={cfg.benchmark_id ?? null}
                          onChange={(bmId) => {
                            const bm = benchmarks.find((b) => b.id === bmId);
                            updateConfig(id, "benchmark_id", bmId);
                            updateConfig(id, "benchmark_name", bm?.name ?? "");
                          }}
                        />
                      </div>

                      {/* Return type */}
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

                      {/* Clone returns — only relevant for gross or net, not "both" */}
                      {cfg.return_type !== "both" && (
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cfg.include_clone_product ?? false}
                              onChange={(e) => updateConfig(id, "include_clone_product", e.target.checked)}
                              className="rounded border-gray-300 text-indigo-600"
                            />
                            <span>Include clone return (product)</span>
                          </label>
                          {cfg.benchmark_id && (
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={cfg.include_clone_benchmark ?? false}
                                onChange={(e) => updateConfig(id, "include_clone_benchmark", e.target.checked)}
                                className="rounded border-gray-300 text-indigo-600"
                              />
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
            {selectedProductIds.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Analysis Period</label>
                  <button
                    type="button"
                    onClick={handleCommonPeriod}
                    title="Set to common period across all selected products & benchmarks"
                    className="ml-auto flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Common Period
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="month"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="month"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  {(periodStart || periodEnd) && (
                    <button type="button" onClick={() => { setPeriodStart(""); setPeriodEnd(""); }} className="text-xs text-gray-400 hover:text-indigo-600 hover:underline">Clear</button>
                  )}
                </div>
                {!periodStart && !periodEnd && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Defaulting to common period — click "Common Period" to set automatically.
                  </p>
                )}
              </div>
            )}

            {/* Save */}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { resetForm(); onOpenChange(false); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave || saveMutation.isPending}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
              >
                {saveMutation.isPending ? "Saving…" : "Save Analysis"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}