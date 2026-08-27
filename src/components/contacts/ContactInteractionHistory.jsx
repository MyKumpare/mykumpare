import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, parseISO, isValid } from "date-fns";
import {
  Phone, Mail, Users, FileText, MoreHorizontal, Clock,
  ChevronDown, ChevronUp, History,
} from "lucide-react";

const ACTIVITY_ICONS = {
  Call: { icon: Phone, color: "text-blue-600", bg: "bg-blue-100" },
  Email: { icon: Mail, color: "text-green-600", bg: "bg-green-100" },
  Meeting: { icon: Users, color: "text-purple-600", bg: "bg-purple-100" },
  Note: { icon: FileText, color: "text-amber-600", bg: "bg-amber-100" },
  Other: { icon: MoreHorizontal, color: "text-gray-500", bg: "bg-gray-100" },
};

function parseDate(str) {
  if (!str) return null;
  const d = parseISO(str);
  return isValid(d) ? d : null;
}

function HistoryEntry({ item }) {
  const [expanded, setExpanded] = useState(false);
  const { icon: Icon, color, bg } = item.iconCfg;
  const dateObj = parseDate(item.date);
  const hasNotes = item.notes && item.notes.replace(/<[^>]*>/g, "").trim().length > 0;
  const isHtml = item.notes && /<[a-z][\s\S]*?>/i.test(item.notes);

  return (
    <div className="flex gap-2.5 group">
      {/* Icon + connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <div className="w-0.5 flex-1 bg-gray-200 mt-0.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div
          className={`rounded-lg border border-gray-200 bg-white px-3 py-2 ${hasNotes ? "cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all" : ""}`}
          onClick={() => hasNotes && setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold ${color}`}>{item.type}</span>
                {item.subject && <span className="text-xs text-gray-500 truncate">· {item.subject}</span>}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] text-gray-400">
                  {dateObj ? format(dateObj, "MMM d, yyyy") : "—"}
                </span>
              </div>
            </div>
            {hasNotes && (
              expanded
                ? <ChevronUp className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                : <ChevronDown className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            )}
          </div>

          {expanded && hasNotes && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              {isHtml ? (
                <div className="text-xs text-gray-700 quill-preview" dangerouslySetInnerHTML={{ __html: item.notes }} />
              ) : (
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{item.notes}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContactInteractionHistory({ contactId, contactNotes }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["contact_activities", contactId],
    queryFn: () => base44.entities.ContactActivity.filter({ contact_id: contactId }, "-activity_date", 50),
    enabled: !!contactId,
  });

  const history = useMemo(() => {
    const items = activities.map((a) => ({
      id: a.id,
      date: a.activity_date,
      type: a.activity_type || "Activity",
      subject: a.subjects?.length ? a.subjects.join(", ") : a.subject || null,
      notes: a.notes,
      iconCfg: ACTIVITY_ICONS[a.activity_type] || ACTIVITY_ICONS.Other,
    }));
    items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return items;
  }, [activities]);

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
        Save the contact first to view interaction history
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-800">Interaction History</h3>
        <span className="text-xs text-gray-400">({history.length})</span>
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-3 text-center">Loading interactions…</div>
      ) : history.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-3 text-center">
          No interactions logged yet — use the Activities tab to log meetings, calls, and notes.
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto pr-1">
          {history.map((item) => (
            <HistoryEntry key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}