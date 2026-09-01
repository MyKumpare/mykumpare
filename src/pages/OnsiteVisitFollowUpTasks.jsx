import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList, CalendarDays, FileBarChart, AlertTriangle,
  Clock, CheckCircle2, CircleDot, Loader2, ChevronDown, ChevronRight,
  Building2, User,
} from "lucide-react";
import { format, parseISO, differenceInCalendarDays, isPast } from "date-fns";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

const OUTSTANDING_STATUSES = ["Not Started", "In-process"];

const STATUS_STYLES = {
  "Not Started": { icon: CircleDot, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
  "In-process": { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  "Completed": { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  "Cancelled": { icon: AlertTriangle, color: "text-gray-400", bg: "bg-gray-50", border: "border-gray-200" },
};

function DueBadge({ dueDate }) {
  if (!dueDate) return <span className="text-xs text-gray-400 italic">No due date</span>;
  const days = differenceInCalendarDays(parseISO(dueDate), new Date());
  const overdue = days < 0;
  const dueSoon = days >= 0 && days <= 7;
  if (overdue) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200`}>
        <AlertTriangle className="w-3 h-3" />
        {Math.abs(days)}d overdue
      </span>
    );
  }
  if (dueSoon) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200`}>
        <Clock className="w-3 h-3" />
        {days === 0 ? "Due today" : `Due in ${days}d`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
      Due in {days}d
    </span>
  );
}

export default function OnsiteVisitFollowUpTasks() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedFirms, setExpandedFirms] = useState({});

  const visitsQuery = useQuery({
    queryKey: ["onsite-visits-all"],
    queryFn: () => base44.entities.OnsiteVisit.list("-target_visit_date", 5000),
  });

  const tasksQuery = useQuery({
    queryKey: ["onsite-followup-tasks"],
    queryFn: () => base44.entities.FollowUpTask.list("-due_date", 5000),
  });

  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  const loading = visitsQuery.isLoading || tasksQuery.isLoading;

  // Build a map of task_id -> visit for tasks that came from onsite visits
  const taskToVisit = useMemo(() => {
    const map = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    (visitsQuery.data || []).forEach((v) => {
      if (v.status === "Cancelled") return;
      const target = v.target_visit_date ? parseISO(v.target_visit_date) : null;
      const isPast = v.actual_visit_date || (target && target < today);
      if (!isPast) return;
      (v.follow_up_task_ids || []).forEach((tid) => {
        map[tid] = v;
      });
    });
    return map;
  }, [visitsQuery.data]);

  // Outstanding tasks from past visits
  const outstandingTasks = useMemo(() => {
    const all = tasksQuery.data || [];
    return all.filter((t) => {
      if (!taskToVisit[t.id]) return false;
      if (!OUTSTANDING_STATUSES.includes(t.status)) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tasksQuery.data, taskToVisit, statusFilter]);

  // Group by firm, sort by due date within each firm
  const groupedByFirm = useMemo(() => {
    const groups = {};
    outstandingTasks.forEach((t) => {
      const visit = taskToVisit[t.id];
      const firmKey = visit.firm_id || "__no_firm__";
      const firmName = visit.firm_name || "Unassigned Firm";
      if (!groups[firmKey]) groups[firmKey] = { firmName, visit, tasks: [] };
      groups[firmKey].tasks.push(t);
    });
    // Sort tasks within each firm by due date (nulls last)
    Object.values(groups).forEach((g) => {
      g.tasks.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    });
    // Sort firms: firms with overdue tasks first, then by earliest due date
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aEarliest = a.tasks[0]?.due_date || "9999";
      const bEarliest = b.tasks[0]?.due_date || "9999";
      return aEarliest.localeCompare(bEarliest);
    });
  }, [outstandingTasks, taskToVisit]);

  // Summary stats
  const stats = useMemo(() => {
    let overdue = 0, dueSoon = 0, noDueDate = 0;
    outstandingTasks.forEach((t) => {
      if (!t.due_date) { noDueDate++; return; }
      const days = differenceInCalendarDays(parseISO(t.due_date), new Date());
      if (days < 0) overdue++;
      else if (days <= 7) dueSoon++;
    });
    return { total: outstandingTasks.length, overdue, dueSoon, noDueDate };
  }, [outstandingTasks]);

  const toggleFirm = (firmKey) => {
    setExpandedFirms((prev) => ({ ...prev, [firmKey]: !prev[firmKey] }));
  };

  const markComplete = async (taskId) => {
    setUpdatingTaskId(taskId);
    try {
      await base44.entities.FollowUpTask.update(taskId, {
        status: "Completed",
        status_date: new Date().toISOString().slice(0, 10),
        completion_date: new Date().toISOString().slice(0, 10),
      });
      queryClient.invalidateQueries({ queryKey: ["onsite-followup-tasks"] });
      toast({ title: "Task marked complete" });
    } catch (e) {
      toast({ title: "Could not update task", description: e.message, variant: "destructive" });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Auto-expand all firms on first load
  React.useEffect(() => {
    if (groupedByFirm.length > 0 && Object.keys(expandedFirms).length === 0) {
      const all = {};
      groupedByFirm.forEach(([key]) => { all[key] = true; });
      setExpandedFirms(all);
    }
  }, [groupedByFirm, expandedFirms]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-500" />
            Onsite Visit Follow-Up Tasks
          </h1>
          <p className="text-sm text-gray-500">
            All outstanding follow-up tasks from past onsite visits, grouped by firm and sorted by due date.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/OnsiteVisitReport">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileBarChart className="w-4 h-4" /> Visit Report
            </Button>
          </Link>
          <Link to="/OnsiteVisitCalendar">
            <Button variant="outline" size="sm" className="gap-1.5">
              <CalendarDays className="w-4 h-4" /> Calendar
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Total Outstanding</div>
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Overdue</div>
          <div className="text-2xl font-bold text-red-700">{stats.overdue}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs text-amber-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Due in 7 days</div>
          <div className="text-2xl font-bold text-amber-700">{stats.dueSoon}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">No Due Date</div>
          <div className="text-2xl font-bold text-gray-600">{stats.noDueDate}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-sm w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outstanding</SelectItem>
              <SelectItem value="Not Started">Not Started</SelectItem>
              <SelectItem value="In-process">In-process</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-gray-400">
          {groupedByFirm.length} firm(s) · {stats.total} task(s)
        </div>
      </div>

      {/* Task list grouped by firm */}
      {loading ? (
        <div className="text-sm text-gray-400 italic py-6 text-center">Loading follow-up tasks...</div>
      ) : groupedByFirm.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-xl">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          No outstanding follow-up tasks from past onsite visits. All caught up!
        </div>
      ) : (
        <div className="space-y-2">
          {groupedByFirm.map(([firmKey, group]) => {
            const expanded = expandedFirms[firmKey] !== false;
            const firmOverdue = group.tasks.filter((t) => t.due_date && isPast(parseISO(t.due_date))).length;
            return (
              <div key={firmKey} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                {/* Firm header */}
                <button
                  onClick={() => toggleFirm(firmKey)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  <span className="font-semibold text-sm text-gray-800">{group.firmName}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">{group.tasks.length} task(s)</span>
                  {firmOverdue > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                      <AlertTriangle className="w-3 h-3" /> {firmOverdue} overdue
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">
                    Visit: {fmtDate(group.visit.target_visit_date)}
                    {group.visit.actual_visit_date && ` (done ${fmtDate(group.visit.actual_visit_date)})`}
                  </span>
                </button>

                {/* Tasks */}
                {expanded && (
                  <div className="divide-y divide-gray-100">
                    {group.tasks.map((task) => {
                      const Style = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
                      const Icon = Style.icon;
                      return (
                        <div key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50">
                          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${Style.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-800 line-clamp-2" dangerouslySetInnerHTML={{ __html: task.task_description || "(no description)" }} />
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <DueBadge dueDate={task.due_date} />
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${Style.bg} ${Style.color} ${Style.border} border`}>
                                {task.status}
                              </span>
                              {task.assigned_to_contact_name && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <User className="w-3 h-3" /> {task.assigned_to_contact_name}
                                </span>
                              )}
                              {task.priority && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${task.priority === "High" ? "bg-red-50 text-red-600" : task.priority === "Medium" ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-500"}`}>
                                  {task.priority}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">Due: {fmtDate(task.due_date)}</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 flex-shrink-0"
                            onClick={() => markComplete(task.id)}
                            disabled={updatingTaskId === task.id}
                          >
                            {updatingTaskId === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Mark Done
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}