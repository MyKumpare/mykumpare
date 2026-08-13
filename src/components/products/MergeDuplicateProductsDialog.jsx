import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { findDuplicateProductClusters } from "@/components/products/productDuplicateCheck";

function completenessScore(p) {
  let n = 0;
  ["name", "description", "product_type", "product_status", "asset_class", "geography",
   "market_cap", "style", "investment_process", "implementation_process",
   "diversification_classification", "aapryl_style"].forEach((k) => { if (p[k]) n++; });
  ["vehicle_offerings", "investment_team", "constituent_product_ids",
   "inv_desc_market_positioning", "inv_desc_benchmarks", "aum_history"].forEach((k) => { if (p[k]?.length) n += p[k].length; });
  return n;
}

function productSubtitle(p) {
  const parts = [p.firm_name, p.product_type, p.product_status].filter(Boolean);
  return parts.join(" · ") || "—";
}

export default function MergeDuplicateProductsDialog({ open, onOpenChange, products = [], onMerged }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const clusters = useMemo(() => findDuplicateProductClusters(products), [products]);
  const [keepIndex, setKeepIndex] = useState({});
  const [merging, setMerging] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualPrimary, setManualPrimary] = useState("");
  const [manualSecondary, setManualSecondary] = useState("");

  const getKeepId = (cluster, ci) => {
    const idx = keepIndex[ci];
    if (idx !== undefined) return cluster[idx].id;
    let best = 0;
    let bestScore = -1;
    cluster.forEach((p, k) => {
      const s = completenessScore(p);
      if (s > bestScore) { bestScore = s; best = k; }
    });
    return cluster[best].id;
  };

  const handleMergeAll = async () => {
    setMerging(true);
    let mergedCount = 0;
    let failedCount = 0;
    let lastError = "";
    try {
      for (let ci = 0; ci < clusters.length; ci++) {
        const cluster = clusters[ci];
        const keepId = getKeepId(cluster, ci);
        for (const p of cluster) {
          if (p.id === keepId) continue;
          try {
            const res = await base44.functions.invoke("mergeProducts", {
              primary_id: keepId,
              secondary_id: p.id,
            });
            if (res?.data?.success || res?.success) mergedCount++;
            else { failedCount++; lastError = res?.data?.error || res?.error || "Unknown error"; }
          } catch (e) {
            failedCount++;
            lastError = e?.message || String(e);
          }
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      if (failedCount > 0) {
        toast({ variant: "destructive", title: `Merge failed (${failedCount})`, description: lastError });
      } else if (mergedCount > 0) {
        toast({ title: `Merged ${mergedCount} duplicate${mergedCount > 1 ? "s" : ""}` });
      }
      onMerged?.(mergedCount);
      onOpenChange(false);
    } finally {
      setMerging(false);
    }
  };

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [products]
  );

  const handleManualMerge = async () => {
    if (!manualPrimary || !manualSecondary || manualPrimary === manualSecondary) return;
    setMerging(true);
    try {
      const res = await base44.functions.invoke("mergeProducts", {
        primary_id: manualPrimary,
        secondary_id: manualSecondary,
      });
      if (res?.data?.success || res?.success) {
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        toast({ title: "Products merged" });
        onMerged?.(1);
        onOpenChange(false);
        setManualMode(false);
        setManualPrimary("");
        setManualSecondary("");
      } else {
        toast({ variant: "destructive", title: "Merge failed", description: res?.data?.error || res?.error || "Unknown error" });
        onMerged?.(0);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Merge failed", description: e?.message || String(e) });
      onMerged?.(0);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!merging) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Resolve Duplicate Products
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <button
              type="button"
              onClick={() => setManualMode((v) => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-sm font-medium text-gray-700">Merge two products manually</span>
              <span className="text-xs text-indigo-600">{manualMode ? "Hide" : "Show"}</span>
            </button>
            {manualMode && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-500">Pick any two products to merge — useful when names differ slightly but it's the same product.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Keep (primary)</label>
                    <select
                      value={manualPrimary}
                      onChange={(e) => setManualPrimary(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">Select product…</option>
                      {sortedProducts.map((p) => (
                        <option key={p.id} value={p.id}>{p.name || "—"}{p.firm_name ? ` — ${p.firm_name}` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Merge & remove (secondary)</label>
                    <select
                      value={manualSecondary}
                      onChange={(e) => setManualSecondary(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">Select product…</option>
                      {sortedProducts.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.id === manualPrimary}>{p.name || "—"}{p.firm_name ? ` — ${p.firm_name}` : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full mt-1 gap-1.5"
                  onClick={handleManualMerge}
                  disabled={merging || !manualPrimary || !manualSecondary || manualPrimary === manualSecondary}
                >
                  {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  {merging ? "Merging…" : "Merge selected"}
                </Button>
              </div>
            )}
          </div>

          {clusters.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No auto-detected duplicates. Use the manual option above to merge any two products.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                {clusters.length} duplicate set{clusters.length > 1 ? "s" : ""} found. Select which record to keep — the other will be merged into it (data combined) and removed.
              </p>
              {clusters.map((cluster, ci) => {
                const keepId = getKeepId(cluster, ci);
                return (
                  <div key={ci} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                    <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Duplicate set {ci + 1}</div>
                    <div className="space-y-2">
                      {cluster.map((p) => {
                        const isKeep = p.id === keepId;
                        return (
                          <label key={p.id} className={`flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-colors ${isKeep ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                            <input
                              type="radio"
                              name={`cluster-${ci}`}
                              checked={isKeep}
                              onChange={() => setKeepIndex((prev) => ({ ...prev, [ci]: cluster.findIndex((x) => x.id === p.id) }))}
                              className="accent-indigo-600"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800 truncate">{p.name || "—"}</p>
                              <p className="text-xs text-gray-500 truncate">{productSubtitle(p)}</p>
                            </div>
                            {isKeep && <span className="text-xs font-semibold text-indigo-600">Keep</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>Cancel</Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            onClick={handleMergeAll}
            disabled={merging || clusters.length === 0}
          >
            {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            {merging ? "Merging…" : "Merge & Remove Duplicates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}