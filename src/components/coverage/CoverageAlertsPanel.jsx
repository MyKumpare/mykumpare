import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Building2, UserCheck } from "lucide-react";

/**
 * Displays the signed-in analyst's coverage assignment notifications — alerts
 * that fire when they are newly assigned as primary or secondary analyst on
 * a due diligence record. Shows unread alerts first, with a mark-as-read action.
 *
 * @param {string} contactId - The signed-in user's resolved contact ID.
 */
export default function CoverageAlertsPanel({ contactId }) {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["coverage-assignment-notifications", contactId],
    queryFn: () =>
      base44.entities.DdNotification.filter(
        { contact_id: contactId, type: "coverage_assignment" },
        "-created_date",
        50
      ),
    enabled: !!contactId,
  });

  const active = useMemo(() => notifications.filter((n) => !n.deleted_at), [notifications]);
  const unread = useMemo(() => active.filter((n) => n.status === "unread"), [active]);
  const visible = showAll ? active : unread;

  const markAsRead = async (notif) => {
    if (notif.status === "read") return;
    try {
      await base44.entities.DdNotification.update(notif.id, { status: "read" });
      queryClient.invalidateQueries({ queryKey: ["coverage-assignment-notifications", contactId] });
    } catch (e) {
      console.error("Failed to mark notification as read", e);
    }
  };

  const markAllRead = async () => {
    for (const n of unread) {
      try {
        await base44.entities.DdNotification.update(n.id, { status: "read" });
      } catch { /* best effort */ }
    }
    queryClient.invalidateQueries({ queryKey: ["coverage-assignment-notifications", contactId] });
  };

  if (!contactId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-500" /> Coverage Alerts
          {unread.length > 0 && (
            <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">{unread.length} new</Badge>
          )}
          {active.length > unread.length && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 ml-auto"
            >
              {showAll ? "Show unread only" : `Show all (${active.length})`}
            </button>
          )}
          {unread.length > 0 && !showAll && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-[11px] text-gray-500 hover:text-gray-700"
            >
              Mark all read
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">Loading alerts…</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-6 text-center">
            {unread.length === 0 && active.length > 0
              ? "All alerts have been reviewed."
              : "No coverage assignment alerts yet. You'll be notified here when new firms are assigned to you."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {visible.map((n) => {
              const isUnread = n.status === "unread";
              const role = n.coverage_role || "primary";
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 transition-colors ${
                    isUnread ? "border-indigo-200 bg-indigo-50/60" : "border-gray-100 bg-gray-50/40"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    role === "primary" ? "bg-indigo-100" : "bg-violet-100"
                  }`}>
                    <UserCheck className={`w-3.5 h-3.5 ${role === "primary" ? "text-indigo-600" : "text-violet-600"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {n.firm_name && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Building2 className="w-3 h-3" /> {n.firm_name}
                        </span>
                      )}
                      <Badge className={`text-[9px] ${role === "primary" ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-violet-100 text-violet-700 border-violet-200"}`}>
                        {role === "primary" ? "Primary" : "Secondary"}
                      </Badge>
                      {n.product_name && (
                        <span className="text-[10px] text-gray-400 truncate">{n.product_name}</span>
                      )}
                    </div>
                  </div>
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => markAsRead(n)}
                      title="Mark as read"
                      className="p-1 rounded hover:bg-indigo-100 text-indigo-500 hover:text-indigo-700 flex-shrink-0 mt-0.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}