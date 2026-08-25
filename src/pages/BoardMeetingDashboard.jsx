import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { parseISO, format, differenceInCalendarDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, Building2, Flag, FileText, CheckCircle2,
  ListTodo, AlertTriangle, Clock, Loader2, Filter, X, LayoutDashboard, Library,
} from "lucide-react";
import BoardMeetingHeatmap from "@/components/firms/BoardMeetingHeatmap";
import BoardMeetingPrepProgress from "@/components/firms/BoardMeetingPrepProgress";
import BoardMeetingTemplateLibrary from "@/components/firms/BoardMeetingTemplateLibrary";

function fmtDate(d) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function deriveStatus(m, today) {
  if (m.status === "completed") return "completed";
  const d = m.meeting_date ? new Date(m.meeting_date + "T00:00:00") : null;
  if (!d) return "upcoming";
  return d < today ? "completed" : "upcoming";
}

export default function BoardMeetingDashboard() {
  const [firmFilter, setFirmFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["board-meetings-dashboard"],
    queryFn: () => base44.entities.BoardMeeting.list("-meeting_date", 2000),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["board-meeting-action-tasks"],
    queryFn: () => base44.entities.FollowUpTask.list("-created_date", 1000),
  });

  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }, []);

  const firms = useMemo(() => {
    const map = new Map();
    (meetings || []).forEach(m => {
      if (m.firm_id && m.firm_name && !map.has(m.firm_id)) map.set(m.firm_id, { id: m.firm_id, name: m.firm_name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [meetings]);

  // Tasks grouped by meeting
  const tasksByMeeting = useMemo(() => {
    const map = new Map();
    (tasks || []).forEach(t => {
      if (t.board_meeting_id) {
        if (!map.has(t.board_meeting_id)) map.set(t.board_meeting_id, []);
        map.get(t.board_meeting_id).push(t);
      }
    });
    return map;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (meetings || [])
      .filter(m => !m.deleted_at)
      .filter(m => firmFilter === "all" || m.firm_id === firmFilter)
      .filter(m => statusFilter === "all" || deriveStatus(m, today) === statusFilter)
      .filter(m => !q || (m.title || "").toLowerCase().includes(q) || (m.firm_name || "").toLowerCase().includes(q))
      .map(m => {
        const mtasks = tasksByMeeting.get(m.id) || [];
        const highPriority = mtasks.filter(t => t.is_high_priority && t.status !== "Completed" && t.status !== "Cancelled").length;
        const openTasks = mtasks.filter(t => t.status !== "Completed" && t.status !== "Cancelled").length;
        const daysUntil = m.meeting_date ? differenceInCalendarDays(new Date(m.meeting_date + "T00:00:00"), today) : null;
        return { ...m, _status: deriveStatus(m, today), _highPriority: highPriority, _openTasks: openTasks, _daysUntil: daysUntil };
      })
      .sort((a, b) => {
        if (a._status !== b._status) return a._status === "upcoming" ? -1 : 1;
        if (a._status === "upcoming") return (a.meeting_date || "9999").localeCompare(b.meeting_date || "9999");
        return (b.meeting_date || "").localeCompare(a.meeting_date || "");
      });
  }, [meetings, firmFilter, statusFilter, search, today, tasksByMeeting]);

  const allUpcoming = useMemo(
    () => (meetings || []).filter(m => !m.deleted_at && deriveStatus(m, today) === "upcoming"),
    [meetings, today]
  );

  const stats = useMemo(() => {
    const daysFor = (m) => m.meeting_date ? differenceInCalendarDays(new Date(m.meeting_date + "T00:00:00"), today) : null;
    const next7 = allUpcoming.filter(m => { const d = daysFor(m); return d !== null && d >= 0 && d <= 7; }).length;
    const next14 = allUpcoming.filter(m => { const d = daysFor(m); return d !== null && d >= 0 && d <= 14; }).length;
    const needAgenda = allUpcoming.filter(m => !m.agenda_url && !m.agenda_file_url).length;
    const flagged = allUpcoming.filter(m => m.needs_review && !m.reviewed).length;
    const allHighPriority = Array.from(tasksByMeeting.values()).flat()
      .filter(t => t.is_high_priority && t.status !== "Completed" && t.status !== "Cancelled").length;
    return { total: allUpcoming.length, next7, next14, needAgenda, flagged, highPriority: allHighPriority };
  }, [allUpcoming, today, tasksByMeeting]);

  const hasActiveFilters = firmFilter !== "all" || statusFilter !== "upcoming" || search.trim() !== "";

  const prepColor = (days) => {
    if (days === null || days < 0) return "text-gray-400";
    if (days <= 3) return "text-red-600";
    if (days <= 7) return "text-amber-600";
    return "text-emerald-600";
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-cyan-600" />
            Board Meeting Prep Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Track deadlines and prep status across all portfolio firms — manage prep time, agendas, and follow-up action items.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setShowTemplates(true)}>
            <Library className="w-3.5 h-3.5" /> Templates
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFilters(s => !s)}>
            <Filter className="w-3.5 h-3.5" /> Filters {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Upcoming" value={stats.total} icon={CalendarDays} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard label="Next 7 days" value={stats.next7} icon={Clock} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Next 14 days" value={stats.next14} icon={Clock} color="text-orange-600" bg="bg-orange-50" />
        <StatCard label="Need agenda" value={stats.needAgenda} icon={FileText} color="text-rose-600" bg="bg-rose-50" />
        <StatCard label="Flagged review" value={stats.flagged} icon={Flag} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="High-pri actions" value={stats.highPriority} icon={AlertTriangle} color="text-red-600" bg="bg-red-50" />
      </div>

      {/* Heatmap */}
      <BoardMeetingHeatmap meetings={meetings} tasks={tasks} />

      {/* Per-firm prep progress */}
      <BoardMeetingPrepProgress meetings={meetings} tasks={tasks} />

      {/* Filter bar */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <select value={firmFilter} onChange={e => setFirmFilter(e.target.value)} className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400">
                <option value="all">All firms</option>
                {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
              {[{ k: "upcoming", l: "Upcoming" }, { k: "all", l: "All" }].map(s => (
                <button key={s.k} onClick={() => setStatusFilter(s.k)} className={`px-2.5 py-1.5 text-xs ${statusFilter === s.k ? "bg-cyan-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>{s.l}</button>
              ))}
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search meetings or firms…" className="h-8 flex-1 min-w-[180px] rounded-md border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400" />
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs gap-1 text-gray-500" onClick={() => { setFirmFilter("all"); setStatusFilter("upcoming"); setSearch(""); }}>
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Meeting list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          No board meetings match the current filters.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-[11px] uppercase text-gray-500">
                  <th className="px-3 py-2 font-semibold">Firm / Meeting</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Prep time</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold text-center">Agenda</th>
                  <th className="px-3 py-2 font-semibold text-center">Minutes</th>
                  <th className="px-3 py-2 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-800 truncate max-w-[260px]">{m.title || "Untitled"}</div>
                      <div className="text-[11px] text-gray-500 truncate max-w-[260px]">{m.firm_name || "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{fmtDate(m.meeting_date)}</td>
                    <td className="px-3 py-2.5">
                      {m._status === "upcoming" && m._daysUntil !== null && m._daysUntil >= 0 ? (
                        <span className={`text-xs font-semibold ${prepColor(m._daysUntil)}`}>
                          {m._daysUntil === 0 ? "Today" : m._daysUntil === 1 ? "1 day" : `${m._daysUntil} days`}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {m._status === "upcoming" ? (
                          <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200">Upcoming</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-gray-100 text-gray-600 border border-gray-200">Completed</Badge>
                        )}
                        {m.needs_review && !m.reviewed && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200"><Flag className="w-2.5 h-2.5 mr-0.5" />Review</Badge>
                        )}
                        {m.reviewed && (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />Reviewed</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {m.agenda_url || m.agenda_file_url
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                        : <X className="w-4 h-4 text-gray-300 inline" />}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {m.minutes_content || m.minutes_url || m.minutes_file_url
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                        : <X className="w-4 h-4 text-gray-300 inline" />}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {m._openTasks > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <Badge className="text-[10px] bg-cyan-100 text-cyan-700 border border-cyan-200"><ListTodo className="w-2.5 h-2.5 mr-0.5" />{m._openTasks}</Badge>
                          {m._highPriority > 0 && (
                            <Badge className="text-[10px] bg-red-100 text-red-700 border border-red-200"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" />{m._highPriority}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BoardMeetingTemplateLibrary open={showTemplates} onClose={() => setShowTemplates(false)} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900 leading-none">{value}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  );
}