import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronRight, Bell, Settings, X, Check, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import ContactReminderSettingsDialog from "./ContactReminderSettingsDialog";

// Collapsible dashboard section showing contacts flagged as stale (no
// recorded interaction within the configured threshold). Lists each stale
// contact with days-since, last interaction date, and dismiss action. A
// settings button opens the threshold/schedule configuration dialog.
export default function StaleContactRemindersPanel({ forceExpanded, onContactClick }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const { data: settings } = useQuery({
    queryKey: ["contactReminderSettings"],
    queryFn: async () => {
      const list = await base44.entities.ContactReminderSettings.list("-created_date", 1);
      return list[0] || null;
    },
  });

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["staleContactReminders"],
    queryFn: async () => base44.entities.ContactInteractionReminder.filter({ status: "pending" }, "-days_since_last_interaction", 200),
    refetchInterval: 60000,
  });

  const dismissMutation = useMutation({
    mutationFn: async (id) => base44.entities.ContactInteractionReminder.update(id, {
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staleContactReminders"] });
      toast({ title: "Reminder dismissed" });
    },
  });

  const threshold = settings?.days_threshold ?? 30;
  const count = reminders.length;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full mb-2 px-1 group"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        )}
        <Bell className="w-4 h-4 text-rose-500" />
        <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
          Stale Contact Reminders
        </span>
        <span className="text-[11px] text-gray-400 font-normal hidden sm:inline">
          No interaction in {threshold}+ days
        </span>
        {count > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
            {count}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSettingsOpen(true); }}
          className="ml-auto flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-medium"
          title="Adjust reminder settings"
        >
          <Settings className="w-3 h-3" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </button>

      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100">
          {isLoading ? (
            <div className="py-4 text-center text-xs text-gray-400">Loading reminders…</div>
          ) : count === 0 ? (
            <div className="py-4 text-center text-xs text-gray-400">
              <Check className="w-4 h-4 text-emerald-500 inline mr-1" />
              All contacts are up to date — no stale interactions.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50/40 px-2.5 py-2 hover:bg-rose-50/70 transition-colors"
                >
                  <CalendarClock className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                  <button
                    type="button"
                    onClick={() => onContactClick?.(r.contact_id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-xs font-semibold text-gray-800 truncate">
                      {r.contact_name}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {r.firm_name ? `${r.firm_name} · ` : ""}
                      {r.days_since_last_interaction} days
                      {r.last_interaction_date
                        ? ` · last ${new Date(r.last_interaction_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : " · no interactions logged"}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissMutation.mutate(r.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Dismiss reminder"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {count > 0 && (
            <div className="mt-2 px-1 text-[10px] text-gray-400">
              Log a new interaction to auto-resolve, or dismiss to clear.
            </div>
          )}
        </div>
      )}

      <ContactReminderSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}