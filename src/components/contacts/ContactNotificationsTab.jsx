import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ShieldX, ShieldAlert, Clock, Bell, Eye, Loader2,
  CheckCircle2, ExternalLink, MessageSquare, Send,
} from "lucide-react";
import AddDueDiligenceDialog from "../firms/AddDueDiligenceDialog";
import { syncDdNotifications, deleteDdNotifications } from "../firms/ddNotificationSync";
import { saveStageNoteVersions } from "../firms/ddNoteVersionSync";

const TYPE_CONFIG = {
  supervisor_request: {
    label: "Approval Request",
    icon: ShieldCheck,
    iconClass: "text-amber-600",
    bgClass: "bg-amber-50 border-amber-200",
    badgeClass: "bg-amber-100 text-amber-700",
    actionLabel: "Review",
  },
  approval_decision: {
    label: "Decision",
    icon: Clock,
    iconClass: "text-indigo-600",
    bgClass: "bg-indigo-50 border-indigo-200",
    badgeClass: "bg-indigo-100 text-indigo-700",
    actionLabel: "View",
  },
  external_chat: {
    label: "External Chat",
    icon: MessageSquare,
    iconClass: "text-violet-600",
    bgClass: "bg-violet-50 border-violet-200",
    badgeClass: "bg-violet-100 text-violet-700",
    actionLabel: "Respond",
  },
};

const DECISION_ICON = {
  approved: ShieldCheck,
  rejected: ShieldX,
  on_hold: ShieldAlert,
};

const DECISION_CLASS = {
  approved: "text-emerald-600",
  rejected: "text-red-600",
  on_hold: "text-orange-600",
};

