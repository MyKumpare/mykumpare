import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play, CheckCircle2, Pencil, Lock, LockOpen, ClipboardCheck, Check, X, Loader2, Bell, Package
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "@/components/ui/use-toast";

const EVENT_CONFIG = {
  scoring_started: { icon: Play, color: "text-blue-600", bg: "bg-blue-50", label: "Started" },
  score_updated: { icon: Pencil, color: "text-amber-600", bg: "bg-amber-50", label: "Score Updated" },
  phase_finalized: { icon: ClipboardCheck, color: "text-violet-600", bg: "bg-violet-50", label: "Phase Finalized" },
  scoring_completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Completed" },
  scoring_reopened: { icon: LockOpen, color: "text-orange-600", bg: "bg-orange-50", label: "Reopened" },
};

const STATUS_FILTERS = [
  { key: "unread", label: "Unread" },
  { key: "all", label: "All" },
  { key: "read", label: "Read" },
];

export default function ScoringAlertsTab({ onProductClick }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("unread");
  const [eventFilter, setEventFilter] = useState("all");

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["scoringNotifications"],
    queryFn: () => base44.entities.ScoringNotification.list("-created_date", 500),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoringNotification.update(id, { status: "read" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scoringNotifications"] }),
  });

  const markUnreadMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoringNotification.update(id, { status: "unread" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scoringNotifications"] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoringNotification.update(id, { status: "dismissed" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scoringNotifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = filtered.filter((n) => n.status === "unread");
      for (const n of unread) {
        await base44.entities.ScoringNotification.update(n.id, { status: "read" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoringNotifications"] });
      toast({ title: "All marked as read" });
    },
  });

  const filtered = useMemo(() => {
    let result = notifications;
    if (statusFilter === "unread") result = result.filter((n) => n.status === "unread");
    else if (statusFilter === "read") result = result.filter((n) => n.status === "read");
    if (eventFilter !== "all") result = result.filter((n) => n.event_type === eventFilter);
    return result;
  }, [notifications, statusFilter, eventFilter]);

  const unreadCount = notifications.filter((n) => n.status === "unread").length;
  const eventTypes = [...new Set(notifications.map((n) => n.event_type))];

  return (
    <div className="space-y-3">
      {/* Header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-rose-500" />
          <h2 className="text-sm font-semibold text-gray-800">Scoring Alerts</h2>
          {unreadCount > 0 && (
            <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs">{unreadCount} unread</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
            <Check className="w-3.5 h-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === f.key
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {eventTypes.length > 1 && (
          <>
            <span className="w-px h-5 bg-gray-200" />
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-2 py-1 rounded-full text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              <option value="all">All events</option>
              {eventTypes.map((et) => (
                <option key={et} value={et}>{EVENT_CONFIG[et]?.label || et}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {statusFilter === "unread" ? "No unread scoring alerts." : "No scoring alerts yet."}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Notifications appear here when analysts update scores or finalize evaluations.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((n) => {
            const cfg = EVENT_CONFIG[n.event_type] || EVENT_CONFIG.score_updated;
            const Icon = cfg.icon;
            const isUnread = n.status === "unread";
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  isUnread ? "bg-white border-rose-200 hover:bg-rose-50/30" : "bg-gray-50/50 border-gray-100 hover:bg-gray-50"
                }`}
              >
                {/* Icon */}
                <div className={`mt-0.5 w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    {n.phase && <Badge variant="outline" className="text-[10px] py-0">{n.phase}</Badge>}
                    {isUnread && <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 truncate">{n.event_description}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Package className="w-3 h-3" /> {n.product_name}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">{n.firm_name}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">{n.template_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">
                      {n.triggered_by_name ? `by ${n.triggered_by_name} · ` : ""}{format(parseISO(n.created_date), "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isUnread ? (
                    <button
                      onClick={() => markReadMutation.mutate(n.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => markUnreadMutation.mutate(n.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title="Mark as unread"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => dismissMutation.mutate(n.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}