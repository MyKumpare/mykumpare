import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import ImportJobStatus from "./ImportJobStatus";

// Lists recent server-side ImportJob records so users can reopen a job's
// live status after navigating away or closing the page.
export default function ImportJobsList() {
  const [jobs, setJobs] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await base44.entities.ImportJob.list("-created_date", 50);
        if (active) setJobs(Array.isArray(list) ? list : []);
      } catch {
        if (active) setJobs([]);
      }
    })();
    return () => { active = false; };
  }, []);

  if (selectedId) {
    return (
      <div className="space-y-3">
        <button onClick={() => setSelectedId(null)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to import jobs
        </button>
        <ImportJobStatus jobId={selectedId} />
      </div>
    );
  }

  if (!jobs) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /></div>;
  if (jobs.length === 0) return <p className="text-sm text-gray-400 py-6 text-center">No import jobs yet.</p>;

  return (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
      {jobs.map((j) => {
        const done = j.status === "completed";
        const failed = j.status === "failed";
        const pct = j.total > 0 ? (j.progress / j.total) * 100 : 100;
        return (
          <button key={j.id} onClick={() => setSelectedId(j.id)} className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
            <div className="flex items-center gap-2">
              {done ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" /> : failed ? <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" /> : <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />}
              <span className="text-sm font-medium text-gray-700 flex-1 truncate capitalize">{j.source} import · {j.total} item{j.total === 1 ? "" : "s"}</span>
              <span className="text-[11px] text-gray-400">{new Date(j.created_date).toLocaleString()}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[11px] text-gray-400 tabular-nums">{j.progress}/{j.total}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}