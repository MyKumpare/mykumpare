import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  X, LayoutList, Search, ChevronDown, ChevronRight,
  Building2, Plus, Calendar, User, Clock, AlertCircle, CheckCircle2, XCircle,
  Paperclip, Link2, FileText
} from "lucide-react";
import { format } from "date-fns";

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

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function FollowUpTaskPickerModal({ open, onClose, onAddTask, onTaskClick }) {
  const [search, setSearch] = useState("");
  const [collapsedTypes, setCollapsedTypes] = useState({});
  const [collapsedFirms, setCollapsedFirms] = useState({});
  const [collapsedCreators, setCollapsedCreators] = useState({});

  const toggleType    = (k) => setCollapsedTypes(p    => ({ ...p, [k]: !p[k] }));
  const toggleFirm    = (k) => setCollapsedFirms(p    => ({ ...p, [k]: !p[k] }));
  const toggleCreator = (k) => setCollapsedCreators(p => ({ ...p, [k]: !p[k] }));

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["all_follow_up_tasks_picker"],
    queryFn: () => base44.entities.FollowUpTask.list("-due_date"),
    enabled: open,
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(),
    enabled: open,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list(),
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

  const filtered = useMemo(() => {
    if (!q) return tasks;
    return tasks.filter(t => {
      const desc = stripHtml(t.task_description).toLowerCase();
      const creator = (t.originator_contact_name || "").toLowerCase();
      const assignee = (t.assigned_to_contact_name || "").toLowerCase();
      const firmName = (t.assigned_to_firm_name || "").toLowerCase();
      const status = (t.status || "").toLowerCase();
      return desc.includes(q) || creator.includes(q) || assignee.includes(q) || firmName.includes(q) || status.includes(q);
    });
  }, [tasks, q]);

  // Group: firm_type → firm_name → creator_name → assignee_name → tasks (sorted by due_date desc)
  const grouped = useMemo(() => {
    // For each task, determine the firm via originator contact's firm
    const result = {};

    filtered.forEach(task => {
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

    // Sort tasks within each assignee group by due_date desc
    Object.values(result).forEach(firmGroups =>
      Object.values(firmGroups).forEach(creators =>
        Object.values(creators).forEach(assignees =>
          Object.values(assignees).forEach(taskList =>
            taskList.sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""))
          )
        )
      )
    );

    return result;
  }, [filtered, contactMap, firmMap]);

  const orderedTypes = useMemo(() => {
    const present = Object.keys(grouped);
    const ordered = FIRM_TYPES_ORDER.filter(t => present.includes(t));
    const others = present.filter(t => !FIRM_TYPES_ORDER.includes(t)).sort();
    return [...ordered, ...others];
  }, [grouped]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[78vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-orange-600" />
            Follow-up Tasks
            <span className="text-xs text-gray-400 font-normal">({filtered.length})</span>
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
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
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">
              {search ? "No tasks match your search." : "No follow-up tasks yet."}
            </p>
          ) : (
            <div>
              {orderedTypes.map(type => {
                const firmGroups = grouped[type];
                const isTypeCollapsed = collapsedTypes[type];
                const typeCount = Object.values(firmGroups).reduce((s1, creators) =>
                  s1 + Object.values(creators).reduce((s2, assignees) =>
                    s2 + Object.values(assignees).reduce((s3, tl) => s3 + tl.length, 0), 0), 0);

                return (
                  <div key={type}>
                    {/* Firm Type Header */}
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
                              {/* Firm Sub-header */}
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
                                        {/* Creator Sub-header */}
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
                                            {/* Group by assignee */}
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
                                                        onClick={() => { onTaskClick(task); onClose(); }}
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
        <div className="px-4 py-3 border-t border-gray-100">
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