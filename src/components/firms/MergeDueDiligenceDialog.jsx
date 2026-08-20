import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, ArrowRightLeft, GitMerge } from "lucide-react";

function ddLabel(r) {
  return [r.product_name || "Unknown product", r.firm_name || "Unknown firm"]
    .filter(Boolean).join(" · ");
}

function ddSub(r) {
  const parts = [];
  if (r.status) parts.push(r.status);
  if (r.process_status) parts.push(r.process_status);
  if (r.start_date) parts.push(`Started ${r.start_date}`);
  if (r.primary_analyst_name) parts.push(`Analyst: ${r.primary_analyst_name}`);
  return parts.join(" · ") || "—";
}

/**
 * Groups due diligence records into duplicate clusters by firm_id + product_id.
 * Records sharing the same firm and product are treated as potential duplicates.
 */
function findDuplicateClusters(records) {
  const active = records.filter((r) => !r.deleted_at);
  const groups = {};
  for (const r of active) {
    const key = `${r.firm_id || ""}|${r.product_id || ""}`;
    if (!r.firm_id || !r.product_id) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return Object.values(groups).filter((g) => g.length > 1);
}

export default function MergeDueDiligenceDialog({ open, onOpenChange, onMerged }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["due-diligence-all"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 500),
    enabled: open,
  });

  const clusters = useMemo(() => findDuplicateClusters(records), [records]);
  const [keepIndex, setKeepIndex] = useState({});
  const [merging, setMerging] = useState(false);
  // Manual merge mode — pick any two DD records to merge
  const [manualMode, setManualMode] = useState(false);
  const [manualPrimary, setManualPrimary] = useState("");
  const [manualSecondary, setManualSecondary] = useState("");

  const sortedRecords = useMemo(
    () => [...records].filter((r) => !r.deleted_at).sort((a, b) => ddLabel(a).localeCompare(ddLabel(b))),
    [records]
  );

  const getKeepId = (cluster, ci) => {
    const idx = keepIndex[ci];
    if (idx !== undefined) return cluster[idx].id;
    // Default: keep the most recently created record.
    let best = 0;
    let bestDate = "";
    cluster.forEach((c, k) => {
      if ((c.created_date || "") > bestDate) { bestDate = c.created_date || ""; best = k; }
    });
    return cluster[best].id;
  };

  const runMerge = async (primaryId, secondaryIds) => {
    const res = await base44.functions.invoke("mergeDueDiligence", {
      primary_id: primaryId,
      secondary_ids: secondaryIds,
    });
    return res?.data;
  };

  const handleMergeAll = async () => {
    setMerging(true);
    let mergedCount = 0;
    try {
      for (let ci = 0; ci < clusters.length; ci++) {
        const cluster = clusters[ci];
        const keepId = getKeepId(cluster, ci);
        const secondaryIds = cluster.map((c) => c.id).filter((id) => id !== keepId);
        if (secondaryIds.length === 0) continue;
        try {
          const data = await runMerge(keepId, secondaryIds);
          if (data?.success) mergedCount++;
        } catch {}
      }
      await queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
      await queryClient.invalidateQueries({ queryKey: ["due-diligence"] });
      toast({ title: `Merged ${mergedCount} duplicate set${mergedCount === 1 ? "" : "s"}` });
      onMerged?.(mergedCount);
      onOpenChange(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Merge failed", description: e.message });
    } finally {
      setMerging(false);
    }
  };

  const handleManualMerge = async () => {
    if (!manualPrimary || !manualSecondary || manualPrimary === manualSecondary) return;
    setMerging(true);
    try {
      const data = await runMerge(manualPrimary, [manualSecondary]);
      if (data?.success) {
        await queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
        await queryClient.invalidateQueries({ queryKey: ["due-diligence"] });
        toast({ title: "Due diligence records merged" });
        onMerged?.(1);
        onOpenChange(false);
        setManualMode(false);
        setManualPrimary("");
        setManualSecondary("");
      } else {
        toast({ variant: "destructive", title: "Merge failed" });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Merge failed", description: e.message });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!merging) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-indigo-600" />
            Merge Duplicate Due Diligence Records
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Manual merge toggle */}
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                <button
                  type="button"
                  onClick={() => setManualMode((v) => !v)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="text-sm font-medium text-gray-700">Merge two records manually</span>
                  <span className="text-xs text-indigo-600">{manualMode ? "Hide" : "Show"}</span>
                </button>
                {manualMode && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500">Pick a primary to keep and a duplicate to merge into it. The duplicate's activities and status history are moved into the primary, then the duplicate is removed.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600">Keep (primary)</label>
                        <select
                          value={manualPrimary}
                          onChange={(e) => setManualPrimary(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="">Select record…</option>
                          {sortedRecords.map((r) => (
                            <option key={r.id} value={r.id}>{ddLabel(r)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Merge & remove (duplicate)</label>
                        <select
                          value={manualSecondary}
                          onChange={(e) => setManualSecondary(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="">Select record…</option>
                          {sortedRecords.map((r) => (
                            <option key={r.id} value={r.id} disabled={r.id === manualPrimary}>{ddLabel(r)}</option>
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
                <p className="text-sm text-gray-500 py-6 text-center">No auto-detected duplicates (records sharing the same firm and product). Use the manual option above to merge any two records.</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    {clusters.length} duplicate set{clusters.length > 1 ? "s" : ""} found. Select which record to keep — the others will be merged into it (activities and status history moved) and removed.
                  </p>
                  {clusters.map((cluster, ci) => {
                    const keepId = getKeepId(cluster, ci);
                    return (
                      <div key={ci} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                        <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Duplicate set {ci + 1} · {ddLabel(cluster[0])}</div>
                        <div className="space-y-2">
                          {cluster.map((r) => {
                            const isKeep = r.id === keepId;
                            return (
                              <label key={r.id} className={`flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-colors ${isKeep ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                                <input
                                  type="radio"
                                  name={`cluster-${ci}`}
                                  checked={isKeep}
                                  onChange={() => setKeepIndex((prev) => ({ ...prev, [ci]: cluster.findIndex((x) => x.id === r.id) }))}
                                  className="accent-indigo-600"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-800 truncate">{ddLabel(r)}</p>
                                  <p className="text-xs text-gray-500 truncate">{ddSub(r)}</p>
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