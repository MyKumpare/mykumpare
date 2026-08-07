import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Send, Trash2, Bell, CheckCircle2, UserCheck, ChevronDown, ChevronRight, History,
} from "lucide-react";

const EVENT_CONFIG = {
  sent: { icon: Send, label: "Invitation sent", color: "text-indigo-600", bg: "bg-indigo-50" },
  rescinded: { icon: Trash2, label: "Invitation rescinded", color: "text-rose-600", bg: "bg-rose-50" },
  reminder_sent: { icon: Bell, label: "Reminder sent", color: "text-amber-600", bg: "bg-amber-50" },
  registered: { icon: UserCheck, label: "Registration submitted", color: "text-blue-600", bg: "bg-blue-50" },
  accepted: { icon: CheckCircle2, label: "Accepted / linked to firm", color: "text-emerald-600", bg: "bg-emerald-50" },
};

const fmtDateTime = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return d; }
};

export default function InvitationHistoryLog({ invitationId, email }) {
  const [open, setOpen] = useState(false);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["invitation_history", invitationId],
    queryFn: () => base44.entities.InvitationHistory.filter(
      { invitation_id: invitationId },
      "created_date",
      50
    ),
    enabled: open && !!invitationId,
  });

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] text-gray-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <History className="w-3 h-3" />
        History {history.length > 0 && `(${history.length})`}
      </button>

      {open && (
        <div className="mt-1.5 pl-2 border-l border-gray-100 space-y-1.5">
          {isLoading ? (
            <p className="text-[10px] text-gray-400">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="text-[10px] text-gray-400">No history recorded.</p>
          ) : (
            history.map((h) => {
              const cfg = EVENT_CONFIG[h.event_type] || EVENT_CONFIG.sent;
              const Icon = cfg.icon;
              return (
                <div key={h.id} className="flex items-start gap-1.5">
                  <div className={`w-4 h-4 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-2.5 h-2.5 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-gray-600">{cfg.label}</p>
                    <p className="text-[9px] text-gray-400">
                      {fmtDateTime(h.created_date)}
                      {h.actor_name && ` · by ${h.actor_name}`}
                    </p>
                    {h.details && (
                      <p className="text-[9px] text-gray-400 mt-0.5">{h.details}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}