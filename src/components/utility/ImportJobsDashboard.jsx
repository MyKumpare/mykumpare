import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight,
  Activity, RefreshCw, Building, Users, FileWarning,
} from "lucide-react";

// Status dashboard for server-side bulk import jobs. Lists every ImportJob
// for the tenant with its lifecycle state (running / completed / failed),
// live progress, and any errors that need attention. Polls while at least one
// job is still running so the user can navigate away and come back to a
// current view. Currently firm imports are driven by the Process Import Jobs
// workflow; product/contact imports will appear here once migrated.
function statusMeta(status) {
  switch (status) {
    case "enriching":
      return { label: "Running", tone: "blue", icon: Loader2, spin: true, iconColor: "text-blue-600" };
    case "completed":
      return { label: "Completed", tone: "green", icon: CheckCircle2, spin: false, iconColor: "text-green-600" };
    case "failed":
      return { label: "Failed", tone: "red", icon: AlertTriangle, spin: false, iconColor: "text-red-600" };
    default:
      return { label: "Pending", tone: "gray", icon: Activity, spin: false, iconColor: "text-gray-500" };
  }
}

const TONE = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-green-50 text-green-700 border-green-200",
  red: "bg-red-50 text-red-700 border-red-200",
  gray: "bg-gray-50 text-gray-600 border-gray-200",
};

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return ""; }
}

