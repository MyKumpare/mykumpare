import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth,
  addMonths, subMonths,
} from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, CalendarDays, ArrowLeft,
} from "lucide-react";
import CalendarDayPanel, { TYPE_CONFIG } from "@/components/activity/CalendarDayPanel";
import OutlookSyncButton from "@/components/activity/OutlookSyncButton";
import { lazyDialog } from "@/components/common/lazyDialog";

const ActivityDetailModal = lazyDialog(() => import("@/components/activity/ActivityDetailModal"));
const TaskDetailModal = lazyDialog(() => import("@/components/activity/TaskDetailModal"));

const FILTERS = [
  { key: "all", label: "All" },
  { key: "Meeting", label: "Meetings" },
  { key: "Call", label: "Calls" },
  { key: "Email", label: "Emails" },
  { key: "Note", label: "Notes" },
  { key: "Task", label: "Tasks" },
  { key: "Other", label: "Other" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ActivityCalendar() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewingActivity, setViewingActivity] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["calendar_activities"],
    queryFn: () => base44.entities.ContactActivity.list("-activity_date", 5000),
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["calendar_tasks"],
    queryFn: () => base44.entities.FollowUpTask.list("-due_date", 5000),
  });

  // Group all items by YYYY-MM-DD date string
  const itemsByDate = useMemo(() => {
    const map = new Map();
    const allItems = [
      ...activities.map((a) => ({ ...a, _kind: "activity" })),
      ...tasks.map((t) => ({ ...t, _kind: "task" })),
    ];
    for (const item of allItems) {
      const dateStr = item._kind === "activity" ? item.activity_date : item.due_date;
      if (!dateStr) continue;
      const key = dateStr.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return map;
  }, [activities, tasks]);

  // Apply type filter
  const filteredItemsByDate = useMemo(() => {
    if (typeFilter === "all") return itemsByDate;
    const filtered = new Map();
    itemsByDate.forEach((items, date) => {
      const kept = items.filter((item) => {
        if (typeFilter === "Task") return item._kind === "task";
        return item._kind === "activity" && item.activity_type === typeFilter;
      });
      if (kept.length > 0) filtered.set(date, kept);
    });
    return filtered;
  }, [itemsByDate, typeFilter]);

  // Build the 6-week calendar grid
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const today = new Date();
  const selectedKey = format(selectedDate, "yyyy-MM-dd");

  // Stats for the visible month
  const monthStats = useMemo(() => {
    const counts = { Meeting: 0, Call: 0, Email: 0, Note: 0, Other: 0, Task: 0 };
    for (const day of days) {
      if (!isSameMonth(day, currentMonth)) continue;
      const key = format(day, "yyyy-MM-dd");
      for (const item of filteredItemsByDate.get(key) || []) {
        if (item._kind === "task") counts.Task++;
        else counts[item.activity_type] = (counts[item.activity_type] || 0) + 1;
      }
    }
    return counts;
  }, [days, filteredItemsByDate, currentMonth]);

  const totalMonth = Object.values(monthStats).reduce((a, b) => a + b, 0);

  // Upcoming items (from today forward, next 5)
  const upcomingItems = useMemo(() => {
    const todayKey = format(today, "yyyy-MM-dd");
    const all = [];
    filteredItemsByDate.forEach((items, date) => {
      if (date >= todayKey) all.push(...items);
    });
    all.sort((a, b) => {
      const da = a._kind === "activity" ? a.activity_date : a.due_date;
      const db = b._kind === "task" ? b.due_date : b.activity_date;
      return da.localeCompare(db);
    });
    return all.slice(0, 5);
  }, [filteredItemsByDate]);

  const handleDayClick = (day) => {
    setSelectedDate(day);
  };

  const handleNavigateToContact = (contact) => {
    navigate("/");
  };

  const handleNavigateToFirm = (firm) => {
    navigate("/");
  };

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
            <h1 className="text-base sm:text-lg font-bold">Activity Calendar</h1>
          </div>

          {/* Month navigation */}
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        {/* Filter pills + month summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const cfg = f.key === "all" ? null : TYPE_CONFIG[f.key];
              const active = typeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setTypeFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {cfg && <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />}
                  {f.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">
              {totalMonth} {totalMonth === 1 ? "item" : "items"} this month
            </div>
            <OutlookSyncButton />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar grid */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-gray-200">
                {WEEKDAYS.map((wd) => (
                  <div
                    key={wd}
                    className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayItems = filteredItemsByDate.get(key) || [];
                  const inMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, selectedDate);

                  // Unique types present on this day (for dots)
                  const typeKeys = new Set();
                  for (const item of dayItems) {
                    typeKeys.add(item._kind === "task" ? "Task" : item.activity_type || "Other");
                  }
                  const typeList = Array.from(typeKeys).slice(0, 5);

                  return (
                    <button
                      key={i}
                      onClick={() => handleDayClick(day)}
                      className={`relative min-h-[72px] sm:min-h-[96px] p-1.5 border-b border-r border-gray-100 text-left transition-colors hover:bg-indigo-50/30 ${
                        isSelected ? "bg-indigo-50 ring-2 ring-indigo-400 ring-inset z-10" : ""
                      } ${!inMonth ? "bg-gray-50/50" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? "bg-indigo-600 text-white"
                              : inMonth
                              ? "text-gray-700"
                              : "text-gray-300"
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        {dayItems.length > 0 && (
                          <span className="text-[10px] text-gray-400 font-medium">
                            {dayItems.length}
                          </span>
                        )}
                      </div>

                      {/* Type dots */}
                      {typeList.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {typeList.map((tk) => {
                            const cfg = TYPE_CONFIG[tk] || TYPE_CONFIG.Other;
                            return (
                              <span
                                key={tk}
                                className={`w-2 h-2 rounded-full ${cfg.dot}`}
                                title={tk}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* On mobile, show a compact label for the first item */}
                      {dayItems.length > 0 && (
                        <div className="mt-1 hidden sm:block">
                          <p className="text-[10px] text-gray-500 truncate leading-tight">
                            {dayItems[0]._kind === "task"
                              ? (dayItems[0].task_description || "").replace(/<[^>]*>/g, "").trim().substring(0, 20) || "Task"
                              : (dayItems[0].subjects && dayItems[0].subjects[0]) || dayItems[0].activity_type || "Activity"}
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
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className="text-xs text-gray-500">{key}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Side: Day detail + Upcoming */}
          <div className="space-y-4">
            <CalendarDayPanel
              date={selectedDate}
              items={filteredItemsByDate.get(selectedKey) || []}
              onActivityClick={setViewingActivity}
              onTaskClick={setViewingTask}
            />

            {/* Upcoming items */}
            {upcomingItems.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">Upcoming</h3>
                  <p className="text-xs text-gray-500">Next 5 items from today</p>
                </div>
                <div className="max-h-[40vh] overflow-y-auto divide-y divide-gray-50">
                  {upcomingItems.map((item) => {
                    const display = (() => {
                      if (item._kind === "task") {
                        const firms = item.assigned_firms_contacts || [];
                        return {
                          type: "Task",
                          title: (item.task_description || "").replace(/<[^>]*>/g, "").trim() || "Follow-up task",
                          firmNames: firms.map((f) => f.firm_name).filter(Boolean),
                          contactNames: firms.flatMap((f) => (f.contacts || []).map((c) => c.contact_name)).filter(Boolean),
                          dateStr: item.due_date,
                        };
                      }
                      const firms = item.associated_firms_contacts || [];
                      return {
                        type: item.activity_type || "Other",
                        title: (item.subjects && item.subjects.length ? item.subjects.join(", ") : "") || (item.notes || "").replace(/<[^>]*>/g, "").trim().substring(0, 80) || "Activity",
                        firmNames: firms.map((f) => f.firm_name).filter(Boolean),
                        contactNames: firms.flatMap((f) => (f.contacts || []).map((c) => c.contact_name)).filter(Boolean),
                        dateStr: item.activity_date,
                      };
                    })();
                    const cfg = TYPE_CONFIG[display.type] || TYPE_CONFIG.Other;
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => (item._kind === "task" ? setViewingTask(item) : setViewingActivity(item))}
                        className="w-full px-4 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className={`mt-0.5 w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${cfg.color}`}>{display.type}</span>
                            <span className="text-xs text-gray-400">
                              {display.dateStr ? format(new Date(display.dateStr), "MMM d") : ""}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 truncate">{display.title}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail modals */}
      <ActivityDetailModal
        open={!!viewingActivity}
        activity={viewingActivity}
        onClose={() => setViewingActivity(null)}
        onOpenContact={handleNavigateToContact}
        onFirmClick={handleNavigateToFirm}
        onContactClick={handleNavigateToContact}
      />

      <TaskDetailModal
        open={!!viewingTask}
        task={viewingTask}
        onClose={() => setViewingTask(null)}
        onFirmClick={handleNavigateToFirm}
        onContactClick={handleNavigateToContact}
      />
    </div>
  );
}