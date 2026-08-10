import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CONNECTOR_ID = "6a7a0a0053ff7a2369c7c5d4";

export default function ExportToGoogleSheetButton() {
  const [exporting, setExporting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const runExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke("exportActivitiesToGoogleSheet", {});
      const data = res.data;

      if (data.notConnected) {
        // Need to connect Google Sheets first
        await handleConnect();
        return;
      }

      if (data.error) {
        toast({
          title: "Export failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setResult(data);
      toast({
        title: "Export complete",
        description: `${data.activityCount} activities and ${data.taskCount} tasks exported to Google Sheets.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error.message || "Could not export to Google Sheets.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
      const popup = window.open(url, "_blank");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setConnecting(false);
          // Retry export after connecting
          runExport();
        }
      }, 500);
    } catch (error) {
      setConnecting(false);
      toast({
        title: "Connection failed",
        description: error.message || "Could not connect to Google Sheets.",
        variant: "destructive",
      });
    }
  };

  if (result) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(result.spreadsheetUrl, "_blank")}
          className="gap-1.5 bg-white"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Sheet
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setResult(null);
            runExport();
          }}
          disabled={exporting}
          className="gap-1.5 bg-white"
        >
          {exporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-3.5 h-3.5" />
          )}
          Export Again
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={runExport}
      disabled={exporting || connecting}
      className="gap-1.5 bg-white"
    >
      {exporting || connecting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-3.5 h-3.5" />
      )}
      {connecting ? "Connecting..." : exporting ? "Exporting..." : "Export to Sheet"}
    </Button>
  );
}