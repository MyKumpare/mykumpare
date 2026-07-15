import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Linkedin, Loader2, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

const CONNECTOR_ID = "6a57a54557aaca4950831c3f";

export default function LinkedInConnectionButton({ compact = false }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const checkConnection = useCallback(async () => {
    try {
      await base44.functions.invoke("linkedinContactLookup", {
        first_name: "__connection_check__",
        last_name: "__connection_check__",
      });
      // If we get here without a 403 needs_connection error, the user is connected
      setConnected(true);
    } catch (err) {
      const errData = err?.response?.data || {};
      if (errData.needs_connection) {
        setConnected(false);
      } else {
        // Any other error (validation, etc.) means the function ran = user is connected
        setConnected(true);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    base44.auth.isAuthenticated().then((authed) => {
      if (authed) {
        checkConnection();
      } else {
        setLoading(false);
      }
    });
  }, [checkConnection]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
      const popup = window.open(url, "_blank");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          checkConnection();
          setConnecting(false);
        }
      }, 500);
    } catch (err) {
      toast({ title: "Connection failed", description: err.message || "Could not start LinkedIn connection.", variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await base44.connectors.disconnectAppUser(CONNECTOR_ID);
      setConnected(false);
      toast({ title: "LinkedIn disconnected" });
    } catch (err) {
      toast({ title: "Disconnect failed", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    );
  }

  if (connected) {
    if (compact) {
      return (
        <span className="flex items-center gap-1 text-xs text-[#0A66C2] font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          LinkedIn connected
        </span>
      );
    }
    return (
      <Button variant="outline" size="sm" className="text-xs gap-1 border-[#0A66C2]/30 text-[#0A66C2] hover:bg-[#0A66C2]/10" onClick={handleDisconnect}>
        <Linkedin className="w-3.5 h-3.5" />
        Disconnect LinkedIn
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={`text-xs gap-1 border-[#0A66C2]/30 text-[#0A66C2] hover:bg-[#0A66C2]/10 ${compact ? "h-6 px-2" : ""}`}
      onClick={handleConnect}
      disabled={connecting}
    >
      {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Linkedin className="w-3.5 h-3.5" />}
      Connect LinkedIn
    </Button>
  );
}