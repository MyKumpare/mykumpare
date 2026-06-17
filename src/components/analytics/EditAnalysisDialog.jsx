import React, { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Search, X, ChevronDown, CalendarDays, RefreshCw, Link2, Trash2 } from "lucide-react";

const ym = (d) => (d ? d.slice(0, 7) : "");

function commonPeriod(productConfigs, allProducts, allBenchmarks, allSeries) {
  const starts = [], ends = [];
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

  const filtered = benchmarks.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
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
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search benchmarks…"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(null); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${!value ? "text-indigo-600 font-semibold bg-indigo-50" : "text-gray-500"}`}>
              None
            </button>
            {filtered.map((b) => (
              <button key={b.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(b.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${b.id === value ? "text-indigo-600 font-semibold bg-indigo-50" : "text-gray-700"}`}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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

  // Form state
  const [analysisName, setAnalysisName] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [visibility, setVisibility] = useState("personal");
  const [productConfigs, setProductConfigs] = useState({});
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

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
    setPeriodStart(analysis.period_start ?? "");
    setPeriodEnd(analysis.period_end ?? "");
    const configs = {};
    (analysis.product_configs ?? []).forEach((cfg) => {
      configs[cfg.product_id] = {
        benchmark_id: cfg.benchmark_id ?? null,
        benchmark_name: cfg.benchmark_name ?? "",
        return_type: cfg.return_type ?? "gross",
        include_clone_product: cfg.include_clone_product ?? false,
        include_clone_benchmark: cfg.include_clone_benchmark ?? false,
      };
    });
    setProductConfigs(configs);
    setConfirmDelete(false);
  }, [analysis]);

  const selectedProductIds = (analysis?.product_configs ?? []).map((c) => c.product_id);

  const updateConfig = (productId, key, value) => {
    setProductConfigs((prev) => ({ ...prev, [productId]: { ...prev[productId], [key]: value } }));
  };

  const handleCommonPeriod = () => {
    const { start, end } = commonPeriod(
      selectedProductIds.map((id) => ({ product_id: id, ...productConfigs[id] })),
      activeProducts, benchmarks, allSeries
    );
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Analysis.update(analysis.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Analysis.delete(analysis.id),
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
      analysis_type: analysis.analysis_type,
      product_configs: selectedProductIds.map((id) => {
        const cfg = productConfigs[id] ?? {};
        const product = activeProducts.find((p) => p.id === id);
        const bm = benchmarks.find((b) => b.id === cfg.benchmark_id);
        return {
          product_id: id,
          product_name: product?.name ?? cfg.product_name ?? "",
          firm_name: product?.firm_name ?? cfg.firm_name ?? "",
          benchmark_id: cfg.benchmark_id ?? null,
          benchmark_name: bm?.name ?? cfg.benchmark_name ?? "",
          return_type: cfg.return_type ?? "gross",
          include_clone_product: cfg.include_clone_product ?? false,
          include_clone_benchmark: cfg.include_clone_benchmark ?? false,
        };
      }),
      period_start: periodStart,
      period_end: periodEnd,
      use_common_period: false,
      created_by_id: analysis.created_by_id,
    };
    saveMutation.mutate(data);
  };

  const isOwner = !analysis?.created_by_id || analysis.created_by_id === user?.id;

  if (!analysis) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            Edit Analysis
            {isTemplate && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Template</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Analysis Name</label>
            <input
              value={analysisName}
              onChange={(e) => setAnalysisName(e.target.value)}
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
                <button key={String(key)} type="button" onClick={() => setIsTemplate(key)}
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
                <button key={key} type="button" onClick={() => setVisibility(key)}
                  className={`text-left p-3 rounded-xl border-2 transition-colors ${visibility === key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <p className={`text-sm font-semibold ${visibility === key ? "text-indigo-700" : "text-gray-700"}`}>{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Per-product configuration */}
          {selectedProductIds.length > 0 && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
                {analysis.analysis_type === "single" ? "Product" : "Products"}
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

                    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                      <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Benchmark</label>
                      <BenchmarkDropdown benchmarks={benchmarks} value={cfg.benchmark_id ?? null}
                        onChange={(bmId) => {
                          const bm = benchmarks.find((b) => b.id === bmId);
                          updateConfig(id, "benchmark_id", bmId);
                          updateConfig(id, "benchmark_name", bm?.name ?? "");
                        }} />
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
                        {cfg.benchmark_id && (
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
              <input type="month" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              <span className="text-xs text-gray-400">to</span>
              <input type="month" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}