export default function ContactNotificationsTab({ contactId, contactName, onContactClick, onProductClick, onOpenChat }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseText, setResponseText] = useState("");

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["dd-notifications", contactId],
    queryFn: async () => {
      const all = await base44.entities.DdNotification.filter({ contact_id: contactId }, "-created_date", 200);
      // Filter out orphaned notifications whose DD record has been deleted.
      // Use a single $in query (returns only existing records) instead of per-ID
      // .get() calls, which throw a "not found" error for every deleted DD record.
      const ddIds = [...new Set(all.map((n) => n.due_diligence_id).filter(Boolean))];
      let validDdIds = new Set();
      if (ddIds.length) {
        const existing = await base44.entities.DueDiligence.filter({ id: { $in: ddIds } });
        validDdIds = new Set(existing.map((d) => d.id));
      }
      const orphaned = all.filter((n) => n.due_diligence_id && !validDdIds.has(n.due_diligence_id));
      // Best-effort cleanup of orphaned notifications
      for (const n of orphaned) {
        try { await base44.entities.DdNotification.delete(n.id); } catch { /* no-op */ }
      }
      return all.filter((n) => !n.due_diligence_id || validDdIds.has(n.due_diligence_id));
    },
    enabled: !!contactId,
  });

  // Real-time: refresh notifications when new ones arrive (e.g. external firm sends a chat)
  useEffect(() => {
    if (!contactId) return;
    const unsubscribe = base44.entities.DdNotification.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["dd-notifications", contactId] });
    });
    return unsubscribe;
  }, [contactId, queryClient]);

  const { data: editProducts = [] } = useQuery({
    queryKey: ["products", editing?.firm_id],
    queryFn: () => base44.entities.Product.filter({ firm_id: editing.firm_id }),
    enabled: !!editing?.firm_id,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.DdNotification.update(id, { status: "read" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dd-notifications", contactId] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const previousRecord = await base44.entities.DueDiligence.get(id);
      const savedRecord = await base44.entities.DueDiligence.update(id, data);
      await syncDdNotifications(savedRecord);
      await saveStageNoteVersions(savedRecord, previousRecord);
      return savedRecord;
    },
    onSuccess: (savedRecord) => {
      queryClient.invalidateQueries({ queryKey: ["dd-notifications", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-stage-note-versions"] });
      if (editing?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", editing.firm_id] });
      setShowDialog(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await deleteDdNotifications(id);
      await base44.entities.DueDiligence.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dd-notifications", contactId] });
      if (editing?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", editing.firm_id] });
      setShowDialog(false);
      setEditing(null);
    },
  });

  const respondChatMutation = useMutation({
    mutationFn: async ({ notification, response }) => {
      const todayStr = new Date().toISOString().split("T")[0];
      // Update the ExternalChat record with the response
      if (notification.external_chat_id) {
        await base44.entities.ExternalChat.update(notification.external_chat_id, {
          response,
          responded_date: todayStr,
          status: "completed",
        });
      }
      // Mark the notification as completed
      return base44.entities.DdNotification.update(notification.id, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dd-notifications", contactId] });
      setRespondingTo(null);
      setResponseText("");
    },
  });

  const decideMutation = useMutation({
    mutationFn: async ({ notification, decision }) => {
      const dd = await base44.entities.DueDiligence.get(notification.due_diligence_id);
      if (!dd || !dd.stages) throw new Error("Due diligence record not found");
      // Guard: only the currently assigned supervisor can approve. If the
      // supervisor was changed since this notification was created, block.
      const stage = dd.stages.find((s) => s.name === notification.stage_name);
      if (stage && stage.supervisor_contact_id !== notification.contact_id) {
        throw new Error("You are no longer the assigned supervisor for this stage.");
      }
      const todayStr = new Date().toISOString().split("T")[0];
      const updatedStages = dd.stages.map((stage) => {
        if (stage.name !== notification.stage_name) return stage;
        const updated = { ...stage, supervisor_status: decision, supervisor_date: todayStr };
        if (stage.sub_stages) {
          updated.sub_stages = stage.sub_stages.map((ss) => {
            if (ss.name && ss.name.toLowerCase().includes("supervisor")) {
              return {
                ...ss,
                status: "completed",
                end_date: todayStr,
                performed_by_contact_id: stage.supervisor_contact_id,
                performed_by_name: stage.supervisor_name,
              };
            }
            return ss;
          });
        }
        if (decision === "approved") {
          updated.completed = true;
          updated.completed_date = todayStr;
          updated.end_date = todayStr;
        }
        return updated;
      });
      const savedRecord = await base44.entities.DueDiligence.update(dd.id, { stages: updatedStages });
      await syncDdNotifications(savedRecord);
      return savedRecord;
    },
    onSuccess: (savedRecord) => {
      queryClient.invalidateQueries({ queryKey: ["dd-notifications", contactId] });
    },
  });

  const handleReview = async (notification) => {
    if (notification.status === "unread") {
      markReadMutation.mutate(notification.id);
    }
    // For external chat notifications, link directly to the chat thread
    if (notification.type === "external_chat" && notification.external_chat_id && onOpenChat) {
      onOpenChat(notification.external_chat_id);
      return;
    }
    setReviewing(notification);
    try {
      const dd = await base44.entities.DueDiligence.get(notification.due_diligence_id);
      if (dd) {
        setEditing(dd);
        setShowDialog(true);
      }
    } catch (e) {
      console.error("Failed to load DD record", e);
    }
  };

  const handleSubmit = (data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
  };

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center">
        Save the contact to view notifications.
      </div>
    );
  }

  const completedNotifications = notifications.filter((n) => n.status === "completed");
  const pendingNotifications = notifications.filter((n) => n.status !== "completed");
  const unreadCount = pendingNotifications.filter((n) => n.status === "unread").length;
  const hasCompleted = completedNotifications.length > 0;

  const visibleNotifications = hideCompleted ? pendingNotifications : notifications;

  return (
    <div className="space-y-2 py-1">
      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          <Bell className="w-5 h-5 text-gray-300 mx-auto mb-1" />
          No notifications yet. Supervisor approval requests and decisions will appear here.
        </div>
      ) : (
        <div className="space-y-2">
          {unreadCount > 0 && (
            <div className="text-xs font-medium text-indigo-600 flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" /> {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
            </div>
          )}

          {hasCompleted && (
            <button
              type="button"
              onClick={() => setHideCompleted((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 w-full text-left"
            >
              {hideCompleted ? (
                <><Eye className="w-3.5 h-3.5" /> Show {completedNotifications.length} completed notification{completedNotifications.length > 1 ? "s" : ""}</>
              ) : (
                <><Eye className="w-3.5 h-3.5 rotate-180" /> Hide {completedNotifications.length} completed notification{completedNotifications.length > 1 ? "s" : ""}</>
              )}
            </button>
          )}

          {visibleNotifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.approval_decision;
            const Icon = cfg.icon;
            const DecIcon = n.supervisor_status ? DECISION_ICON[n.supervisor_status] : null;
            const isUnread = n.status === "unread";
            const isCompleted = n.status === "completed";

            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-opacity ${
                  isCompleted
                    ? "bg-gray-50 border-gray-200 opacity-60"
                    : `${cfg.bgClass} ${isUnread ? "ring-1 ring-indigo-200" : "opacity-80"}`
                }`}
              >
                <div className={`mt-0.5 ${isCompleted ? "text-gray-400" : cfg.iconClass}`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : DecIcon ? (
                    <DecIcon className={`w-4 h-4 ${n.supervisor_status ? DECISION_CLASS[n.supervisor_status] : ""}`} />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isCompleted ? "bg-gray-200 text-gray-500" : cfg.badgeClass}`}>
                      {isCompleted ? "Completed" : cfg.label}
                    </span>
                    {n.product_name && (
                      <span className="text-[10px] text-gray-500 truncate">{n.product_name}</span>
                    )}
                    {isUnread && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReview(n)}
                    className={`text-sm font-medium mt-0.5 text-left hover:underline ${isCompleted ? "text-gray-500 hover:text-gray-700" : "text-gray-800 hover:text-indigo-700"}`}
                  >
                    {n.title}
                  </button>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  {n.type === "supervisor_request" && !isCompleted && (
                    <div className="flex gap-1.5 mt-1.5">
                      <Button type="button" size="sm" className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white" disabled={decideMutation.isPending} onClick={() => decideMutation.mutate({ notification: n, decision: "approved" })}>
                        <ShieldCheck className="w-3 h-3" /> Approve
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] border-red-300 text-red-600 hover:bg-red-50" disabled={decideMutation.isPending} onClick={() => decideMutation.mutate({ notification: n, decision: "rejected" })}>
                        <ShieldX className="w-3 h-3" /> Reject
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] border-orange-300 text-orange-600 hover:bg-orange-50" disabled={decideMutation.isPending} onClick={() => decideMutation.mutate({ notification: n, decision: "on_hold" })}>
                        <ShieldAlert className="w-3 h-3" /> On Hold
                      </Button>
                    </div>
                  )}
                  {n.type === "external_chat" && !isCompleted && (
                    <div className="mt-1.5">
                      {respondingTo?.id === n.id ? (
                        <div className="space-y-1.5">
                          <textarea
                            className="w-full text-xs border border-gray-200 rounded-md p-2 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            placeholder="Type your response..."
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            disabled={respondChatMutation.isPending}
                          />
                          <div className="flex gap-1.5">
                            <Button type="button" size="sm" className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white" disabled={respondChatMutation.isPending || !responseText.trim()} onClick={() => respondChatMutation.mutate({ notification: n, response: responseText.trim() })}>
                              {respondChatMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Send Response
                            </Button>
                            <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setRespondingTo(null); setResponseText(""); }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <Button type="button" size="sm" className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => { if (n.status === "unread") markReadMutation.mutate(n.id); setRespondingTo(n); }}>
                          <MessageSquare className="w-3 h-3" /> Respond
                        </Button>
                      )}
                    </div>
                  )}
                  {n.created_date && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.created_date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={reviewing?.id === n.id}
                    onClick={() => handleReview(n)}
                  >
                    {reviewing?.id === n.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isCompleted ? (
                      <ExternalLink className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                    {isCompleted ? "Open" : cfg.actionLabel}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddDueDiligenceDialog
        open={showDialog}
        onOpenChange={(v) => { setShowDialog(v); if (!v) { setEditing(null); setReviewing(null); } }}
        firmId={editing?.firm_id}
        firmName={editing?.firm_name}
        products={editProducts}
        contacts={[]}
        editingRecord={editing}
        firmSelectionMode
        onSubmit={handleSubmit}
        onDelete={(id) => { setShowDialog(false); setEditing(null); deleteMutation.mutate(id); }}
      />
    </div>
  );
}