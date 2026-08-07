import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Mail, MailCheck, Clock, ChevronDown, ChevronRight, Building2 } from "lucide-react";

export default function InvitationStatsSection() {
  const [expanded, setExpanded] = useState(true);
  const [firmExpanded, setFirmExpanded] = useState(null);

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["pending_invitations_stats"],
    queryFn: () => base44.entities.PendingInvitation.list("-created_date", 500),
  });

  const external = (invitations || []).filter((i) => i.invitation_type === "external_party");
  const totalSent = external.length;
  const accepted = external.filter((i) => i.accepted).length;
  const pending = totalSent - accepted;

  // Group by firm
  const firmMap = new Map();
  for (const inv of external) {
    const key = inv.firm_id || "__unknown__";
    const name = inv.firm_name || "Unknown firm";
    if (!firmMap.has(key)) {
      firmMap.set(key, { firm_name: name, sent: 0, accepted: 0, pending: 0, reminders: 0 });
    }
    const f = firmMap.get(key);
    f.sent++;
    if (inv.accepted) f.accepted++;
    else f.pending++;
    if (inv.reminder_sent) f.reminders++;
  }
  const firmStats = [...firmMap.values()].sort((a, b) => b.sent - a.sent);

  const rate = (sent, acc) => (sent === 0 ? 0 : Math.round((acc / sent) * 100));

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 group mb-2 px-1"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        )}
        <Mail className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
          External Invitation Summary
        </span>
      </button>

      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100 space-y-3">
          {isLoading ? (
            <div className="text-sm text-gray-400 px-4 py-3">Loading invitation stats…</div>
          ) : totalSent === 0 ? (
            <div className="text-sm text-gray-400 px-4 py-3">No external party invitations sent yet.</div>
          ) : (
            <>
              {/* Top-level stats */}
              <div className="grid grid-cols-3 gap-3 px-1">
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                    <Mail className="w-3.5 h-3.5" /> Total sent
                  </div>
                  <p className="text-xl font-bold text-gray-800 mt-0.5">{totalSent}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                    <MailCheck className="w-3.5 h-3.5 text-emerald-500" /> Accepted
                  </div>
                  <p className="text-xl font-bold text-gray-800 mt-0.5">{accepted}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending
                  </div>
                  <p className="text-xl font-bold text-gray-800 mt-0.5">{pending}</p>
                </div>
              </div>

              {/* Per-firm breakdown */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" /> By Firm
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {firmStats.map((f, idx) => {
                    const isExpanded = firmExpanded === idx;
                    const pct = rate(f.sent, f.accepted);
                    return (
                      <div key={idx}>
                        <button
                          onClick={() => setFirmExpanded(isExpanded ? null : idx)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50/60 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-700 flex-1 truncate">{f.firm_name}</span>
                          <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-shrink-0">
                            <span>{f.sent} sent</span>
                            <span className="text-emerald-600">{f.accepted} accepted</span>
                            <span className="text-amber-600">{f.pending} pending</span>
                            <span className="font-semibold text-gray-700">{pct}%</span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-3 pt-1 bg-gray-50/40">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-medium text-gray-600">{pct}% registration rate</span>
                            </div>
                            {f.reminders > 0 && (
                              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {f.reminders} reminder{f.reminders === 1 ? "" : "s"} sent
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}