function JobRow({ job }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta(job.status);
  const Icon = meta.icon;
  const total = job.total || 0;
  const progress = job.progress || 0;
  const pct = total > 0 ? Math.round((progress / total) * 100) : 100;
  const results = job.results || {};
  const failed = Array.isArray(results.failed) ? results.failed : [];
  const summaries = Array.isArray(results.enrichment_summaries) ? results.enrichment_summaries : [];
  const enrichmentErrors = summaries.filter((s) => s.error);
  const items = Array.isArray(job.pending_items) ? job.pending_items : [];
  const hasErrors = failed.length > 0 || enrichmentErrors.length > 0;
  // Group skipped/failed rows by reason so the user can see WHY rows were
  // skipped (e.g. "Missing firm name: 412") and address each cause.
  const failedGroups = useMemo(() => {
    const map = new Map();
    failed.forEach((f) => {
      const reason = f.error || f.reason || "Unknown";
      if (!map.has(reason)) map.set(reason, []);
      map.get(reason).push(f);
    });
    return Array.from(map.entries()).map(([reason, items]) => ({ reason, items }));
  }, [failed]);
  const sourceLabel = job.source === "firm" ? "Firms" : job.source === "product" ? "Products" : job.source === "contact" ? "Contacts" : "Import";

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-3">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {open
            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
          <Icon className={`w-4 h-4 flex-shrink-0 ${meta.spin ? "animate-spin" : ""} ${meta.iconColor}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">
              {sourceLabel} import · {total} item{total === 1 ? "" : "s"}
            </p>
            <p className="text-[11px] text-gray-400 truncate">{fmtDate(job.created_date)}</p>
          </div>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasErrors && (
            <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-medium">
              <FileWarning className="w-3.5 h-3.5" /> {failed.length + enrichmentErrors.length}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${TONE[meta.tone]}`}>
            {meta.label}
          </span>
          <span className="text-[11px] text-gray-400 tabular-nums">{progress}/{total}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100">
        <div
          className={`h-full transition-all duration-300 ${job.status === "failed" ? "bg-red-400" : job.status === "completed" ? "bg-green-500" : "bg-blue-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Summary line */}
      <div className="px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1"><Building className="w-3 h-3" /> {results.created || 0} created</span>
        {results.merged ? <span className="inline-flex items-center gap-1 text-teal-600"><CheckCircle2 className="w-3 h-3" /> {results.merged} merged</span> : null}
        {(() => {
          const cc = summaries.reduce((n, s) => n + (s.contacts_created || 0), 0);
          const cu = summaries.reduce((n, s) => n + (s.contacts_updated || 0), 0);
          return (cc || cu) ? <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {cc} new · {cu} linked</span> : null;
        })()}
        {failed.length > 0 && <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="w-3 h-3" /> {failed.length} skipped/failed</span>}
        {enrichmentErrors.length > 0 && <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" /> {enrichmentErrors.length} enrichment error{enrichmentErrors.length === 1 ? "" : "s"}</span>}
      </div>

      {open && (
        <div className="border-t border-gray-100 px-3 py-2.5 space-y-3 bg-gray-50/50">
          {/* Per-item states */}
          {items.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Items</p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100 bg-white">
                {items.map((it, i) => (
                  <div key={it.id || i} className="px-2.5 py-1.5 flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${it.state === "done" ? "bg-green-500" : it.state === "failed" ? "bg-red-500" : it.state === "in_progress" ? "bg-blue-500" : "bg-gray-300"}`} />
                    <span className="text-gray-700 truncate flex-1">{it.name || it.id}</span>
                    {it.state === "in_progress" && <Loader2 className="w-3 h-3 text-blue-500 animate-spin flex-shrink-0" />}
                    {it.state === "failed" && <span className="text-red-500 truncate max-w-[55%]" title={it.error}>{it.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors needing attention */}
          {failed.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wide mb-1.5">Skipped / failed rows ({failed.length})</p>
              {failedGroups.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {failedGroups.map((g) => (
                    <span key={g.reason} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[11px] text-red-700">
                      {g.reason} · {g.items.length}
                    </span>
                  ))}
                </div>
              )}
              <div className="max-h-56 overflow-y-auto rounded-md border border-red-200 divide-y divide-red-100 bg-white">
                {failed.map((f, i) => (
                  <div key={i} className="px-2.5 py-1.5 text-xs flex justify-between gap-2">
                    <span className="text-gray-500 flex-shrink-0">Row {f.row ?? "—"}</span>
                    <span className="text-red-600 truncate">{f.error || f.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {enrichmentErrors.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-1.5">Enrichment errors</p>
              <div className="max-h-32 overflow-y-auto rounded-md border border-amber-200 divide-y divide-amber-100 bg-white">
                {enrichmentErrors.slice(0, 30).map((s, i) => (
                  <div key={i} className="px-2.5 py-1.5 text-xs flex justify-between gap-2">
                    <span className="text-gray-700 truncate flex-1">{s.name}</span>
                    <span className="text-amber-700 truncate max-w-[60%]">{s.error}</span>
                  </div>
                ))}
                {enrichmentErrors.length > 30 && <div className="px-2.5 py-1.5 text-[11px] text-gray-400 text-center">…and {enrichmentErrors.length - 30} more</div>}
              </div>
            </div>
          )}

          {!hasErrors && job.status === "completed" && (
            <p className="text-xs text-green-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> All items processed successfully — no errors to review.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ImportJobsDashboard() {
  const queryClient = useQueryClient();
  const { data: jobs = [], isLoading, isFetching } = useQuery({
    queryKey: ["import-jobs"],
    queryFn: () => base44.entities.ImportJob.list("-created_date", 50),
    refetchInterval: (query) => {
      const list = query?.state?.data;
      const hasRunning = Array.isArray(list) && list.some((j) => j.status === "enriching" || j.status === "pending");
      return hasRunning ? 4000 : false;
    },
  });

  const running = jobs.filter((j) => j.status === "enriching" || j.status === "pending");
  const finished = jobs.filter((j) => j.status === "completed" || j.status === "failed");
  const attentionJobs = jobs.filter((j) => {
    const r = j.results || {};
    const failed = Array.isArray(r.failed) ? r.failed : [];
    const errs = (Array.isArray(r.enrichment_summaries) ? r.enrichment_summaries : []).filter((s) => s.error);
    return failed.length > 0 || errs.length > 0;
  });

  return (
    <div className="space-y-3 py-1">
      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 text-center">
          <p className="text-lg font-semibold text-blue-700 tabular-nums">{running.length}</p>
          <p className="text-[11px] text-blue-600">Running</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50/50 p-2.5 text-center">
          <p className="text-lg font-semibold text-green-700 tabular-nums">{jobs.filter((j) => j.status === "completed").length}</p>
          <p className="text-[11px] text-green-600">Completed</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-2.5 text-center">
          <p className="text-lg font-semibold text-red-700 tabular-nums">{attentionJobs.length}</p>
          <p className="text-[11px] text-red-600">Needs attention</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {running.length > 0 ? "In progress" : "Recent jobs"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-gray-500"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["import-jobs"] })}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No import jobs yet</p>
          <p className="text-xs text-gray-400">Start a CSV import to see its progress here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {running.map((j) => <JobRow key={j.id} job={j} />)}
          {finished.map((j) => <JobRow key={j.id} job={j} />)}
        </div>
      )}
    </div>
  );
}