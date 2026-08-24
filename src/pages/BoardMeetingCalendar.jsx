import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth,
  addMonths, subMonths, isBefore, isAfter, parseISO,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, CalendarDays, MapPin, Filter, X,
  Building2, Loader2, Flag, AlertTriangle, ClipboardCheck, Users,
  CheckCircle2, LayoutList, Calendar as CalIcon, LayoutDashboard,
} from "lucide-react";
import BoardMeetingCard from "@/components/firms/BoardMeetingCard";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_OPTS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

function fmtDate(d) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

// Derive a meeting's status from its date when the stored status is stale.
function deriveStatus(m, today) {
  if (m.status === "completed") return "completed";
  const d = m.meeting_date ? (m.meeting_date + "T00:00:00") : null;
  if (!d) return "upcoming";
  return new Date(d) < today ? "completed" : "upcoming";
}

export default function BoardMeetingCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [firmFilter, setFirmFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState("dashboard"); // dashboard | calendar | summary
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["board-meetings-calendar"],
    queryFn: () => base44.entities.BoardMeeting.list("-meeting_date", 2000),
  });

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const firms = useMemo(() => {
    const map = new Map();
    (meetings || []).forEach(m => {
      if (m.firm_id && m.firm_name && !map.has(m.firm_id)) {
        map.set(m.firm_id, { id: m.firm_id, name: m.firm_name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [meetings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (meetings || [])
      .filter(m => !m.deleted_at)
      .filter(m => {
        if (firmFilter !== "all" && m.firm_id !== firmFilter) return false;
        const st = deriveStatus(m, today);
        if (statusFilter !== "all" && st !== statusFilter) return false;
        if (q) {
          const hay = [m.title, m.location, ...(m.meeting_topics || []), ...(m.mentions || []).map(x => x.entity_name)].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (dateFrom) { const d = (m.meeting_date || "").slice(0, 10); if (!d || d < dateFrom) return false; }
        if (dateTo) { const d = (m.meeting_date || "").slice(0, 10); if (!d || d > dateTo) return false; }
        return true;
      });
  }, [meetings, firmFilter, statusFilter, search, today, dateFrom, dateTo]);

  // Map meetings to their start-date key (YYYY-MM-DD)
  const byDate = useMemo(() => {
    const map = new Map();
    filtered.forEach(m => {
      if (!m.meeting_date) return;
      const key = m.meeting_date.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    });
    return map;
  }, [filtered]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const upcomingList = useMemo(() => {
    return filtered
      .filter(m => deriveStatus(m, today) === "upcoming")
      .sort((a, b) => (a.meeting_date || "9999").localeCompare(b.meeting_date || "9999"));
  }, [filtered, today]);

  // ── Summary: flagged portfolio-manager mentions ──
  // "Portfolio managers" = our_firm, investment_manager, sub_manager (skip "other").
  const mentionSummary = useMemo(() => {
    const byEntity = new Map();
    filtered.forEach(m => {
      (m.mentions || []).forEach(mt => {
        if (!mt || mt.entity_type === "other") return;
        if (!byEntity.has(mt.entity_name)) {
          byEntity.set(mt.entity_name, {
            entity_name: mt.entity_name,
            entity_type: mt.entity_type,
            meeting_ids: new Set(),
            meetings: [],
            needs_review_count: 0,
            contexts: [],
          });
        }
        const e = byEntity.get(mt.entity_name);
        if (!e.meeting_ids.has(m.id)) {
          e.meeting_ids.add(m.id);
          e.meetings.push({ id: m.id, title: m.title, meeting_date: m.meeting_date, needs_review: m.needs_review && !m.reviewed });
          if (m.needs_review && !m.reviewed) e.needs_review_count++;
        }
        if (mt.context && !e.contexts.includes(mt.context)) e.contexts.push(mt.context);
      });
    });
    return Array.from(byEntity.values())
      .map(e => ({ ...e, meeting_count: e.meetings.length }))
      .sort((a, b) => b.needs_review_count - a.needs_review_count || b.meeting_count - a.meeting_count);
  }, [filtered]);

  // ── Topics requiring follow-up review ──
  const followUpTopics = useMemo(() => {
    const flagged = filtered.filter(m => m.needs_review && !m.reviewed);
    // Gather topics from flagged meetings, tracking which meetings they came from.
    const byTopic = new Map();
    flagged.forEach(m => {
      (m.meeting_topics || []).forEach(t => {
        if (!byTopic.has(t)) byTopic.set(t, []);
        byTopic.get(t).push(m);
      });
      // If a flagged meeting has no topics, surface the meeting itself by title.
      if (!m.meeting_topics || m.meeting_topics.length === 0) {
        const key = m.title || "Untitled board meeting";
        if (!byTopic.has(key)) byTopic.set(key, []);
        byTopic.get(key).push(m);
      }
    });
    return Array.from(byTopic.entries())
      .map(([topic, ms]) => ({ topic, meetings: ms }))
      .sort((a, b) => b.meetings.length - a.meetings.length);
  }, [filtered]);

  const flaggedMeetingCount = useMemo(
    () => filtered.filter(m => m.needs_review && !m.reviewed).length,
    [filtered]
  );

  const hasActiveFilters = firmFilter !== "all" || statusFilter !== "upcoming" || search.trim() !== "" || dateFrom !== "" || dateTo !== "";
  const clearFilters = () => { setFirmFilter("all"); setStatusFilter("upcoming"); setSearch(""); setDateFrom(""); setDateTo(""); };

  const ENTITY_LABEL = { our_firm: "your firm", investment_manager: "investment manager", sub_manager: "sub-manager" };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-cyan-600" />
            Board Meeting Calendar
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            All board meetings across your firms — filter by firm, toggle upcoming/completed, and review flagged portfolio mentions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs ${view === "dashboard" ? "bg-cyan-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs ${view === "calendar" ? "bg-cyan-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <CalIcon className="w-3.5 h-3.5" /> Calendar
            </button>
            <button
              type="button"
              onClick={() => setView("summary")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs ${view === "summary" ? "bg-cyan-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Summary
            </button>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFilters(s => !s)}>
            <Filter className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <select
                value={firmFilter}
                onChange={e => setFirmFilter(e.target.value)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
              >
                <option value="all">All firms</option>
                {firms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            {/* Status toggle */}
            <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
              {STATUS_OPTS.map(o => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setStatusFilter(o.key)}
                  className={`px-2.5 py-1.5 text-xs ${statusFilter === o.key ? "bg-cyan-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search title, topic, mention…"
                className="h-8 w-56 rounded-md border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                title="From date"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                title="To date"
              />
            </div>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Dashboard view — high-level overview with stat cards + grid */}
      {view === "dashboard" && (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Meetings", value: filtered.length, icon: CalendarDays, color: "text-cyan-600", bg: "bg-cyan-50" },
              { label: "Upcoming", value: filtered.filter(m => deriveStatus(m, today) === "upcoming").length, icon: CalendarDays, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Completed", value: filtered.filter(m => deriveStatus(m, today) === "completed").length, icon: CheckCircle2, color: "text-gray-600", bg: "bg-gray-100" },
              { label: "Needs Review", value: filtered.filter(m => m.needs_review && !m.reviewed).length, icon: Flag, color: "text-amber-600", bg: "bg-amber-50" },
            ].map(s => {
              const I = s.icon;
              return (
                <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.bg}`}>
                    <I className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800 leading-none">{s.value}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* All meetings grid */}
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-cyan-500" />
              All Board Meetings ({filtered.length})
            </h2>
            {isLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-6 text-center">No board meetings match the current filters.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map(m => (
                  <BoardMeetingCard key={m.id} meeting={m} firmId={m.firm_id} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary view */}
      {view === "summary" && (
        <div className="space-y-4">
          {/* Flagged portfolio mentions */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-500" />
                Flagged Portfolio Mentions
              </h2>
              <span className="text-xs text-gray-400">{mentionSummary.length} entit(ies) · {flaggedMeetingCount} meeting(s) need review</span>
            </div>
            {mentionSummary.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-4 text-center">No portfolio mentions detected in the current filter. Scrape board meetings from firm records to populate this.</p>
            ) : (
              <div className="space-y-2">
                {mentionSummary.map(e => (
                  <div key={e.entity_name} className={`rounded-lg border p-3 ${e.needs_review_count > 0 ? "border-amber-300 bg-amber-50/40" : "border-gray-200 bg-white"}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{e.entity_name}</span>
                        <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-600 border-gray-200">
                          {ENTITY_LABEL[e.entity_type] || e.entity_type}
                        </Badge>
                        {e.needs_review_count > 0 && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200">
                            <Flag className="w-3 h-3 mr-0.5" /> {e.needs_review_count} need review
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500">{e.meeting_count} meeting(s)</span>
                    </div>
                    {e.contexts.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-amber-800 leading-snug">
                        {e.contexts.slice(0, 3).join(" · ")}{e.contexts.length > 3 ? ` …+${e.contexts.length - 3}` : ""}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {e.meetings.slice(0, 6).map(m => (
                        <span key={m.id} className={`text-[10px] px-1.5 py-0.5 rounded border ${m.needs_review ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {fmtDate(m.meeting_date)} — {m.title || "Untitled"}
                        </span>
                      ))}
                      {e.meetings.length > 6 && <span className="text-[10px] text-gray-400 self-center">+{e.meetings.length - 6} more</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Topics requiring follow-up review */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Topics Requiring Follow-up Review
              </h2>
              <span className="text-xs text-amber-700">{followUpTopics.length} topic(s) · {flaggedMeetingCount} flagged meeting(s)</span>
            </div>
            {followUpTopics.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-2 text-center">No topics currently flagged for follow-up. All flagged meetings have been reviewed.</p>
            ) : (
              <div className="space-y-2">
                {followUpTopics.map(({ topic, meetings }) => (
                  <div key={topic} className="rounded-lg border border-amber-200 bg-white p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">{topic}</span>
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200">
                        {meetings.length} meeting(s)
                      </Badge>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {meetings.map(m => (
                        <div key={m.id} className="flex items-center gap-2 text-[11px] text-gray-600">
                          <Flag className="w-3 h-3 text-amber-500 flex-shrink-0" />
                          <span className="font-medium text-gray-700">{m.title || "Untitled board meeting"}</span>
                          <span className="text-gray-400">·</span>
                          <span>{fmtDate(m.meeting_date)}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-indigo-500">{m.firm_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All flagged meetings (full cards) */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-3">
              <ClipboardCheck className="w-4 h-4 text-cyan-500" />
              Flagged Meetings ({flaggedMeetingCount})
            </h2>
            {flaggedMeetingCount === 0 ? (
              <p className="text-xs text-gray-400 italic py-2 text-center">No meetings need review in the current filter.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.filter(m => m.needs_review && !m.reviewed).map(m => (
                  <BoardMeetingCard key={m.id} meeting={m} firmId={m.firm_id} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar view */}
      {view === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar grid */}
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between mb-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-sm font-semibold text-gray-800">{format(currentMonth, "MMMM yyyy")}</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-px mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {days.map(day => {
                const key = format(day, "yyyy-MM-dd");
                const dayItems = byDate.get(key) || [];
                const inMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const hasFlagged = dayItems.some(m => m.needs_review && !m.reviewed);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[64px] md:min-h-[80px] rounded-md border p-1 text-left transition-colors ${
                      isSelected ? "border-cyan-400 bg-cyan-50"
                      : inMonth ? "border-gray-100 bg-white hover:bg-gray-50"
                      : "border-gray-50 bg-gray-50/50 text-gray-400"
                    }`}
                  >
                    <div className={`text-[10px] font-medium ${inMonth ? "text-gray-600" : "text-gray-300"}`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {dayItems.slice(0, 3).map(m => {
                        const flagged = m.needs_review && !m.reviewed;
                        const chipCls = `text-[9px] leading-tight px-1 py-0.5 rounded border truncate w-full block ${
                          flagged ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-cyan-50 text-cyan-800 border-cyan-200"
                        }`;
                        return (
                          <span key={m.id} className={chipCls} title={`${m.title} — ${m.firm_name}`}>
                            {m.title || "Untitled"}
                          </span>
                        );
                      })}
                      {dayItems.length > 3 && <div className="text-[9px] text-gray-400 px-1">+{dayItems.length - 3} more</div>}
                    </div>
                    {hasFlagged && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {/* Selected day */}
            {selectedDate && (
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">{format(selectedDate, "EEEE, MMM d")}</h3>
                <div className="space-y-2">
                  {(byDate.get(format(selectedDate, "yyyy-MM-dd")) || []).length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No board meetings on this day.</p>
                  ) : (
                    (byDate.get(format(selectedDate, "yyyy-MM-dd")) || []).map(m => (
                      <BoardMeetingCard key={m.id} meeting={m} firmId={m.firm_id} />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Upcoming list */}
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-cyan-500" />
                {statusFilter === "completed" ? "Completed" : statusFilter === "all" ? "All Meetings" : "Upcoming"} ({filtered.length})
              </h3>
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-4 text-center">No board meetings match the current filter.</p>
                ) : (
                  filtered.slice(0, 60).map(m => (
                    <BoardMeetingCard key={m.id} meeting={m} firmId={m.firm_id} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}