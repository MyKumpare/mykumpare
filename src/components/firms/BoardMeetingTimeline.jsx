import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, MapPin, Video, Users, FileText, ListTodo, Flag,
  CheckCircle2, AlertTriangle, ChevronRight,
} from "lucide-react";

const FORMAT_LABEL = { "in-person": "In-Person", virtual: "Virtual", hybrid: "Hybrid", unknown: "—" };
const SESSION_LABEL = { public_meeting: "Public Meeting", closed_session: "Closed Session", unknown: "—" };

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtMonthYear(d) {
  if (!d) return "Unknown";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

// Compact chronological timeline of board meetings for a single firm.
// Groups meetings by month with a vertical spine, date dots, and one-line
// summaries so the user can scroll through past and upcoming sessions.
export default function BoardMeetingTimeline({ meetings, firmId, onOpenMeeting }) {
  // Fetch action item counts for all meetings in one query
  const meetingIds = meetings.map((m) => m.id);
  const { data: allTasks = [] } = useQuery({
    queryKey: ["board-meeting-timeline-tasks", meetingIds.join(",")],
    queryFn: () => base44.entities.FollowUpTask.filter(
      { board_meeting_id: { $in: meetingIds } },
      "-created_date",
      500
    ),
    enabled: meetingIds.length > 0,
  });

  const tasksByMeeting = useMemo(() => {
    const map = {};
    for (const t of allTasks) {
      const mid = t.board_meeting_id;
      if (!map[mid]) map[mid] = [];
      map[mid].push(t);
    }
    return map;
  }, [allTasks]);

  // Sort ascending (oldest first) so the timeline reads top→bottom chronologically
  const sorted = useMemo(() => {
    return [...meetings].sort(
      (a, b) => (a.meeting_date || "9999").localeCompare(b.meeting_date || "9999")
    );
  }, [meetings]);

  // Group by month
  const grouped = useMemo(() => {
    const groups = {};
    for (const m of sorted) {
      const key = m.meeting_date ? m.meeting_date.slice(0, 7) : "unknown"; // YYYY-MM
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [sorted]);

  if (sorted.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
        No meetings to display in the timeline.
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="relative pl-6">
      {/* Vertical spine */}
      <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />

      {grouped.map(([monthKey, monthMeetings]) => {
        const isCurrentMonth = monthKey === today.slice(0, 7);
        return (
          <div key={monthKey} className="mb-4">
            {/* Month header */}
            <div className="relative flex items-center gap-2 mb-2 -ml-6">
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 z-10 ${
                isCurrentMonth ? "bg-indigo-600 border-indigo-600" : "bg-white border-gray-300"
              }`} />
              <span className={`text-sm font-semibold ${isCurrentMonth ? "text-indigo-700" : "text-gray-600"}`}>
                {fmtMonthYear(monthMeetings[0].meeting_date)}
              </span>
              <span className="text-xs text-gray-400">
                ({monthMeetings.length} meeting{monthMeetings.length === 1 ? "" : "s"})
              </span>
            </div>

            {/* Meetings in this month */}
            <div className="space-y-1.5">
              {monthMeetings.map((m) => {
                const tasks = tasksByMeeting[m.id] || [];
                const pending = tasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled");
                const isUpcoming = m.status === "upcoming";
                const isPast = m.meeting_date && m.meeting_date < today;
                const needsReview = m.needs_review && !m.reviewed;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onOpenMeeting?.(m)}
                    className="relative w-full text-left -ml-6 pl-6 pr-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    {/* Timeline dot */}
                    <div className={`absolute left-1.5 top-3.5 w-2.5 h-2.5 rounded-full border-2 z-10 ${
                      needsReview
                        ? "bg-amber-400 border-amber-400"
                        : isUpcoming
                        ? "bg-indigo-500 border-indigo-500"
                        : isPast
                        ? "bg-gray-300 border-gray-300"
                        : "bg-white border-gray-400"
                    }`} />

                    <div className="flex items-start gap-2 flex-wrap">
                      {/* Date */}
                      <span className="text-xs font-medium text-gray-500 w-20 flex-shrink-0 pt-0.5">
                        {fmtDate(m.meeting_date)}
                      </span>

                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-gray-800 truncate group-hover:text-indigo-600">
                            {m.title || "Untitled board meeting"}
                          </span>
                          {needsReview && (
                            <Flag className="w-3 h-3 text-amber-500" />
                          )}
                          {m.reviewed && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          )}
                          {m.mentions?.length > 0 && (
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-gray-400 mt-0.5">
                          {m.location && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" /> {m.location}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            {m.meeting_format === "virtual" ? <Video className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                            {FORMAT_LABEL[m.meeting_format] || "—"}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <FileText className="w-2.5 h-2.5" /> {SESSION_LABEL[m.session_type] || "—"}
                          </span>
                          {m.meeting_topics?.length > 0 && (
                            <span className="text-gray-400 truncate max-w-[200px]">
                              {m.meeting_topics.join(" • ")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action items count */}
                      {tasks.length > 0 && (
                        <Badge
                          className={`text-[10px] flex-shrink-0 ${
                            pending.length > 0
                              ? "bg-orange-100 text-orange-700 border border-orange-200"
                              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          <ListTodo className="w-2.5 h-2.5 mr-0.5" />
                          {pending.length > 0 ? `${pending.length} pending` : `${tasks.length} done`}
                        </Badge>
                      )}

                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 flex-shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}