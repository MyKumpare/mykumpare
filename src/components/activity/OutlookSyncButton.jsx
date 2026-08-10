import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { RefreshCw, CalendarPlus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function OutlookSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await base44.functions.invoke("syncActivitiesToOutlook", { timezone });
      const data = res.data;

      if (data.notConnected) {
        toast({
          title: "Outlook Calendar not connected",
          description:
            "Please authorize the Calendars.ReadWrite permission in Settings → Integrations, then try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Synced to Outlook Calendar",
          description: `${data.synced} event${data.synced === 1 ? "" : "s"} created, ${data.skipped} already synced${
            data.errorCount ? `, ${data.errorCount} error${data.errorCount === 1 ? "" : "s"}` : ""
          }.`,
        });
      }
    } catch (error) {
      toast({
        title: "Sync failed",
        description: error.message || "Could not sync to Outlook Calendar.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={syncing}
      className="gap-2 bg-white"
    >
      {syncing ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        <CalendarPlus className="w-4 h-4" />
      )}
      {syncing ? "Syncing..." : "Sync to Outlook"}
    </Button>
  );
}