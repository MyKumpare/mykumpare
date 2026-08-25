import React, { useMemo, useState } from "react";
import { Building2, Calendar, ListTodo, AlertTriangle, Grid3x3 } from "lucide-react";

// Visual heatmap of board meeting frequency and pending action-item volume
// across all firms. Each tile = one firm. Tile background intensity scales
// with meeting count (indigo); a red badge shows pending action items.
export default function BoardMeetingHeatmap({ meetings = [], tasks = [] }) {
  const [mode, setMode] = useState("meetings"); // meetings | actions

  // Map meeting_id -> firm_id for task attribution
  const meetingFirm = useMemo(() => {
    const m = {};
    (meetings || []).forEach((mt) => { m[mt.id] = mt.firm_id; });
    return m;
  }, [meetings]);

  const rows = useMemo(() => {
    const map = new Map();
    (meetings || []).forEach((m) => {
      if (!m.firm_id || !m.firm_name || m.deleted_at) return;
      if (!map.has(m.firm_id)) map.set(m.firm_id, { id: m.firm_id, name: m.firm_name, meetings: 0, pending: 0 });
      map.get(m.firm_id).meetings += 1;
    });
    // Pending action items per firm (open, non-completed/cancelled tasks tied to a meeting)
    (tasks || []).forEach((t) => {
      if (!t.board_meeting_id) return;
      const fid = meetingFirm[t.board_meeting_id];
      if (!fid || !map.has(fid)) return;
      if (t.status !== "Completed" && t.status !== "Cancelled") {
        map.get(fid).pending += 1;
      }
    });
    return Array.from(map.values());
  }, [meetings, tasks, meetingFirm]);

  const maxMeetings = Math.max(1, ...rows.map((r) => r.meetings));
  const maxPending = Math.max(1, ...rows.map((r) => r.pending));

  // Intensity for a value: 0.06 (min) .. 0.32 (max) indigo opacity
  const intensity = (val, max) => {
    if (val <= 0) return 0.04;
    return 0.06 + 0.26 * (val / max);
  };

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (mode === "meetings" ? b.meetings - a.meetings : b.pending - a.pending)),
    [rows, mode]
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Grid3x3 className="w-4 h-4 text-cyan-600" />
          <h2 className="text-sm font-semibold text-gray-800">Firm Heatmap</h2>
          <span className="text-xs text-gray-400">Meeting frequency &amp; pending action items</span>
        </div>
        <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setMode("meetings")}
            className={`px-2.5 py-1 ${mode === "meetings" ? "bg-cyan-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            By meetings
          </button>
          <button
            type="button"
            onClick={() => setMode("actions")}
            className={`px-2.5 py-1 ${mode === "actions" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            By pending actions
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          No board meetings tracked yet. Heatmap populates once meetings are scraped or added.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {sorted.map((r) => {
              const meetAlpha = intensity(r.meetings, maxMeetings);
              const pendAlpha = intensity(r.pending, maxPending);
              const bg =
                mode === "meetings"
                  ? `rgba(8, 145, 178, ${meetAlpha})` // cyan-600
                  : `rgba(220, 38, 38, ${pendAlpha})`; // red-600
              return (
                <div
                  key={r.id}
                  className="rounded-lg border border-gray-200 p-2.5 transition-colors hover:border-cyan-300"
                  style={{ backgroundColor: bg }}
                  title={`${r.name}: ${r.meetings} meeting(s), ${r.pending} pending action item(s)`}
                >
                  <div className="flex items-center gap-1 text-gray-700">
                    <Building2 className="w-3 h-3 flex-shrink-0 text-gray-500" />
                    <span className="text-xs font-medium truncate">{r.name}</span>
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-gray-800">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        <span className="text-base font-bold leading-none">{r.meetings}</span>
                      </div>
                      <div className="text-[9px] text-gray-500 uppercase mt-0.5">meetings</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {r.pending > 0 ? (
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                        ) : (
                          <ListTodo className="w-3 h-3 text-gray-400" />
                        )}
                        <span className={`text-base font-bold leading-none ${r.pending > 0 ? "text-red-600" : "text-gray-400"}`}>
                          {r.pending}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-500 uppercase mt-0.5">pending</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-400">
            <span>Low</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: mode === "meetings" ? "linear-gradient(to right, rgba(8,145,178,0.04), rgba(8,145,178,0.32))" : "linear-gradient(to right, rgba(220,38,38,0.04), rgba(220,38,38,0.32))" }} />
            <span>High</span>
          </div>
        </>
      )}
    </div>
  );
}