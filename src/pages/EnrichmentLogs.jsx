import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Globe, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight,
  UserPlus, UserMinus, UserCheck, FileText, Loader2,
} from "lucide-react";

export default function EnrichmentLogs() {
  const [logs, setLogs] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.EnrichmentLog.list("-created_date", 100);
        setLogs(data.filter((l) => !l.deleted_at));
      } catch {
        setLogs([]);
      }
    })();
  }, []);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (logs === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <FileText className="w-10 h-10 mb-3" />
        <p className="text-sm">No enrichment attempts yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5 text-indigo-600" />
        <h1 className="text-lg font-semibold text-gray-800">Enrichment Logs</h1>
        <span className="text-xs text-gray-400">({logs.length})</span>
      </div>

      {logs.map((log) => {
        const isOpen = expanded.has(log.id);
        const date = log.created_date
          ? new Date(log.created_date).toLocaleString("en-US", {
              month: "short", day: "numeric", year: "numeric",
              hour: "numeric", minute: "2-digit",
            })
          : "";

        return (
          <div
            key={log.id}
            className="rounded-lg border border-gray-200 bg-white overflow-hidden"
          >
            <button
              onClick={() => toggle(log.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
            >
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}

              {log.status === "success" && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
              {log.status === "error" && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
              {log.status === "no_data" && <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {log.firm_name || "Unknown firm"}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {date}{log.website_url ? ` · ${log.website_url}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {log.total_people_found > 0 && (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs text-green-600" title="New contacts">
                      <UserPlus className="w-3 h-3" /> {log.people_new}
                    </span>
                    {log.people_skipped > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400" title="Skipped (already exists)">
                        <UserMinus className="w-3 h-3" /> {log.people_skipped}
                      </span>
                    )}
                    {log.people_similar > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600" title="Similar — needs review">
                        <UserCheck className="w-3 h-3" /> {log.people_similar}
                      </span>
                    )}
                  </>
                )}
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                {log.status === "error" && log.error_message && (
                  <div className="mt-3 rounded-md bg-red-50 border border-red-100 px-3 py-2">
                    <p className="text-xs text-red-700">{log.error_message}</p>
                  </div>
                )}

                {log.status === "no_data" && (
                  <p className="mt-3 text-xs text-gray-500">
                    No data could be extracted from the website.
                  </p>
                )}

                {log.total_people_found > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span><strong className="text-gray-700">{log.total_people_found}</strong> found</span>
                      <span className="text-green-600">{log.people_new} new</span>
                      <span className="text-gray-400">{log.people_skipped} skipped</span>
                      {log.people_similar > 0 && <span className="text-amber-600">{log.people_similar} similar</span>}
                    </div>

                    {log.skipped_contacts?.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                          Skipped / Flagged Contacts
                        </p>
                        {log.skipped_contacts.map((c, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 text-xs ${
                              c.status === "skipped"
                                ? "bg-gray-50"
                                : "bg-amber-50"
                            }`}
                          >
                            {c.status === "skipped"
                              ? <UserMinus className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                              : <UserCheck className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-700 font-medium">
                                {c.name}{c.title ? ` — ${c.title}` : ""}
                              </p>
                              <p className="text-gray-400">{c.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(log.fields_new > 0 || log.fields_skipped > 0 || log.fields_similar > 0) && (
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Firm fields:</span>
                    <span className="text-green-600">{log.fields_new} new</span>
                    <span className="text-gray-400">{log.fields_skipped} skipped</span>
                    {log.fields_similar > 0 && <span className="text-amber-600">{log.fields_similar} similar</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}