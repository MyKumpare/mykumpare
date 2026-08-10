import React from "react";
import { format } from "date-fns";
import {
  Phone, Mail, Users, StickyNote, MoreHorizontal, ListTodo,
  ChevronRight, Building2, User, Calendar,
} from "lucide-react";

export const TYPE_CONFIG = {
  Meeting: { icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  Call: { icon: Phone, color: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500" },
  Email: { icon: Mail, color: "text-violet-600", bg: "bg-violet-50", dot: "bg-violet-500" },
  Note: { icon: StickyNote, color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500" },
  Other: { icon: MoreHorizontal, color: "text-gray-600", bg: "bg-gray-50", dot: "bg-gray-500" },
  Task: { icon: ListTodo, color: "text-orange-600", bg: "bg-orange-50", dot: "bg-orange-500" },
};

export function getItemDisplay(item) {
  if (item._kind === "task") {
    const firms = item.assigned_firms_contacts || [];
    const firmNames = firms.map((f) => f.firm_name).filter(Boolean);
    const contactNames = firms.flatMap((f) => (f.contacts || []).map((c) => c.contact_name)).filter(Boolean);
    const desc = (item.task_description || "").replace(/<[^>]*>/g, "").trim();
    return {
      type: "Task",
      title: desc || "Follow-up task",
      firmNames,
      contactNames,
      status: item.status,
    };
  }
  const firms = item.associated_firms_contacts || [];
  const firmNames = firms.map((f) => f.firm_name).filter(Boolean);
  const contactNames = firms.flatMap((f) => (f.contacts || []).map((c) => c.contact_name)).filter(Boolean);
  const subjectStr = (item.subjects && item.subjects.length) ? item.subjects.join(", ") : "";
  const notesStr = (item.notes || "").replace(/<[^>]*>/g, "").trim();
  return {
    type: item.activity_type || "Other",
    title: subjectStr || notesStr.substring(0, 100) || item.activity_type || "Activity",
    firmNames,
    contactNames,
  };
}

export default function CalendarDayPanel({ date, items, onActivityClick, onTaskClick }) {
  if (!date) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{format(date, "EEEE, MMMM d")}</h3>
          <p className="text-sm text-gray-500">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        <Calendar className="w-5 h-5 text-gray-300" />
      </div>
      <div className="max-h-[55vh] overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400">
            No activities or tasks scheduled for this day.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((item) => {
              const display = getItemDisplay(item);
              const config = TYPE_CONFIG[display.type] || TYPE_CONFIG.Other;
              const Icon = config.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => (item._kind === "task" ? onTaskClick(item) : onActivityClick(item))}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={`mt-0.5 w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${config.color}`}>{display.type}</span>
                      {display.status && (
                        <span className="text-xs text-gray-400">· {display.status}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 line-clamp-2">{display.title}</p>
                    {(display.contactNames.length > 0 || display.firmNames.length > 0) && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        {display.contactNames.length > 0 && (
                          <span className="flex items-center gap-1 min-w-0">
                            <User className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{display.contactNames.join(", ")}</span>
                          </span>
                        )}
                        {display.firmNames.length > 0 && (
                          <span className="flex items-center gap-1 min-w-0">
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{display.firmNames.join(", ")}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}