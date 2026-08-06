import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ShieldX, ShieldAlert, Clock, Bell, Eye, Loader2,
} from "lucide-react";
import AddDueDiligenceDialog from "../firms/AddDueDiligenceDialog";

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

export default function ContactNotificationsTab({ contactId, contactName, onContactClick, onProductClick }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["dd-notifications", contactId],
    queryFn: () => base44.entities.DdNotification.filter({ contact_id: contactId }, "-created_date", 200),
    enabled: !!contactId,
  });

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
    mutationFn: ({ id, data }) => base44.entities.DueDiligence.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dd-notifications", contactId] });
      if (editing?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", editing.firm_id] });
      setShowDialog(false);
    },
  });

  const handleReview = async (notification) => {
    if (notification.status === "unread") {
      markReadMutation.mutate(notification.id);
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

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

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
          {notifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.approval_decision;
            const Icon = cfg.icon;
            const DecIcon = n.supervisor_status ? DECISION_ICON[n.supervisor_status] : null;
            const isUnread = n.status === "unread";

            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${cfg.bgClass} ${isUnread ? "ring-1 ring-indigo-200" : "opacity-75"} transition-opacity`}
              >
                <div className={`mt-0.5 ${cfg.iconClass}`}>
                  {DecIcon ? <DecIcon className={`w-4 h-4 ${n.supervisor_status ? DECISION_CLASS[n.supervisor_status] : ""}`} /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${cfg.badgeClass}`}>{cfg.label}</span>
                    {n.product_name && (
                      <span className="text-[10px] text-gray-500 truncate">{n.product_name}</span>
                    )}
                    {isUnread && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
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
                    {reviewing?.id === n.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                    {cfg.actionLabel}
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
      />
    </div>
  );
}