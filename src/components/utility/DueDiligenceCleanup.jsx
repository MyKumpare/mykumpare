import React, { useState } from "react";
import { Search, Trash2, Check, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, GitMerge, Wrench, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

const REASON_STYLES = {
  firm_deleted: "bg-red-50 text-red-700 border-red-200",
  firm_missing: "bg-red-50 text-red-700 border-red-200",
  product_deleted: "bg-red-50 text-red-700 border-red-200",
  product_missing: "bg-red-50 text-red-700 border-red-200",
  no_product: "bg-amber-50 text-amber-700 border-amber-200",
};

const STATUS_STYLES = {
  "Buy List": "bg-emerald-100 text-emerald-700",
  Pipeline: "bg-blue-100 text-blue-700",
  Rejected: "bg-rose-100 text-rose-700",
};

function SectionCard({ icon, title, subtitle, accent, count, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <span className={`w-7 h-7 rounded-full flex items-center justify-center ${accent}`}>{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-700">{title}</p>
          <p className="text-[11px] text-gray-400">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">{count}</span>
      </button>
      {open && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}

function OrphanRow({ orphan, selected, onToggle }) {
  const badgeClass = REASON_STYLES[orphan.reason] || "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${selected ? "border-rose-300 bg-rose-50" : "border-gray-100 bg-white hover:bg-gray-50"}`}>
      <button
        onClick={() => onToggle(orphan.dd_id)}
        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? "bg-rose-600 border-rose-600 text-white" : "border-gray-300"}`}
      >
        {selected && <Check className="w-3 h-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-gray-800 font-medium truncate">{orphan.product_name}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{orphan.firm_name}</p>
        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded border ${badgeClass}`}>{orphan.reason_label}</span>
      </div>
    </div>
  );
}

function DuplicateGroup({ group, selectedPrimary, onSelectPrimary }) {
  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50/50 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{group.product_name}</p>
          <p className="text-[11px] text-gray-400">{group.firm_name} · {group.count} records</p>
        </div>
      </div>
      <div className="space-y-1">
        {group.records.map((r) => {
          const isPrimary = selectedPrimary === r.dd_id;
          return (
            <label key={r.dd_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-gray-100 cursor-pointer hover:border-amber-300">
              <input
                type="radio"
                name={`dup-${group.key}`}
                checked={isPrimary}
                onChange={() => onSelectPrimary(group.key, r.dd_id)}
                className="w-3.5 h-3.5 accent-emerald-600"
              />
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status}</span>
              <span className="text-[11px] text-gray-500 truncate flex-1">
                {r.primary_analyst_name || "No analyst"} · {r.start_date || "—"}
              </span>
              {isPrimary && <span className="text-[10px] text-emerald-600 font-semibold">Keep</span>}
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400">Select which record to keep as primary — the others will be merged into it and deleted.</p>
    </div>
  );
}

function StaleRow({ stale, selected, onToggle }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${selected ? "border-rose-300 bg-rose-50" : "border-gray-100 bg-white hover:bg-gray-50"}`}>
      <button
        onClick={() => onToggle(stale.product_id)}
        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? "bg-rose-600 border-rose-600 text-white" : "border-gray-300"}`}
      >
        {selected && <Check className="w-3 h-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-gray-800 font-medium truncate">{stale.product_name}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{stale.firm_name}</p>
        <p className="text-[11px] mt-1">
          <span className="text-rose-600 font-medium">{stale.current_status}</span>
          <span className="text-gray-400 mx-1">→</span>
          <span className="text-emerald-600 font-medium">{stale.expected_status}</span>
        </p>
      </div>
    </div>
  );
}

export default function DueDiligenceCleanup() {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedOrphans, setSelectedOrphans] = useState(new Set());
  const [selectedStale, setSelectedStale] = useState(new Set());
  const [mergeSelections, setMergeSelections] = useState({});

  const scan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    setSelectedOrphans(new Set());
    setSelectedStale(new Set());
    setMergeSelections({});
    try {
      const res = await base44.functions.invoke("scanDueDiligenceIntegrity", {});
      const data = res.data;
      if (data.error) throw new Error(data.error);
      setResult(data);
      const defaults = {};
      for (const g of data.duplicate_groups || []) {
        defaults[g.key] = g.suggested_primary_id;
      }
      setMergeSelections(defaults);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const toggleOrphan = (id) => {
    setSelectedOrphans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleStale = (id) => {
    setSelectedStale((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runCleanup = async (actions, successMsg) => {
    setCleaning(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("bulkCleanupDueDiligence", { actions });
      const data = res.data;
      if (data.error) throw new Error(data.error);
      const ok = (data.results || []).filter((r) => r.status === "success").length;
      const errCount = (data.results || []).filter((r) => r.status === "error").length;
      toast({ title: successMsg, description: `${ok} action(s) succeeded${errCount ? `, ${errCount} error(s)` : ""}.` });
      await scan();
    } catch (err) {
      setError(err.message);
    } finally {
      setCleaning(false);
    }
  };

  const deleteOrphans = () => {
    const actions = Array.from(selectedOrphans).map((dd_id) => ({ type: "delete_orphan", dd_id }));
    runCleanup(actions, "Orphaned DD records deleted");
  };

  const mergeAllDuplicates = () => {
    const actions = [];
    for (const g of result?.duplicate_groups || []) {
      const primaryId = mergeSelections[g.key] || g.suggested_primary_id;
      const secondaryIds = g.records.map((r) => r.dd_id).filter((id) => id !== primaryId);
      if (secondaryIds.length) {
        actions.push({ type: "merge_duplicates", primary_id: primaryId, secondary_ids: secondaryIds });
      }
    }
    runCleanup(actions, "Duplicate DD records merged");
  };

  const fixStaleStatuses = () => {
    const actions = Array.from(selectedStale).map((product_id) => ({ type: "fix_product_status", product_id, new_status: "Not Reviewed" }));
    runCleanup(actions, "Product statuses fixed");
  };

  const totals = result?.totals || { orphaned: 0, duplicate_groups: 0, duplicate_records: 0, stale_statuses: 0 };
  const hasIssues = totals.orphaned + totals.duplicate_records + totals.stale_statuses > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-rose-600" />
        <p className="text-sm font-semibold text-gray-700">Due Diligence Integrity Cleanup</p>
      </div>
      <p className="text-xs text-gray-500">
        Scans for orphaned due diligence records (deleted/missing product or firm), duplicate DD records for the same
        product, and products stuck in an auto-set status with no backing DD. Review each issue and approve the fix —
        nothing is removed without your confirmation.
      </p>

      {!result && !scanning && (
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-dashed border-gray-200 bg-white text-center">
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
            <Search className="w-5 h-5 text-rose-600" />
          </div>
          <Button type="button" onClick={scan} className="bg-rose-600 hover:bg-rose-700 text-white">
            Scan for DD Integrity Issues
          </Button>
        </div>
      )}

      {scanning && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Scanning due diligence records for integrity issues...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && !scanning && (
        <>
          {!hasIssues ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-dashed border-green-200 bg-green-50 text-center">
              <Check className="w-6 h-6 text-green-600" />
              <p className="text-sm font-semibold text-green-700">No due diligence integrity issues found</p>
              <p className="text-xs text-green-600">All DD records are consistent.</p>
              <Button type="button" variant="ghost" size="sm" onClick={scan} className="mt-2 text-green-700 hover:bg-green-100">
                <RefreshCw className="w-3.5 h-3.5" />
                Re-scan
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">{totals.orphaned + totals.duplicate_records + totals.stale_statuses}</span> issue(s) found
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={scan} className="text-gray-500 hover:bg-gray-100">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-scan
                </Button>
              </div>

              <div className="space-y-2">
                {/* Orphaned DD records */}
                <SectionCard
                  icon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
                  title="Orphaned Due Diligence Records"
                  subtitle="DD records whose product or firm is deleted, missing, or never linked"
                  accent="bg-rose-50"
                  count={totals.orphaned}
                >
                  {totals.orphaned === 0 ? (
                    <p className="text-xs text-gray-400 px-1 py-2">No orphaned DD records.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => {
                            const allIds = new Set((result.orphaned_dd || []).map((o) => o.dd_id));
                            setSelectedOrphans((prev) => (prev.size === allIds.size ? new Set() : allIds));
                          }}
                          className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                        >
                          {selectedOrphans.size === (result.orphaned_dd || []).length ? "Unselect all" : "Select all"}
                        </button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={deleteOrphans}
                          disabled={selectedOrphans.size === 0 || cleaning}
                          className="bg-rose-600 hover:bg-rose-700 text-white gap-1 h-7"
                        >
                          {cleaning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Delete ({selectedOrphans.size})
                        </Button>
                      </div>
                      <div className="space-y-1.5 max-h-80 overflow-y-auto">
                        {(result.orphaned_dd || []).map((o) => (
                          <OrphanRow key={o.dd_id} orphan={o} selected={selectedOrphans.has(o.dd_id)} onToggle={toggleOrphan} />
                        ))}
                      </div>
                    </>
                  )}
                </SectionCard>

                {/* Duplicate DD records */}
                <SectionCard
                  icon={<GitMerge className="w-3.5 h-3.5 text-amber-600" />}
                  title="Duplicate Due Diligence Records"
                  subtitle="Multiple DD records for the same firm + product — merge to consolidate"
                  accent="bg-amber-50"
                  count={totals.duplicate_groups}
                >
                  {totals.duplicate_groups === 0 ? (
                    <p className="text-xs text-gray-400 px-1 py-2">No duplicate DD records.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={mergeAllDuplicates}
                          disabled={cleaning}
                          className="bg-amber-600 hover:bg-amber-700 text-white gap-1 h-7"
                        >
                          {cleaning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <GitMerge className="w-3 h-3" />}
                          Merge All Groups ({totals.duplicate_groups})
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(result.duplicate_groups || []).map((g) => (
                          <DuplicateGroup
                            key={g.key}
                            group={g}
                            selectedPrimary={mergeSelections[g.key]}
                            onSelectPrimary={(key, id) => setMergeSelections((prev) => ({ ...prev, [key]: id }))}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </SectionCard>

                {/* Stale product statuses */}
                <SectionCard
                  icon={<Wrench className="w-3.5 h-3.5 text-indigo-600" />}
                  title="Stale Product Statuses"
                  subtitle="Products stuck in In-Process/Approved with no backing DD record"
                  accent="bg-indigo-50"
                  count={totals.stale_statuses}
                >
                  {totals.stale_statuses === 0 ? (
                    <p className="text-xs text-gray-400 px-1 py-2">No stale product statuses.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => {
                            const allIds = new Set((result.stale_product_statuses || []).map((s) => s.product_id));
                            setSelectedStale((prev) => (prev.size === allIds.size ? new Set() : allIds));
                          }}
                          className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                        >
                          {selectedStale.size === (result.stale_product_statuses || []).length ? "Unselect all" : "Select all"}
                        </button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={fixStaleStatuses}
                          disabled={selectedStale.size === 0 || cleaning}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 h-7"
                        >
                          {cleaning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
                          Fix ({selectedStale.size})
                        </Button>
                      </div>
                      <div className="space-y-1.5 max-h-80 overflow-y-auto">
                        {(result.stale_product_statuses || []).map((s) => (
                          <StaleRow key={s.product_id} stale={s} selected={selectedStale.has(s.product_id)} onToggle={toggleStale} />
                        ))}
                      </div>
                    </>
                  )}
                </SectionCard>
              </div>

              {cleaning && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Applying cleanup actions...
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}