import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Phone, Mail, Users, FileText, MoreHorizontal,
  ChevronDown, ChevronUp, ClipboardList, Building2, User,
  Clock, AlertCircle, CheckCircle2, XCircle, Calendar, Paperclip,
  Link2, FileText as FileIcon
} from "lucide-react";
import { format } from "date-fns";

const ACTIVITY_ICONS = {
  Call:    { icon: Phone,         color: "text-blue-500",   bg: "bg-blue-50" },
  Email:   { icon: Mail,          color: "text-green-500",  bg: "bg-green-50" },
  Meeting: { icon: Users,         color: "text-purple-500", bg: "bg-purple-50" },
  Note:    { icon: FileText,      color: "text-amber-500",  bg: "bg-amber-50" },
  Other:   { icon: MoreHorizontal,color: "text-gray-500",   bg: "bg-gray-100" },
};

const STATUS_STYLES = {
  "Not Started": { color: "text-gray-500",  bg: "bg-gray-100",  border: "border-gray-200",  icon: Clock },
  "In-process":  { color: "text-blue-600",  bg: "bg-blue-50",   border: "border-blue-200",  icon: AlertCircle },
  "Completed":   { color: "text-green-600", bg: "bg-green-50",  border: "border-green-200", icon: CheckCircle2 },
  "Cancelled":   { color: "text-red-500",   bg: "bg-red-50",    border: "border-red-200",   icon: XCircle },
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

// ── Expandable Activity Row ───────────────────────────────────────────────────
function ActivityRow({ activity }) {
  const [expanded, setExpanded] = useState(false);
  const { icon: Icon, color, bg } = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.Other;
  const associated = activity.associated_firms_contacts || [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700">{activity.activity_type}</span>
            {activity.subject && <span className="text-xs text-gray-500 truncate">· {activity.subject}</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
            {activity.activity_date ? fmt(activity.activity_date) : "—"}
            {activity.contact_name && (
              <span className="flex items-center gap-0.5 text-indigo-500">
                <User className="w-2.5 h-2.5" /> {activity.contact_name}
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-3">
          {activity.notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{activity.notes}</p>
          ) : (
            <p className="text-xs text-gray-400 italic">No notes recorded.</p>
          )}

          {/* Associated firms/contacts */}
          {associated.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Associated Firms & Contacts</p>
              {associated.map((entry, i) => (
                <div key={i} className="rounded-lg bg-purple-50 border border-purple-100 px-2.5 py-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                    <Building2 className="w-3 h-3" /> {entry.firm_name}
                  </div>
                  {entry.contacts?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.contacts.map(c => (
                        <span key={c.contact_id} className="text-[10px] bg-white text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <User className="w-2.5 h-2.5" /> {c.contact_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Expandable Task Row ───────────────────────────────────────────────────────
function TaskRow({ task }) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
  const StatusIcon = s.icon;

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${s.border}`}>
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${s.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>{task.status}</span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Due {fmt(task.due_date)}
            </span>
            {task.assigned_to_contact_name && (
              <span className="text-[10px] text-indigo-600 flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                <User className="w-2.5 h-2.5" /> {task.assigned_to_contact_name}
              </span>
            )}
            {task.attachments?.length > 0 && (
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full">
                <Paperclip className="w-2.5 h-2.5" /> {task.attachments.length}
              </span>
            )}
          </div>
          {task.task_description && (
            <div
              className="text-xs text-gray-600 mt-1 line-clamp-2 quill-preview"
              dangerouslySetInnerHTML={{ __html: task.task_description }}
            />
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />}
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Task Description</p>
            <div className="text-sm text-gray-700 quill-preview" dangerouslySetInnerHTML={{ __html: task.task_description || "<em>—</em>" }} />
          </div>

          {task.notes && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <div className="text-sm text-gray-700 quill-preview" dangerouslySetInnerHTML={{ __html: task.notes }} />
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {task.originator_contact_name && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-amber-500" />
                Requested by <span className="font-medium text-gray-700 ml-0.5">{task.originator_contact_name}</span>
              </span>
            )}
            {task.assigned_to_contact_name && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-blue-500" />
                Assigned to <span className="font-medium text-gray-700 ml-0.5">{task.assigned_to_contact_name}</span>
                {task.assigned_to_firm_name && <span>· {task.assigned_to_firm_name}</span>}
              </span>
            )}
            {task.completion_date && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" /> Completed {fmt(task.completion_date)}
              </span>
            )}
          </div>

          {task.activity_label && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
              <Link2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Linked to: {task.activity_label}</span>
            </div>
          )}

          {task.attachments?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Attachments</p>
              {task.attachments.map(att => (
                <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <FileIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{att.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function FirmActivityLogTab({ firmId, firmName }) {
  const [activeSection, setActiveSection] = useState("activities");

  // Fetch ALL contact activities — filter client-side for those mentioning this firm
  const { data: allActivities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["all_activities_for_firm", firmId],
    queryFn: () => base44.entities.ContactActivity.list("-activity_date", 500),
    enabled: !!firmId,
  });

  // Fetch ALL follow-up tasks — filter for those assigned to/from this firm
  const { data: allTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["all_tasks_for_firm", firmId],
    queryFn: () => base44.entities.FollowUpTask.list("-due_date", 500),
    enabled: !!firmId,
  });

  // Fetch contacts of this firm to cross-reference activities
  const { data: firmContacts = [] } = useQuery({
    queryKey: ["contacts_for_firm_activity", firmId],
    queryFn: () => base44.entities.Contact.filter({ firm_ids: firmId }),
    enabled: !!firmId,
  });

  const firmContactIds = useMemo(() => new Set(firmContacts.map(c => c.id)), [firmContacts]);

  // Activities mentioning this firm: either the contact belongs to this firm,
  // OR the activity's associated_firms_contacts includes this firm
  const firmActivities = useMemo(() => {
    return allActivities
      .filter(a => {
        const contactBelongs = firmContactIds.has(a.contact_id);
        const firmMentioned = (a.associated_firms_contacts || []).some(e => e.firm_id === firmId);
        return contactBelongs || firmMentioned;
      })
      .map(a => {
        const contact = firmContacts.find(c => c.id === a.contact_id);
        return {
          ...a,
          contact_name: contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : null,
        };
      });
  }, [allActivities, firmContactIds, firmId, firmContacts]);

  // Tasks associated with this firm: assigned to/from someone in the firm, or assigned_to_firm_id matches
  const firmTasks = useMemo(() => {
    return allTasks.filter(t =>
      t.assigned_to_firm_id === firmId ||
      firmContactIds.has(t.originator_contact_id) ||
      firmContactIds.has(t.assigned_to_contact_id)
    );
  }, [allTasks, firmContactIds, firmId]);

  const isLoading = loadingActivities || loadingTasks;

  const sections = [
    { key: "activities", label: "Activity Logs", count: firmActivities.length },
    { key: "tasks", label: "Follow-up Tasks", count: firmTasks.length },
  ];

  return (
    <div className="space-y-3">
      {/* Section toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
        {sections.map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveSection(s.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSection === s.key
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {s.label}
            {s.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeSection === s.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-500"
              }`}>
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-6 text-center">Loading...</div>
      ) : activeSection === "activities" ? (
        firmActivities.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
            No activity logs mention this firm yet
          </div>
        ) : (
          <div className="space-y-2">
            {firmActivities.map(a => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>
        )
      ) : (
        firmTasks.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
            No follow-up tasks associated with this firm yet
          </div>
        ) : (
          <div className="space-y-2">
            {firmTasks.map(t => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        )
      )}
    </div>
  );
}