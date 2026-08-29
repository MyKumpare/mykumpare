import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  AlertOctagon, Clock, ArrowRight, CheckCircle2, Bell,
} from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

/**
 * Stalled DD Alerts Indicator — dashboard module that flags due diligence
 * processes stalled in the same stage for over 6 months. Pulls from the
 * StalledDdAlert entity (raised by the weekly checkStalledDdProcesses workflow).
 *
 * Shows a count badge, a list of stalled processes with days-in-stage, and
 * acknowledge / resolve actions.
 */
export default function StalledDdAlertsIndicator() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["stalled-dd-alerts"],
    queryFn: () => base44.entities.StalledDdAlert.list("-created_date", 200),
  });

  const activeAlerts = useMemo(() => {
    return alerts
      .filter((a) => a.status === "active" || a.status === "acknowledged")
      .sort((a, b) => (b.days_in_stage || 0) - (a.days_in_stage || 0));
  }, [alerts]);

  const display = showAll ? activeAlerts : activeAlerts.slice(0, 5);

  const handleAcknowledge = async (alertId) => {
    await base44.entities.StalledDdAlert.update(alertId, {
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ["stalled-dd-alerts"] });
  };

  const handleResolve = async (alertId) => {
    await base44.entities.StalledDdAlert.update(alertId, {
      status: "resolved",
      resolved_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ["stalled-dd-alerts"] });
  };

  const count = activeAlerts.length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="relative">
          <AlertOctagon className="w-5 h-5 text-red-500" />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {count}
            </span>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Stalled Due Diligence Alerts</h2>
          <p className="text-xs text-gray-400">In the same stage for 6+ months</p>
        </div>
        {count > 0 && (
          <span className="ml-auto text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2.5 py-0.5">
            {count} stalled
          </span>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-gray-200 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : count === 0 ? (
        <div className="py-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No stalled processes</p>
          <p className="text-xs text-gray-400 mt-1">
            All due diligence processes are progressing within 6 months per stage.
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {display.map((a) => {
              const monthsInStage = Math.floor((a.days_in_stage || 0) / 30);
              return (
                <div key={a.id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.firm_name || "Unknown"}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {a.product_name || "—"} · {a.template_name || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5 shrink-0 bg-red-100 text-red-700">
                      <Clock className="w-3 h-3" />
                      {monthsInStage}mo
                    </div>
                  </div>
                  {/* Stage info */}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                    <span className="font-medium text-gray-600">Stage:</span>
                    <span className="truncate">{a.stage_name || "—"}</span>
                    {a.stage_start_date && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span>since {format(parseISO(a.stage_start_date), "MMM d, yyyy")}</span>
                      </>
                    )}
                  </div>
                  {/* Analyst + notification */}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400">{a.primary_analyst_name || "—"}</span>
                      {a.notification_sent && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600">
                          <Bell className="w-2.5 h-2.5" /> Notified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {a.status === "active" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-gray-500 hover:text-gray-700 px-1.5"
                          onClick={() => handleAcknowledge(a.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700 px-1.5"
                        onClick={() => handleResolve(a.id)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {activeAlerts.length > 5 && (
            <div className="px-5 py-2 border-t border-gray-100 text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-indigo-600 hover:text-indigo-700"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show less" : `View all (${activeAlerts.length})`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}