import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock, FileSearch, Loader2, ChevronRight,
} from "lucide-react";
import { progressStyle, isCompleted, TERMINAL_PROGRESS } from "./rfpRfiProgress";

// "Due This Week" summary for the main dashboard. Pulls every RFP/RFI across
// all firms, keeps the ones due within the next 7 days that are not completed,
// and shows them as a compact, clickable list so the user can see at a glance
// what needs attention this week.
export default function RfpRfiDueThisWeek({ onOpenAll }) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["rfp-rfi-due-this-week"],
    queryFn: () => base44.entities.FirmRfpRfi.list("-due_date", 2000),
    select: (data) => (data || []).filter((r) => !r.deleted_at),
  });

  const dueThisWeek = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    const todayStr = today.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    return records
      .filter((r) => r.due_date && r.due_date >= todayStr && r.due_date <= endStr)
      .filter((r) => !TERMINAL_PROGRESS.includes(r.progress_status))
      .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  }, [records]);

  const fmt = (d) => {
    if (!d) return "—";
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return d;
    }
  };

  const daysAway = (d) => {
    if (!d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(d + "T00:00:00");
    return Math.round((due - today) / 86400000);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <CalendarClock className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 leading-tight">RFP / RFI Due This Week</h3>
            <p className="text-[11px] text-gray-500 leading-tight">
              {dueThisWeek.length > 0
                ? `${dueThisWeek.length} upcoming submission${dueThisWeek.length === 1 ? "" : "s"} due in the next 7 days`
                : "No submissions due in the next 7 days"}
            </p>
          </div>
        </div>
        {onOpenAll && (
          <button
            type="button"
            onClick={onOpenAll}
            className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline shrink-0"
          >
            View all <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="p-2">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : dueThisWeek.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-5 text-center">
            <FileSearch className="w-7 h-7 text-gray-300" />
            <p className="text-xs text-gray-400 italic">Nothing due this week.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dueThisWeek.map((r) => {
              const days = daysAway(r.due_date);
              const overdue = days === 0;
              return (
                <div key={r.id} className="flex items-center gap-2.5 px-2 py-2 hover:bg-gray-50 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 truncate">{r.title}</p>
                    <p className="text-[11px] text-gray-500 truncate">{r.firm_name || "—"}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${progressStyle(r.progress_status)}`}>
                    {r.progress_status || "Draft"}
                  </Badge>
                  <div className="text-right shrink-0 min-w-[52px]">
                    <p className={`text-[11px] font-semibold ${overdue ? "text-red-600" : "text-gray-700"}`}>
                      {fmt(r.due_date)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days}d`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}