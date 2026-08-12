import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, parseISO, isValid } from "date-fns";
import {
  Phone, Mail, Users, FileText, MoreHorizontal, ClipboardList,
  StickyNote, CheckCircle2, Clock, Circle, XCircle, Building2,
  ChevronDown, ChevronUp,
} from "lucide-react";

const ACTIVITY_ICONS = {
  Call: { icon: Phone, color: "text-blue-600", bg: "bg-blue-100", dot: "bg-blue-500" },
  Email: { icon: Mail, color: "text-green-600", bg: "bg-green-100", dot: "bg-green-500" },
  Meeting: { icon: Users, color: "text-purple-600", bg: "bg-purple-100", dot: "bg-purple-500" },
  Note: { icon: FileText, color: "text-amber-600", bg: "bg-amber-100", dot: "bg-amber-500" },
  Other: { icon: MoreHorizontal, color: "text-gray-500", bg: "bg-gray-100", dot: "bg-gray-400" },
};

const TASK_ICONS = {
  "Not Started": { icon: Circle, color: "text-gray-400", bg: "bg-gray-100", dot: "bg-gray-400" },
  "In-process": { icon: Clock, color: "text-blue-600", bg: "bg-blue-100", dot: "bg-blue-500" },
  Completed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100", dot: "bg-green-500" },
  Cancelled: { icon: XCircle, color: "text-red-400", bg: "bg-red-100", dot: "bg-red-400" },
};

function parseDate(str) {
  if (!str) return null;
  const d = parseISO(str);
  return isValid(d) ? d : null;
}

function TimelineEntry({ item }) {
  const [expanded, setExpanded] = useState(false);
  const { icon: Icon, color, bg, dot } = item.iconCfg;
  const dateObj = parseDate(item.date);
  const hasNotes = item.notes && item.notes.replace(/<[^>]*>/g, "").trim().length > 0;
  const isHtml = item.notes && /<[a-z][\s\S]*?>/i.test(item.notes);

  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      {/* Dot on the timeline */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 28 }}>
        <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center flex-shrink-0 ring-2 ring-white`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
      </div>

      {/* Content card */}
      <div className="flex-1 min-w-0 pb-1">
        <div
          className={`rounded-lg border bg-white px-3 py-2.5 ${hasNotes ? "cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all" : ""}`}
          onClick={() => hasNotes && setExpanded(!expanded)}
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold ${color}`}>{item.title}</span>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${item.badgeClass}`}>
                    {item.badge}
                  </span>
                )}
                {item.associated?.length > 0 && (
                  <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Building2 className="w-2.5 h-2.5" /> {item.associated.length} firm{item.associated.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {item.subtitle && (
                <p className="text-xs text-gray-600 mt-0.5 truncate">{item.subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                {dateObj ? format(dateObj, "MMM d, yyyy") : "—"}
              </span>
              {hasNotes && (
                expanded
                  ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
                  : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
              )}
            </div>
          </div>

          {/* Expanded notes */}
          {expanded && hasNotes && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              {isHtml ? (
                <div className="text-xs text-gray-700 quill-preview" dangerouslySetInnerHTML={{ __html: item.notes }} />
              ) : (
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{item.notes}</p>
              )}
            </div>
          )}

          {/* Associated firms (when expanded) */}
          {expanded && item.associated?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
              {item.associated.map(entry => (
                <div key={entry.firm_id} className="rounded-md bg-purple-50 border border-purple-100 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-700">
                    <Building2 className="w-2.5 h-2.5" /> {entry.firm_name}
                  </div>
                  {entry.contacts?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.contacts.map(c => (
                        <span key={c.contact_id} className="text-[9px] bg-white text-purple-600 border border-purple-200 px-1 py-0.5 rounded-full">
                          {c.contact_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContactTimeline({ contactId, contactNotes }) {
  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["contact_activities", contactId],
    queryFn: () => base44.entities.ContactActivity.filter({ deleted_at: { $exists: false }, contact_id: contactId }, "-activity_date"),
    enabled: !!contactId,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["follow_up_tasks", contactId],
    queryFn: () => base44.entities.FollowUpTask.filter({ deleted_at: { $exists: false }, originator_contact_id: contactId }, "-due_date"),
    enabled: !!contactId,
  });

  const timeline = useMemo(() => {
    const items = [];

    activities.forEach(a => {
      items.push({
        id: `activity-${a.id}`,
        sortDate: a.activity_date || "0000",
        groupDate: a.activity_date ? parseDate(a.activity_date) : null,
        title: a.activity_type || "Activity",
        subtitle: a.subjects?.length ? a.subjects.join(", ") : null,
        notes: a.notes,
        iconCfg: ACTIVITY_ICONS[a.activity_type] || ACTIVITY_ICONS.Other,
        associated: a.associated_firms_contacts || [],
      });
    });

    tasks.forEach(t => {
      items.push({
        id: `task-${t.id}`,
        sortDate: t.due_date || "0000",
        groupDate: t.due_date ? parseDate(t.due_date) : null,
        title: "Follow-up Task",
        subtitle: t.activity_label,
        notes: t.task_description,
        iconCfg: TASK_ICONS[t.status] || TASK_ICONS["Not Started"],
        badge: t.status,
        badgeClass: t.status === "Completed" ? "bg-green-100 text-green-700"
          : t.status === "In-process" ? "bg-blue-100 text-blue-700"
          : t.status === "Cancelled" ? "bg-red-100 text-red-600"
          : "bg-gray-100 text-gray-500",
      });
    });

    if (contactNotes && contactNotes.trim()) {
      items.push({
        id: "contact-notes",
        sortDate: "9999",
        groupDate: null,
        title: "General Notes",
        subtitle: null,
        notes: contactNotes,
        iconCfg: { icon: StickyNote, color: "text-amber-600", bg: "bg-amber-100", dot: "bg-amber-500" },
      });
    }

    items.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
    return items;
  }, [activities, tasks, contactNotes]);

  // Group by month
  const grouped = useMemo(() => {
    const groups = [];
    let currentKey = null;
    let currentItems = [];

    for (const item of timeline) {
      const key = item.groupDate ? format(item.groupDate, "MMMM yyyy") : "Undated";
      if (key !== currentKey) {
        if (currentItems.length > 0) {
          groups.push({ label: currentKey, items: currentItems });
        }
        currentKey = key;
        currentItems = [item];
      } else {
        currentItems.push(item);
      }
    }
    if (currentItems.length > 0) {
      groups.push({ label: currentKey, items: currentItems });
    }
    return groups;
  }, [timeline]);

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
        Save the contact first to view the timeline
      </div>
    );
  }

  if (loadingActivities && loadingTasks) {
    return <div className="text-xs text-gray-400 italic py-4 text-center">Loading timeline...</div>;
  }

  if (timeline.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
        No timeline entries yet — log activities or add notes to see them here
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" /> {timeline.length} entries</span>
        <span className="text-gray-300">·</span>
        <span>{activities.length} activities</span>
        <span className="text-gray-300">·</span>
        <span>{tasks.length} tasks</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {grouped.map((group, gi) => (
          <div key={gi} className="relative">
            {/* Month header */}
            <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white/90 backdrop-blur-sm z-10 py-1">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{group.label}</span>
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-gray-400">{group.items.length}</span>
            </div>

            {/* Entries */}
            <div className="ml-1">
              {group.items.map(item => (
                <TimelineEntry key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}