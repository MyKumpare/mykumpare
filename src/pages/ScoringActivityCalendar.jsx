import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth,
  addMonths, subMonths, parseISO
} from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, CalendarDays, ArrowLeft, Play, CheckCircle2, Loader2
} from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_FILTERS = [
  { key: "all", label: "All", color: "bg-gray-100 text-gray-600 border-gray-200" },
  { key: "in_progress", label: "In Progress", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "finalized", label: "Finalized", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
];

export default function ScoringActivityCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["scoringMatrixScores", "calendar"],
    queryFn: () => base44.entities.ScoringMatrixScore.list("-scoring_start_date", 5000),
  });

  // Build two maps: one for started dates, one for completed dates
  const startedByDate = useMemo(() => {
    const map = new Map();
    for (const s of scores) {
      if (!s.scoring_start_date) continue;
      const key = s.scoring_start_date.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return map;
  }, [scores]);

  const completedByDate = useMemo(() => {
    const map = new Map();
    for (const s of scores) {
      if (!s.scoring_end_date) continue;
      const key = s.scoring_end_date.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return map;
  }, [scores]);

  // Apply status filter
  const filterScore = (s) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "in_progress") return s.status !== "finalized";
    if (statusFilter === "finalized") return s.status === "finalized";
    return true;
  };

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const today = new Date();
  const selectedKey = format(selectedDate, "yyyy-MM-dd");

  // Month stats
  const monthStats = useMemo(() => {
    let started = 0, completed = 0;
    for (const day of days) {
      if (!isSameMonth(day, currentMonth)) continue;
      const key = format(day, "yyyy-MM-dd");
      started += (startedByDate.get(key) || []).filter(filterScore).length;
      completed += (completedByDate.get(key) || []).filter(filterScore).length;
    }
    return { started, completed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, startedByDate, completedByDate, currentMonth, statusFilter]);

  // Upcoming in-progress scorings (start date >= today, not finalized), next 5
  const upcoming = useMemo(() => {
    const todayKey = format(today, "yyyy-MM-dd");
    return scores
      .filter((s) => s.scoring_start_date && s.scoring_start_date >= todayKey && s.status !== "finalized" && filterScore(s))
      .sort((a, b) => (a.scoring_start_date || "").localeCompare(b.scoring_start_date || ""))
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, statusFilter]);

  // Items for the selected day
  const dayStarted = (startedByDate.get(selectedKey) || []).filter(filterScore);
  const dayCompleted = (completedByDate.get(selectedKey) || []).filter(filterScore);

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-4 h-4" />
              <CalendarDays className="w-5 h-5" />
            </Link>
            <h1 className="text-base sm:text-lg font-bold">Scoring Activity Calendar</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-2 sm:px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-xs sm:text-sm font-medium transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm sm:text-base font-semibold min-w-[140px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 py-4 max-w-6xl">
        {/* Status filter pills + month summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5 items-center">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === f.key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-blue-500" />
              {monthStats.started} started
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {monthStats.completed} completed
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar grid */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 border-b border-gray-200">
                  {WEEKDAYS.map((wd) => (
                    <div key={wd} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Calendar cells */}
                <div className="grid grid-cols-7">
                  {days.map((day, i) => {
                    const key = format(day, "yyyy-MM-dd");
                    const startedItems = (startedByDate.get(key) || []).filter(filterScore);
                    const completedItems = (completedByDate.get(key) || []).filter(filterScore);
                    const inMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, today);
                    const isSelected = isSameDay(day, selectedDate);
                    const total = startedItems.length + completedItems.length;

                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(day)}
                        className={`relative min-h-[80px] sm:min-h-[100px] p-1.5 border-b border-r border-gray-100 text-left transition-colors hover:bg-indigo-50/30 ${
                          isSelected ? "bg-indigo-50 ring-2 ring-indigo-400 ring-inset z-10" : ""
                        } ${!inMonth ? "bg-gray-50/50" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday ? "bg-indigo-600 text-white" : inMonth ? "text-gray-700" : "text-gray-300"
                          }`}>
                            {format(day, "d")}
                          </span>
                          {total > 0 && (
                            <span className="text-[10px] text-gray-400 font-medium">{total}</span>
                          )}
                        </div>

                        {/* Started indicator */}
                        {startedItems.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-medium">
                              <Play className="w-2 h-2" />
                              {startedItems.length}
                            </span>
                          </div>
                        )}
                        {/* Completed indicator */}
                        {completedItems.length > 0 && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-medium">
                              <CheckCircle2 className="w-2 h-2" />
                              {completedItems.length}
                            </span>
                          </div>
                        )}
                        {/* Compact label for first item on desktop */}
                        {total > 0 && (
                          <div className="mt-1 hidden sm:block">
                            <p className="text-[10px] text-gray-500 truncate leading-tight">
                              {(startedItems[0] || completedItems[0])?.product_name?.substring(0, 18)}
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-medium">
                    <Play className="w-2.5 h-2.5" /> Started
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-medium">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Completed
                  </span>
                </div>
              </div>
            </div>

            {/* Side: Day detail + Upcoming */}
            <div className="space-y-4">
              {/* Selected day detail */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {format(selectedDate, "EEEE, MMM d, yyyy")}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {dayStarted.length + dayCompleted.length} scoring {dayStarted.length + dayCompleted.length === 1 ? "event" : "events"}
                  </p>
                </div>
                <div className="max-h-[45vh] overflow-y-auto divide-y divide-gray-50">
                  {dayStarted.length === 0 && dayCompleted.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-6 text-center">No scoring activity on this day.</p>
                  ) : (
                    <>
                      {dayStarted.map((s) => (
                        <ScoringEventItem key={`s-${s.id}`} score={s} type="started" />
                      ))}
                      {dayCompleted.map((s) => (
                        <ScoringEventItem key={`c-${s.id}`} score={s} type="completed" />
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Upcoming in-progress */}
              {upcoming.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 text-sm">In Progress</h3>
                    <p className="text-xs text-gray-500">Active scoring evaluations</p>
                  </div>
                  <div className="max-h-[35vh] overflow-y-auto divide-y divide-gray-50">
                    {upcoming.map((s) => (
                      <div key={s.id} className="px-4 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 transition-colors">
                        <div className="mt-0.5 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                          <Loader2 className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-700 font-medium truncate">{s.product_name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{s.firm_name} · {s.template_name}</p>
                          <p className="text-[10px] text-gray-400">Started {s.scoring_start_date ? format(parseISO(s.scoring_start_date), "MMM d") : "—"}</p>
                        </div>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 flex-shrink-0">
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoringEventItem({ score, type }) {
  const isStarted = type === "started";
  const Icon = isStarted ? Play : CheckCircle2;
  const bg = isStarted ? "bg-blue-50" : "bg-emerald-50";
  const color = isStarted ? "text-blue-500" : "text-emerald-500";

  return (
    <div className="px-4 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 transition-colors">
      <div className={`mt-0.5 w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${color}`}>{isStarted ? "Started" : "Completed"}</span>
          <span className="text-[10px] text-gray-400">v{score.version_number || 1}</span>
        </div>
        <p className="text-xs text-gray-700 truncate">{score.product_name}</p>
        <p className="text-[10px] text-gray-400 truncate">{score.firm_name} · {score.template_name}</p>
        {score.primary_analyst_name && (
          <p className="text-[10px] text-gray-400">Analyst: {score.primary_analyst_name}</p>
        )}
      </div>
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
        score.status === "finalized" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
      }`}>
        {score.status}
      </span>
    </div>
  );
}