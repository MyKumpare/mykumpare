import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Polls a server-side ImportJob and shows live progress. The job runs on the
// server (driven by the "Process Import Jobs" workflow), so the user can
// navigate away and come back — polling just reattaches to the same job.
export default function ImportJobStatus({ jobId, onReset }) {
  const queryClient = useQueryClient();
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let timer;
    const load = async () => {
      try {
        const j = await base44.entities.ImportJob.get(jobId);
        if (!active) return;
        setJob(j);
        if (j.status === "completed" || j.status === "failed") {
          queryClient.invalidateQueries({ queryKey: ["firms"] });
          queryClient.invalidateQueries({ queryKey: ["contacts"] });
          return;
        }
        timer = setTimeout(load, 4000);
      } catch (e) {
        if (!active) return;
        setError(e.message || "Failed to load job");
      }
    };
    load();
    return () => { active = false; clearTimeout(timer); };
  }, [jobId]);

  if (error) return <div className="text-sm text-red-600 flex items-center gap-2 py-4"><AlertTriangle className="w-4 h-4" />{error}</div>;
  if (!job) return (
    <div className="flex items-center gap-2 py-8 justify-center">
      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
      <span className="text-sm text-gray-500">Starting import job…</span>
    </div>
  );

  const done = job.status === "completed";
  const failed = job.status === "failed";
  const pct = job.total > 0 ? (job.progress / job.total) * 100 : 100;
  const summaries = job.results?.enrichment_summaries || [];
  const items = job.pending_items || [];
  const current = items.find((it) => it.state === "in_progress" || it.state === "pending");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {done ? <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" /> : failed ? <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" /> : <Loader2 className="w-6 h-6 text-indigo-600 animate-spin flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-700">
            {done ? "Import complete" : failed ? "Import failed" : "Enriching firms in the background…"}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {job.progress}/{job.total} enriched
            {job.results?.created ? ` · ${job.results.created} created` : ""}
            {job.results?.merged ? ` · ${job.results.merged} merged` : ""}
            {!done && !failed && current ? ` · now: ${current.name}` : ""}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {done || failed ? "This ran on the server and is saved." : "Safe to navigate away — this runs on the server and continues even if you close the page."}
          </p>
        </div>
        <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">{job.progress}/{job.total}</span>
      </div>

      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>

      {summaries.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
          {summaries.map((s, i) => (
            <div key={i} className="px-3 py-2 text-xs flex justify-between gap-2">
              <span className="text-gray-700 font-medium truncate">{s.name}</span>
              <span className={s.error ? "text-amber-600" : "text-gray-500"}>
                {s.error ? "⚠ " + s.error : `✓ ${s.fields_updated} field(s), ${s.contacts_created} new, ${s.contacts_updated} updated`}
              </span>
            </div>
          ))}
        </div>
      )}

      {done && onReset && (
        <div className="flex justify-end">
          <Button onClick={onReset} className="bg-indigo-600 hover:bg-indigo-700 text-white">Import Another File</Button>
        </div>
      )}
    </div>
  );
}