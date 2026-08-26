import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Clock, Save, RotateCw } from "lucide-react";

// Settings dialog for the stale-contact reminder system. Lets the admin
// adjust the number of days without interaction before a contact is flagged
// (default 30), enable/disable the daily check, and set the run time.
export default function ContactReminderSettingsDialog({ open, onClose }) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [enabled, setEnabled] = useState(true);
  const [time, setTime] = useState("07:00");
  const [loaded, setLoaded] = useState(false);

  // Load existing settings (or defaults) when the dialog opens.
  const { data: settings, isLoading } = useQuery({
    queryKey: ["contactReminderSettings"],
    queryFn: async () => {
      const list = await base44.entities.ContactReminderSettings.list("-created_date", 1);
      return list[0] || null;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open && settings) {
      setDays(settings.days_threshold ?? 30);
      setEnabled(settings.schedule_enabled ?? true);
      setTime(settings.schedule_time || "07:00");
      setLoaded(true);
    } else if (open && !isLoading && !settings) {
      setDays(30); setEnabled(true); setTime("07:00"); setLoaded(true);
    }
  }, [open, settings, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        days_threshold: Math.max(1, parseInt(days, 10) || 30),
        schedule_enabled: enabled,
        schedule_time: time || "07:00",
      };
      if (settings?.id) {
        return base44.entities.ContactReminderSettings.update(settings.id, payload);
      }
      return base44.entities.ContactReminderSettings.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contactReminderSettings"] });
      queryClient.invalidateQueries({ queryKey: ["staleContactReminders"] });
      toast({ title: "Reminder settings saved" });
      onClose();
    },
    onError: (e) => toast({ title: "Failed to save settings", description: e.message, variant: "destructive" }),
  });

  const runNowMutation = useMutation({
    mutationFn: async () => base44.functions.invoke("checkStaleContactInteractions", {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["staleContactReminders"] });
      const data = res?.data || res || {};
      toast({
        title: "Check complete",
        description: `${data.newly_flagged ?? 0} newly flagged · ${data.stale_contacts ?? 0} total stale · ${data.emails_sent ?? 0} emails sent`,
      });
    },
    onError: (e) => toast({ title: "Check failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Stale Contact Reminder Settings
          </DialogTitle>
        </DialogHeader>

        {isLoading && !loaded ? (
          <div className="py-6 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="days-threshold">Days without interaction before alert</Label>
              <Input
                id="days-threshold"
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full"
              />
              <p className="text-[11px] text-gray-400">
                Contacts with no recorded interaction in the last {days || 30} days will be flagged and emailed to you.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
              <div>
                <div className="text-sm font-medium text-gray-700">Daily automated check</div>
                <div className="text-[11px] text-gray-400">Runs every day to flag stale contacts</div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="schedule-time">Daily check time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full"
              />
            </div>

            {settings?.last_run_at && (
              <div className="text-[11px] text-gray-400">
                Last run: {new Date(settings.last_run_at).toLocaleString()} · {settings.last_alert_count ?? 0} alerts
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isPending}
            className="gap-1.5"
          >
            <RotateCw className={`w-3.5 h-3.5 ${runNowMutation.isPending ? "animate-spin" : ""}`} />
            Run check now
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1.5">
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}