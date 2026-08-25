import React, { useMemo } from "react";
import { Building2, CheckCircle2, ListTodo } from "lucide-react";

// Per-firm progress bars showing the percentage of completed action items
// across all of a firm's board meetings. Firms with the lowest completion
// appear first so attention flows to who needs it most.
export default function BoardMeetingPrepProgress({ meetings = [], tasks = [] }) {
  const meetingFirm = useMemo(() => {
    const m = {};
    (meetings || []).forEach((mt) => { m[mt.id] = { firm_id: mt.firm_id, firm_name: mt.firm_name }; });
    return m;
  }, [meetings]);

  const rows = useMemo(() => {
    const map = new Map();
    (meetings || []).forEach((mt) => {
      if (!mt.firm_id || !mt.firm_name || mt.deleted_at) return;
      if (!map.has(mt.firm_id)) map.set(mt.firm_id, { id: mt.firm_id, name: mt.firm_name, total: 0, completed: 0 });
    });
    (tasks || []).forEach((t) => {
      if (!t.board_meeting_id) return;
      const mf = meetingFirm[t.board_meeting_id];
      if (!mf || !map.has(mf.firm_id)) return;
      if (t.status === "Cancelled") return;
      const row = map.get(mf.firm_id);
      row.total += 1;
      if (t.status === "Completed") row.completed += 1;
    });
    return Array.from(map.values()).filter((r) => r.total > 0);
  }, [meetings, tasks, meetingFirm]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => {
      const pa = a.completed / a.total;
      const pb = b.completed / b.total;
      if (pa !== pb) return pa - pb; // lowest completion first (needs attention)
      return a.name.localeCompare(b.name);
    }),
    [rows]
  );

  const barColor = (pct) => {
    if (pct >= 100) return "bg-emerald-500";
    if (pct >= 50) return "bg-cyan-500";
    if (pct > 0) return "bg-amber-500";
    return "bg-rose-400";
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-gray-800">Firm Prep Progress</h2>
        <span className="text-xs text-gray-400">Completed action items per firm — lowest completion first</span>
      </div>
      {sorted.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          No action items tracked yet. Progress bars appear once meetings have action items.
        </div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((r) => {
            const pct = r.total ? Math.round((r.completed / r.total) * 100) : 0;
            return (
              <div key={r.id} className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-44 min-w-0 flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-gray-700 truncate" title={r.name}>{r.name}</span>
                </div>
                <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full ${barColor(pct)} transition-all`} style={{ width: `${Math.max(pct, 3)}%` }} />
                </div>
                <div className="w-28 text-right text-xs text-gray-600 flex-shrink-0">
                  <span className="font-semibold text-gray-800">{r.completed}/{r.total}</span>
                  <span className="text-gray-400 ml-1">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}