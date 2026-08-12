import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  X, LayoutList, Search, ChevronDown, ChevronRight, ChevronLeft,
  Building2, Plus, Calendar, User, Clock, AlertCircle, CheckCircle2, XCircle,
  Paperclip, Link2, FileText, Filter, SortAsc, SortDesc
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";

const FIRM_TYPES_ORDER = [
  "Allocator", "Investment Consultant", "Investment Manager",
  "Manager of Managers", "Securities Brokerage", "Trade Organizations",
];

const STATUS_STYLES = {
  "Not Started": { color: "text-gray-500",  bg: "bg-gray-100",  border: "border-gray-200",  icon: Clock },
  "In-process":  { color: "text-blue-600",  bg: "bg-blue-50",   border: "border-blue-100",  icon: AlertCircle },
  "Completed":   { color: "text-green-600", bg: "bg-green-50",  border: "border-green-100", icon: CheckCircle2 },
  "Cancelled":   { color: "text-red-500",   bg: "bg-red-50",    border: "border-red-100",   icon: XCircle },
};

const TASK_STATUSES = ["Not Started", "In-process", "Completed", "Cancelled"];

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function FollowUpTaskPickerModal({ open, onClose, onAddTask, onTaskClick }) {
  const handleTaskClick = (task) => {
    setPreviousViewMode(viewMode);
    onTaskClick(task);
  };
  const [search, setSearch] = useState("");
  const [collapsedTypes, setCollapsedTypes] = useState({});
  const [collapsedFirms, setCollapsedFirms] = useState({});
  const [collapsedCreators, setCollapsedCreators] = useState({});
  
  // New filter states
  const [statusFilter, setStatusFilter] = useState("all");
  const [firmFilter, setFirmFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [viewMode, setViewMode] = useState("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [previousViewMode, setPreviousViewMode] = useState("list");

  const toggleType    = (k) => setCollapsedTypes(p    => ({ ...p, [k]: !p[k] }));
  const toggleFirm    = (k) => setCollapsedFirms(p    => ({ ...p, [k]: !p[k] }));
  const toggleCreator = (k) => setCollapsedCreators(p => ({ ...p, [k]: !p[k] }));

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["all_follow_up_tasks_picker"],
    queryFn: () => base44.entities.FollowUpTask.filter({ deleted_at: { $exists: false } }, "-due_date"),
    enabled: open,
  });

  // Restore calendar view when modal reopens after closing task detail
  React.useEffect(() => {
    if (open && previousViewMode === "calendar") {
      setViewMode("calendar");
    }
  }, [open]);

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(),
    enabled: open,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
    enabled: open,
  });

  const firmMap = useMemo(() => {
    const m = {};
    firms.forEach(f => { m[f.id] = f; });
    return m;
  }, [firms]);

  const contactMap = useMemo(() => {
    const m = {};
    contacts.forEach(c => { m[c.id] = c; });
    return m;
  }, [contacts]);

  const q = search.toLowerCase();

  // Apply all filters
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      // Search filter
      const desc = stripHtml(t.task_description).toLowerCase();
      const creator = (t.originator_contact_name || "").toLowerCase();
      const assignee = (t.assigned_to_contact_name || "").toLowerCase();
      const firmName = (t.assigned_to_firm_name || "").toLowerCase();
      const status = (t.status || "").toLowerCase();
      
      const matchesSearch = !q || desc.includes(q) || creator.includes(q) || assignee.includes(q) || firmName.includes(q) || status.includes(q);
      
      // Status filter
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      
      // Firm filter
      const originatorContact = contactMap[t.originator_contact_id];
      const primaryFirmId = originatorContact ? (originatorContact.firm_ids || [])[0] : null;
      const firm = primaryFirmId ? firmMap[primaryFirmId] : null;
      const matchesFirm = !firmFilter || (firm && firm.id === firmFilter);
      
      // Contact filter
      const matchesContact = !contactFilter || (
        t.originator_contact_id === contactFilter || 
        t.assigned_to_contact_id === contactFilter
      );
      
      return matchesSearch && matchesStatus && matchesFirm && matchesContact;
    });
  }, [tasks, q, statusFilter, firmFilter, contactFilter, contactMap, firmMap]);

  // Sort filtered tasks
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dateA = a.due_date || "";
      const dateB = b.due_date || "";
      return sortOrder === "asc" ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });
  }, [filtered, sortOrder]);

  // Group: firm_type → firm_name → creator_name → assignee_name → tasks
  const grouped = useMemo(() => {
    const result = {};

    sorted.forEach(task => {
      const originatorContact = contactMap[task.originator_contact_id];
      const primaryFirmId = originatorContact ? (originatorContact.firm_ids || [])[0] : null;
      const firm = primaryFirmId ? firmMap[primaryFirmId] : null;
      const firmName = firm?.name || "Unknown Firm";
      const firmTypes = firm?.firm_types?.length ? firm.firm_types : firm?.firm_type ? [firm.firm_type] : ["Other"];
      const creatorName = task.originator_contact_name || "Unknown Creator";
      const assigneeName = task.assigned_to_contact_name || "Unassigned";

      firmTypes.forEach(type => {
        if (!result[type]) result[type] = {};
        if (!result[type][firmName]) result[type][firmName] = {};
        if (!result[type][firmName][creatorName]) result[type][firmName][creatorName] = {};
        if (!result[type][firmName][creatorName][assigneeName]) result[type][firmName][creatorName][assigneeName] = [];
        result[type][firmName][creatorName][assigneeName].push(task);
      });
    });

    return result;
  }, [sorted, contactMap, firmMap]);

  const orderedTypes = useMemo(() => {
    const present = Object.keys(grouped);
    const ordered = FIRM_TYPES_ORDER.filter(t => present.includes(t));
    const others = present.filter(t => !FIRM_TYPES_ORDER.includes(t)).sort();
    return [...ordered, ...others];
  }, [grouped]);

  // Calendar view helpers
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getTasksForDate = (date) => {
    return sorted.filter(task => {
      if (!task.due_date) return false;
      return isSameDay(parseISO(task.due_date), date);
    });
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)));
  };

  // Get unique firms and contacts for filters
  const uniqueFirms = useMemo(() => {
    const firmSet = new Set();
    tasks.forEach(t => {
      const originatorContact = contactMap[t.originator_contact_id];
      const primaryFirmId = originatorContact ? (originatorContact.firm_ids || [])[0] : null;
      const firm = primaryFirmId ? firmMap[primaryFirmId] : null;
      if (firm) firmSet.add(firm.id);
    });
    return firms.filter(f => firmSet.has(f.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, contactMap, firmMap, firms]);

  const uniqueContacts = useMemo(() => {
    const contactSet = new Set();
    tasks.forEach(t => {
      if (t.originator_contact_id) contactSet.add(t.originator_contact_id);
      if (t.assigned_to_contact_id) contactSet.add(t.assigned_to_contact_id);
    });
    return contacts.filter(c => contactSet.has(c.id)).sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name}`;
      const nameB = `${b.first_name} ${b.last_name}`;
      return nameA.localeCompare(nameB);
    });
  }, [tasks, contacts]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-orange-600" />
            Follow-up Tasks
            <span className="text-xs text-gray-400 font-normal">({sorted.length})</span>
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by description, creator, assignee, status..."
              className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 outline-none focus:border-orange-400 bg-gray-50"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Filter Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="h-8 text-xs rounded-lg border border-gray-200 bg-white outline-none focus:border-orange-400"
              >
                <option value="all">All Statuses</option>
                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <select
              value={firmFilter}
              onChange={e => setFirmFilter(e.target.value)}
              className="h-8 text-xs rounded-lg border border-gray-200 bg-white outline-none focus:border-orange-400"
            >
              <option value="">All Firms</option>
              {uniqueFirms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>

            <select
              value={contactFilter}
              onChange={e => setContactFilter(e.target.value)}
              className="h-8 text-xs rounded-lg border border-gray-200 bg-white outline-none focus:border-orange-400"
            >
              <option value="">All Contacts</option>
              {uniqueContacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>

            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
              className="flex items-center gap-1 h-8 px-2 text-xs rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              {sortOrder === "asc" ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
              Due Date
            </button>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`h-8 px-2 text-xs rounded-lg border ${viewMode === "list" ? "bg-orange-50 border-orange-300 text-orange-700" : "border-gray-200 hover:bg-gray-50"}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`h-8 px-2 text-xs rounded-lg border ${viewMode === "calendar" ? "bg-orange-50 border-orange-300 text-orange-700" : "border-gray-200 hover:bg-gray-50"}`}
              >
                Calendar
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">
              {search || statusFilter !== "all" || firmFilter || contactFilter ? "No tasks match your filters." : "No follow-up tasks yet."}
            </p>
          ) : viewMode === "calendar" ? (
            /* Calendar View */
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-sm font-semibold text-gray-700">
                  {format(currentMonth, "MMMM yyyy")}
                </h3>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="text-[10px] font-semibold text-gray-400 text-center py-1">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, idx) => {
                  const dayTasks = getTasksForDate(day);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={idx}
                      className={`min-h-[80px] p-1 border border-gray-100 rounded ${isToday ? "bg-orange-50 border-orange-200" : "bg-white"}`}
                    >
                      <p className={`text-[10px] font-medium mb-1 ${isToday ? "text-orange-700" : "text-gray-500"}`}>
                        {format(day, "d")}
                      </p>
                      {dayTasks.slice(0, 3).map(task => {
                        const s = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
                        return (
                          <button
                            key={task.id}
                            onClick={() => { handleTaskClick(task); onClose(); }}
                            className={`w-full text-left text-[9px] px-1 py-0.5 mb-0.5 rounded truncate ${s.bg} ${s.color} hover:opacity-80`}
                          >
                            {stripHtml(task.task_description).slice(0, 20)}...
                          </button>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <p className="text-[9px] text-gray-400">+{dayTasks.length - 3} more</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* List View */
            <div className="py-2">
              {orderedTypes.map(type => {
                const firmGroups = grouped[type];
                const isTypeCollapsed = collapsedTypes[type];
                const typeCount = Object.values(firmGroups).reduce((s1, creators) =>
                  s1 + Object.values(creators).reduce((s2, assignees) =>
                    s2 + Object.values(assignees).reduce((s3, tl) => s3 + tl.length, 0), 0), 0);

                return (
                  <div key={type}>
                    <button type="button" onClick={() => toggleType(type)}
                      className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 transition-colors">
                      {isTypeCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                        : <ChevronDown  className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />}
                      <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">{type}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">{typeCount}</span>
                    </button>

                    {!isTypeCollapsed && (
                      <div className="pb-1">
                        {Object.keys(firmGroups).sort((a, b) => a.localeCompare(b)).map(firmName => {
                          const firmKey = `${type}::${firmName}`;
                          const isFirmCollapsed = collapsedFirms[firmKey];
                          const creators = firmGroups[firmName];
                          const firmCount = Object.values(creators).reduce((s2, assignees) =>
                            s2 + Object.values(assignees).reduce((s3, tl) => s3 + tl.length, 0), 0);

                          return (
                            <div key={firmKey}>
                              <button type="button" onClick={() => toggleFirm(firmKey)}
                                className="w-full flex items-center gap-2 pl-8 pr-4 py-1 hover:bg-gray-50 transition-colors">
                                {isFirmCollapsed
                                  ? <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                  : <ChevronDown  className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                <Building2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="text-[11px] font-semibold text-gray-500 truncate">{firmName}</span>
                                <span className="text-[10px] text-gray-300 ml-auto">{firmCount}</span>
                              </button>

                              {!isFirmCollapsed && (
                                <div className="pb-1">
                                  {Object.keys(creators).sort((a, b) => a.localeCompare(b)).map(creatorName => {
                                    const creatorKey = `${firmKey}::${creatorName}`;
                                    const isCreatorCollapsed = collapsedCreators[creatorKey];
                                    const assignees = creators[creatorName];
                                    const creatorCount = Object.values(assignees).reduce((s, tl) => s + tl.length, 0);

                                    return (
                                      <div key={creatorKey}>
                                        <button type="button" onClick={() => toggleCreator(creatorKey)}
                                          className="w-full flex items-center gap-2 pl-12 pr-4 py-1 hover:bg-gray-50 transition-colors">
                                          {isCreatorCollapsed
                                            ? <ChevronRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
                                            : <ChevronDown  className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />}
                                          <User className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
                                          <span className="text-[10px] text-gray-400 truncate">By: {creatorName}</span>
                                          <span className="text-[10px] text-gray-300 ml-auto">{creatorCount}</span>
                                        </button>

                                        {!isCreatorCollapsed && (
                                          <div className="pl-14 pr-4 pb-1 space-y-1">
                                            {Object.keys(assignees).sort((a, b) => a.localeCompare(b)).map(assigneeName => {
                                              const assigneeTasks = assignees[assigneeName];
                                              return (
                                                <div key={assigneeName} className="space-y-1">
                                                  {assigneeName !== "Unassigned" && (
                                                    <p className="text-[10px] text-indigo-500 font-medium flex items-center gap-1 pl-1 pt-1">
                                                      <User className="w-2.5 h-2.5" /> Assigned to: {assigneeName}
                                                    </p>
                                                  )}
                                                  {assigneeTasks.map(task => {
                                                    const s = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
                                                    const StatusIcon = s.icon;
                                                    const descText = stripHtml(task.task_description);

                                                    return (
                                                      <button
                                                        key={task.id}
                                                        type="button"
                                                        onClick={() => { handleTaskClick(task); onClose(); }}
                                                        className={`w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-xl border hover:bg-orange-50 transition-all group ${s.border} bg-white shadow-sm`}
                                                      >
                                                        <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                                                          <StatusIcon className={`w-3 h-3 ${s.color}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                          <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>
                                                              {task.status}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                                              <Calendar className="w-2.5 h-2.5" /> {fmt(task.due_date)}
                                                            </span>
                                                            {task.attachments?.length > 0 && (
                                                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                                                <Paperclip className="w-2.5 h-2.5" /> {task.attachments.length}
                                                              </span>
                                                            )}
                                                            {task.activity_label && (
                                                              <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
                                                                <Link2 className="w-2.5 h-2.5" />
                                                              </span>
                                                            )}
                                                          </div>
                                                          {descText && (
                                                            <p className="text-xs text-gray-700 mt-0.5 line-clamp-2 group-hover:text-orange-700">
                                                              {descText}
                                                            </p>
                                                          )}
                                                        </div>
                                                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-orange-500 flex-shrink-0 mt-1" />
                                                      </button>
                                                    );
                                                  })}
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
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { onAddTask(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Follow-up Task
          </button>
        </div>
      </div>
    </div>
  );
}