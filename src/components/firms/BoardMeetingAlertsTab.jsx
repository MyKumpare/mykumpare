import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, CheckCheck, X, Loader2, CalendarPlus, CalendarClock, FileText, ExternalLink, Building2, Flag,
} from "lucide-react";

const ALERT_FILTERS = [
  { key: "unread", label: "Unread" },
  { key: "all", label: "All" },
  { key: "dismissed", label: "Dismissed" },
];

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}
function fmtDateTime(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  catch { return d; }
}

export default function BoardMeetingAlertsTab({ onFirmClick }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("unread");
  const [firmFilter, setFirmFilter] = useState("all");

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["board-meeting-alerts"],
    queryFn: () => base44.entities.BoardMeetingAlert.list("-created_date", 500),
  });

  const firms = useMemo(() => {
    const map = new Map();
    (alerts || []).forEach(a => {
      if (a.firm_id && a.firm_name && !map.has(a.firm_id)) map.set(a.firm_id, a.firm_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [alerts]);

  const filtered = useMemo(() => {
    return (alerts || [])
      .filter(a => !a.deleted_at)
      .filter(a => {
        if (filter === "unread") return !a.is_dismissed && !a.is_read;
        if (filter === "dismissed") return a.is_dismissed;
        return true; // all (exclude deleted only)
      })
      .filter(a => firmFilter === "all" || a.firm_id === firmFilter);
  }, [alerts, filter, firmFilter]);

  const unreadCount = (alerts || []).filter(a => !a.deleted_at && !a.is_dismissed && !a.is_read).length;

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => base44.entities.BoardMeetingAlert.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board-meeting-alerts"] }),
  });

  const markRead = (id) => updateMutation.mutate({ id, data: { is_read: true } });
  const dismiss = (id) => updateMutation.mutate({ id, data: { is_dismissed: true, is_read: true } });
  const restore = (id) => updateMutation.mutate({ id, data: { is_dismissed: false } });

  const markAllRead = async () => {
    const unread = filtered.filter(a => !a.is_read);
    if (!unread.length) return;
    for (const a of unread) {
      try { await base44.entities.BoardMeetingAlert.update(a.id, { is_read: true }); } catch {}
    }
    queryClient.invalidateQueries({ queryKey: ["board-meeting-alerts"] });
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-800">Board Meeting Alerts</h2>
          {unreadCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200">{unreadCount} unread</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={firmFilter}
            onChange={e => setFirmFilter(e.target.value)}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="all">All firms</option>
            {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
            {ALERT_FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1.5 text-xs ${filter === f.key ? "bg-amber-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {filter !== "dismissed" && unreadCount > 0 && (
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={markAllRead} disabled={updateMutation.isPending}>
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {filter === "dismissed"
              ? "No dismissed alerts."
              : "No board meeting alerts. The daily detector will alert you here whenever a tracked firm adds or changes a board meeting."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const isNew = a.alert_type === "new_meeting";
            const isMention = a.alert_type === "mention_flagged";
            const isReminder = a.alert_type === "upcoming_reminder";
            const Icon = isMention ? Flag : isReminder ? Bell : isNew ? CalendarPlus : CalendarClock;
            const badgeClass = isMention
              ? "bg-rose-100 text-rose-700 border border-rose-200"
              : isReminder
                ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                : isNew
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : "bg-amber-100 text-amber-700 border border-amber-200";
            const iconBg = isMention ? "bg-rose-100 text-rose-600" : isReminder ? "bg-indigo-100 text-indigo-600" : isNew ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600";
            const cardBorder = isMention ? "border-rose-300 bg-rose-50/40" : isReminder ? "border-indigo-300 bg-indigo-50/40" : "border-amber-300 bg-amber-50/40";
            return (
              <div
                key={a.id}
                className={`rounded-xl border p-3 transition-colors ${a.is_dismissed ? "border-gray-200 bg-gray-50/60 opacity-70" : a.is_read ? "border-gray-200 bg-white" : cardBorder}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] ${badgeClass}`}>
                        {isMention ? "Mention Flagged" : isReminder ? "Upcoming Reminder" : isNew ? "New Meeting" : "Updated"}
                      </Badge>
                      {a.field_changed && (
                        <Badge variant="outline" className="text-[10px] bg-white text-gray-600 border-gray-200">
                          {a.field_changed === "meeting_date" ? "Date changed" : a.field_changed === "agenda_url" ? "Agenda added" : a.field_changed === "minutes_url" ? "Minutes added" : a.field_changed}
                        </Badge>
                      )}
                      <button
                        onClick={() => onFirmClick?.(a.firm_id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                      >
                        <Building2 className="w-3 h-3" /> {a.firm_name}
                      </button>
                      {!a.is_read && !a.is_dismissed && <span className="w-2 h-2 rounded-full bg-amber-500" title="Unread" />}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 mt-1">{a.meeting_title || "Untitled board meeting"}</h3>
                    <p className="text-xs text-gray-600 mt-0.5 leading-snug">{a.details}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {fmtDate(a.meeting_date)}</span>
                      <span>Detected {fmtDateTime(a.created_date)}</span>
                      {a.source_url && (
                        <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cyan-600 hover:underline">
                          <ExternalLink className="w-3 h-3" /> Source
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {a.is_dismissed ? (
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => restore(a.id)}>Restore</Button>
                    ) : (
                      <>
                        {!a.is_read && (
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => markRead(a.id)}>
                            <CheckCheck className="w-3.5 h-3.5" /> Read
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-gray-500 hover:text-gray-700" onClick={() => dismiss(a.id)}>
                          <X className="w-3.5 h-3.5" /> Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}