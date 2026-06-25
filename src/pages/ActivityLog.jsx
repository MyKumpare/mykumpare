import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Building2, User, Phone, Mail, Users, FileText, MoreHorizontal, Paperclip, X } from "lucide-react";
import { format } from "date-fns";
import ActivityDetailModal from "@/components/activity/ActivityDetailModal";
import TaskDetailModal from "@/components/activity/TaskDetailModal";

const ACTIVITY_ICONS = {
  Call:    { icon: Phone,          color: "text-blue-500",   bg: "bg-blue-50" },
  Email:   { icon: Mail,           color: "text-green-500",  bg: "bg-green-50" },
  Meeting: { icon: Users,          color: "text-purple-500", bg: "bg-purple-50" },
  Note:    { icon: FileText,       color: "text-amber-500",  bg: "bg-amber-50" },
  Other:   { icon: MoreHorizontal, color: "text-gray-500",   bg: "bg-gray-100" },
};

const STATUS_STYLES = {
  "Not Started": { color: "text-gray-500",  bg: "bg-gray-100",  border: "border-gray-200" },
  "In-process":  { color: "text-blue-600",  bg: "bg-blue-50",   border: "border-blue-200" },
  "Completed":   { color: "text-green-600", bg: "bg-green-50",  border: "border-green-200" },
  "Cancelled":   { color: "text-red-500",   bg: "bg-red-50",    border: "border-red-200" },
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

function ActivityCalendarView({ activities, currentMonth, onMonthChange, onOpenActivity }) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const getActivitiesForDate = (date) => {
    const dateStr = date.toISOString().split("T")[0];
    return activities.filter(a => a.activity_date === dateStr);
  };
  
  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="h-20 bg-gray-50 border border-gray-100" />);
  }
  
  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(year, month, day);
    const dayActivities = getActivitiesForDate(currentDate);
    const isToday = new Date().toDateString() === currentDate.toDateString();
    
    days.push(
      <div key={day} className={`h-20 border border-gray-100 p-1 overflow-y-auto ${isToday ? "bg-indigo-50" : "bg-white"}`}>
        <div className={`text-xs font-semibold mb-1 ${isToday ? "text-indigo-700" : "text-gray-700"}`}>{day}</div>
        <div className="space-y-0.5">
          {dayActivities.slice(0, 3).map((activity, idx) => {
            const { icon: Icon, color, bg } = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.Other;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onOpenActivity(activity)}
                className={`w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-[9px] ${bg} hover:opacity-80 transition-opacity`}
              >
                <Icon className={`w-2.5 h-2.5 flex-shrink-0 ${color}`} />
                <span className={`truncate flex-1 ${color}`}>{activity.activity_type}</span>
              </button>
            );
          })}
          {dayActivities.length > 3 && (
            <div className="text-[9px] text-gray-400 text-center">+{dayActivities.length - 3} more</div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onMonthChange(new Date(year, month - 1, 1))} className="p-1 hover:bg-gray-200 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onMonthChange(new Date())} className="text-xs font-semibold text-gray-700 hover:text-indigo-700 px-2 py-1">
            Today
          </button>
          <button type="button" onClick={() => onMonthChange(new Date(year, month + 1, 1))} className="p-1 hover:bg-gray-200 rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="text-sm font-bold text-gray-800">{monthNames[month]} {year}</div>
      </div>
      <div className="grid grid-cols-7 bg-gray-200 border-b border-gray-200">
        {dayNames.map(day => (
          <div key={day} className="h-8 flex items-center justify-center text-xs font-semibold text-gray-600 bg-gray-100">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">{days}</div>
    </div>
  );
}

export default function ActivityLog() {
  const [viewMode, setViewMode] = useState("list");
  const [filterFirmType, setFilterFirmType] = useState("");
  const [filterFirmName, setFilterFirmName] = useState("");
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [viewingActivity, setViewingActivity] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [activeTab, setActiveTab] = useState("activities");

  const { data: allActivities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["all_activities_global"],
    queryFn: () => base44.entities.ContactActivity.list("-activity_date", 500),
  });

  const { data: allTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["all_tasks_global"],
    queryFn: () => base44.entities.FollowUpTask.list("-due_date", 500),
  });

  const { data: allFirms = [] } = useQuery({
    queryKey: ["all_firms_for_activities"],
    queryFn: () => base44.entities.Firm.list(),
  });

  const filteredActivities = useMemo(() => {
    let filtered = [...allActivities];

    if (filterFirmType) {
      filtered = filtered.filter(a => 
        (a.associated_firms_contacts || []).some(e => {
          const firm = allFirms.find(f => f.id === e.firm_id);
          const firmTypes = firm?.firm_types?.length ? firm.firm_types : firm?.firm_type ? [firm.firm_type] : [];
          return firmTypes.includes(filterFirmType);
        })
      );
    }

    if (filterFirmName) {
      filtered = filtered.filter(a => 
        (a.associated_firms_contacts || []).some(e => 
          e.firm_name.toLowerCase().includes(filterFirmName.toLowerCase())
        )
      );
    }

    if (filterDateStart) {
      filtered = filtered.filter(a => a.activity_date >= filterDateStart);
    }
    if (filterDateEnd) {
      filtered = filtered.filter(a => a.activity_date <= filterDateEnd);
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.activity_date || "");
      const dateB = new Date(b.activity_date || "");
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [allActivities, allFirms, filterFirmType, filterFirmName, filterDateStart, filterDateEnd, sortOrder]);

  const filteredTasks = useMemo(() => {
    let filtered = [...allTasks];
    
    if (filterFirmType) {
      filtered = filtered.filter(t => {
        const checkFirm = (firmId) => {
          const firm = allFirms.find(f => f.id === firmId);
          const firmTypes = firm?.firm_types?.length ? firm.firm_types : firm?.firm_type ? [firm.firm_type] : [];
          return firmTypes.includes(filterFirmType);
        };
        return checkFirm(t.originator_firm_id) || 
               checkFirm(t.assigned_to_firm_id) ||
               (t.assigned_firms_contacts || []).some(e => checkFirm(e.firm_id));
      });
    }

    if (filterFirmName) {
      filtered = filtered.filter(t => 
        t.originator_firm_name?.toLowerCase().includes(filterFirmName.toLowerCase()) ||
        t.assigned_to_firm_name?.toLowerCase().includes(filterFirmName.toLowerCase()) ||
        (t.assigned_firms_contacts || []).some(e => e.firm_name?.toLowerCase().includes(filterFirmName.toLowerCase()))
      );
    }

    if (filterDateStart) {
      filtered = filtered.filter(t => t.due_date >= filterDateStart);
    }
    if (filterDateEnd) {
      filtered = filtered.filter(t => t.due_date <= filterDateEnd);
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.due_date || "");
      const dateB = new Date(b.due_date || "");
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [allTasks, allFirms, filterFirmType, filterFirmName, filterDateStart, filterDateEnd, sortOrder]);

  const hasFilters = filterFirmType || filterFirmName || filterDateStart || filterDateEnd;

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-1">Track all firm activities and follow-up tasks</p>
        </div>

        {/* Filters Container */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          {/* Row 1: View Toggle + Firm Type */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2 border-r border-gray-200 pr-3">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-sm font-medium rounded ${
                  viewMode === "list" 
                    ? "text-purple-700 bg-purple-50 border border-purple-200" 
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 text-sm font-medium rounded ${
                  viewMode === "calendar" 
                    ? "text-purple-700 bg-purple-50 border border-purple-200" 
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                Calendar
              </button>
            </div>
            <Select value={filterFirmType} onValueChange={setFilterFirmType}>
              <SelectTrigger className="w-48 h-9 text-sm">
                <SelectValue placeholder="All Firm Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Firm Types</SelectItem>
                {["Allocator", "Investment Consultant", "Investment Manager", "Manager of Managers", "Securities Brokerage", "Trade Organizations"].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: Firm Name + Start Date */}
          <div className="flex items-center gap-3 mb-3">
            <Input
              placeholder="Filter by firm name..."
              value={filterFirmName}
              onChange={(e) => setFilterFirmName(e.target.value)}
              className="h-9 text-sm w-64"
            />
            <div className="relative">
              <Input
                type="date"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                className="h-9 text-sm w-40"
              />
            </div>
          </div>

          {/* Row 3: End Date + Sort */}
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={filterDateEnd}
              onChange={(e) => setFilterDateEnd(e.target.value)}
              className="h-9 text-sm w-40"
            />
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-32 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-purple-600 hover:text-purple-800"
                onClick={() => {
                  setFilterFirmType("");
                  setFilterFirmName("");
                  setFilterDateStart("");
                  setFilterDateEnd("");
                  setSortOrder("desc");
                }}
              >
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("activities")}
            className={`px-4 py-2 text-sm font-medium rounded ${
              activeTab === "activities" 
                ? "bg-white text-indigo-700 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Activities ({filteredActivities.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={`px-4 py-2 text-sm font-medium rounded ${
              activeTab === "tasks" 
                ? "bg-white text-indigo-700 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Tasks ({filteredTasks.length})
          </button>
        </div>

        {/* Content */}
        {loadingActivities || loadingTasks ? (
          <div className="text-sm text-gray-400 italic py-6 text-center">Loading...</div>
        ) : activeTab === "activities" ? (
          filteredActivities.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
              No activities found
            </div>
          ) : viewMode === "calendar" ? (
            <ActivityCalendarView
              activities={filteredActivities}
              currentMonth={calendarMonth}
              onMonthChange={setCalendarMonth}
              onOpenActivity={setViewingActivity}
            />
          ) : (
            <div className="space-y-2">
              {filteredActivities.map(a => {
                const { icon: Icon, color, bg } = ACTIVITY_ICONS[a.activity_type] || ACTIVITY_ICONS.Other;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setViewingActivity(a)}
                    className="w-full rounded-lg border border-gray-200 bg-white overflow-hidden text-left hover:bg-gray-50 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-gray-700">{a.activity_type}</span>
                          {a.subject && <span className="text-xs text-gray-500 truncate">· {a.subject}</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {fmt(a.activity_date)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : filteredTasks.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
            No tasks found
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(t => {
              const s = STATUS_STYLES[t.status] || STATUS_STYLES["Not Started"];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setViewingTask(t)}
                  className={`w-full rounded-lg border bg-white overflow-hidden text-left hover:shadow-sm transition-shadow ${s.border}`}
                >
                  <div className="flex items-start gap-2.5 px-3 py-2.5">
                    <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                      <span className={`text-xs font-bold ${s.color}`}>{t.status[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>{t.status}</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Due {fmt(t.due_date)}
                        </span>
                      </div>
                      {t.task_description && (
                        <div className="text-xs text-gray-600 mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: t.task_description }} />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ActivityDetailModal
        open={!!viewingActivity}
        activity={viewingActivity}
        onClose={() => setViewingActivity(null)}
        onDeleted={() => setViewingActivity(null)}
        onOpenContact={() => {}}
      />

      <TaskDetailModal
        open={!!viewingTask}
        task={viewingTask}
        onClose={() => setViewingTask(null)}
      />
    </div>
  );
}