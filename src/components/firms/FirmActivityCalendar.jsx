import React, { useState, useMemo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth,
  addMonths, subMonths, addWeeks, subWeeks, startOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarDayPanel, { TYPE_CONFIG, getItemDisplay } from "@/components/activity/CalendarDayPanel";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Calendar view for a firm's activities and follow-up tasks.
 * Supports a monthly grid and a weekly column view, with a day-detail
 * panel showing the items on the selected day.
 *
 * Props:
 *   activities      — firm-scoped ContactActivity[] (already filtered)
 *   tasks           — firm-scoped FollowUpTask[] (already filtered)
 *   onActivityClick — (activity) => void
 *   onTaskClick     — (task) => void
 */
export default function FirmActivityCalendar({ activities = [], tasks = [], onActivityClick, onTaskClick }) {
  const [view, setView] = useState("month"); // "month" | "week"
  const [anchor, setAnchor] = useState(new Date()); // first-of-month or first-of-week
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Tag each item with its kind + date string, then group by YYYY-MM-DD
  const itemsByDate = useMemo(() => {
    const map = new Map();
    const all = [
      ...activities.map((a) => ({ ...a, _kind: "activity" })),
      ...tasks.map((t) => ({ ...t, _kind: "task" })),
    ];
    for (const item of all) {
      const dateStr = item._kind === "activity" ? item.activity_date : item.due_date;
      if (!dateStr) continue;
      const key = dateStr.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return map;
  }, [activities, tasks]);

  // Build the visible day range
  const days = useMemo(() => {
    if (view === "month") {
      const monthStart = startOfMonth(anchor);
      const monthEnd = endOfMonth(anchor);
      return eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
    }
    const weekStart = startOfWeek(anchor);
    return eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart) });
  }, [anchor, view]);

  const today = new Date();
  const selectedKey = format(selectedDate, "yyyy-MM-dd");

  // Counts for the visible period (by type)
  const periodStats = useMemo(() => {
    const counts = { Meeting: 0, Call: 0, Email: 0, Note: 0, Other: 0, Task: 0 };
    for (const day of days) {
      if (view === "month" && !isSameMonth(day, anchor)) continue;
      const key = format(day, "yyyy-MM-dd");
      for (const item of itemsByDate.get(key) || []) {
        if (item._kind === "task") counts.Task++;
        else counts[item.activity_type] = (counts[item.activity_type] || 0) + 1;
      }
    }
    return counts;
  }, [days, itemsByDate, view, anchor]);

  const totalPeriod = Object.values(periodStats).reduce((a, b) => a + b, 0);

  const step = (dir) => setAnchor((a) => (view === "month" ? addMonths(a, dir) : addWeeks(a, dir)));
  const goToday = () => { setAnchor(new Date()); setSelectedDate(new Date()); };

  const periodLabel = view === "month"
    ? format(anchor, "MMMM yyyy")
    : `${format(days[0], "MMM d")} – ${format(days[days.length - 1], "MMM d, yyyy")}`;

  return (
    <div className="space-y-3">
      {/* Toolbar: view toggle + navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            type="button"
            onClick={() => setView("month")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "month" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "week" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Week
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={goToday}>Today</Button>
          <button type="button" onClick={() => step(-1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[150px] text-center">{periodLabel}</span>
          <button type="button" onClick={() => step(1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-gray-500">{totalPeriod} {totalPeriod === 1 ? "item" : "items"} this {view}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">{wd}</div>
              ))}
            </div>

            {/* Month grid cells */}
            {view === "month" ? (
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayItems = itemsByDate.get(key) || [];
                  const inMonth = isSameMonth(day, anchor);
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, selectedDate);
                  const typeKeys = new Set();
                  for (const item of dayItems) typeKeys.add(item._kind === "task" ? "Task" : item.activity_type || "Other");
                  const typeList = Array.from(typeKeys).slice(0, 5);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(day)}
                      className={`relative min-h-[78px] p-1.5 border-b border-r border-gray-100 text-left transition-colors hover:bg-indigo-50/30 ${isSelected ? "bg-indigo-50 ring-2 ring-indigo-400 ring-inset z-10" : ""} ${!inMonth ? "bg-gray-50/50" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-indigo-600 text-white" : inMonth ? "text-gray-700" : "text-gray-300"}`}>
                          {format(day, "d")}
                        </span>
                        {dayItems.length > 0 && <span className="text-[10px] text-gray-400 font-medium">{dayItems.length}</span>}
                      </div>
                      {typeList.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {typeList.map((tk) => {
                            const cfg = TYPE_CONFIG[tk] || TYPE_CONFIG.Other;
                            return <span key={tk} className={`w-2 h-2 rounded-full ${cfg.dot}`} title={tk} />;
                          })}
                        </div>
                      )}
                      {dayItems.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[10px] text-gray-500 truncate leading-tight">
                            {dayItems[0]._kind === "task"
                              ? (dayItems[0].task_description || "").replace(/<[^>]*>/g, "").trim().substring(0, 18) || "Task"
                              : (dayItems[0].subject || dayItems[0].activity_type || "Activity")}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Week view — 7 day columns with item chips */
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayItems = itemsByDate.get(key) || [];
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, selectedDate);
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDate(day)}
                      className={`min-h-[180px] p-1.5 border-b border-r border-gray-100 cursor-pointer transition-colors hover:bg-indigo-50/30 ${isSelected ? "bg-indigo-50 ring-2 ring-indigo-400 ring-inset z-10" : ""}`}
                    >
                      <div className="flex flex-col items-center mb-1">
                        <span className="text-[10px] font-medium text-gray-400 uppercase">{WEEKDAYS[day.getDay()]}</span>
                        <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-indigo-600 text-white" : "text-gray-700"}`}>
                          {format(day, "d")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dayItems.slice(0, 4).map((item) => {
                          const display = getItemDisplay(item);
                          const cfg = TYPE_CONFIG[display.type] || TYPE_CONFIG.Other;
                          const Icon = cfg.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={(e) => { e.stopPropagation(); item._kind === "task" ? onTaskClick(item) : onActivityClick(item); }}
                              className={`w-full flex items-center gap-1 px-1 py-1 rounded-md ${cfg.bg} hover:opacity-80 transition-opacity text-left`}
                            >
                              <Icon className={`w-3 h-3 ${cfg.color} flex-shrink-0`} />
                              <span className={`text-[10px] ${cfg.color} truncate`}>{display.title}</span>
                            </button>
                          );
                        })}
                        {dayItems.length > 4 && (
                          <span className="text-[10px] text-gray-400 px-1">+{dayItems.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className="text-xs text-gray-500">{key}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day detail panel */}
        <div>
          <CalendarDayPanel
            date={selectedDate}
            items={itemsByDate.get(selectedKey) || []}
            onActivityClick={onActivityClick}
            onTaskClick={onTaskClick}
          />
        </div>
      </div>
    </div>
  );
}