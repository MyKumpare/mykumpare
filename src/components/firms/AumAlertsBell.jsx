import React, { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Bell, TrendingDown, TrendingUp, Check, X, Loader2, Building } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const fmtCurrency = (n) => {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
};

/**
 * AumAlertsBell — a notification bell for the header that shows a badge with
 * the count of active FirmAumAlert records. Clicking opens a dropdown listing
 * each active alert with the firm name, AUM value, threshold, and type
 * (below_min / above_max). Users can acknowledge or resolve alerts inline, and
 * click an alert to navigate to the firm profile.
 *
 * Props:
 *  - onFirmClick: (firmId) => void — opens the firm profile when an alert is clicked
 */
export default function AumAlertsBell({ onFirmClick }) {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["aum-alerts-active"],
    queryFn: () => base44.entities.FirmAumAlert.filter({ status: "active" }, "-created_date", 100),
    refetchInterval: 60000, // refresh every 60s so new alerts appear promptly
  });

  const activeCount = alerts.length;

  const acknowledgeMutation = useMutation({
    mutationFn: (id) =>
      base44.entities.FirmAumAlert.update(id, { status: "acknowledged", acknowledged_at: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["aum-alerts-active"] }),
    onError: (e) => toast({ title: "Failed to acknowledge", description: e?.message, variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id) =>
      base44.entities.FirmAumAlert.update(id, { status: "resolved", resolved_at: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["aum-alerts-active"] }),
    onError: (e) => toast({ title: "Failed to resolve", description: e?.message, variant: "destructive" }),
  });

  const sortedAlerts = useMemo(
    () => [...alerts].sort((a, b) => {
      const da = a.month_end_date || "";
      const db = b.month_end_date || "";
      return db.localeCompare(da);
    }),
    [alerts]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title="AUM Alerts"
          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-white/15 transition-colors group relative"
        >
          <div className="relative">
            <Bell className="w-4 h-4 text-white/80 group-hover:text-white" />
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold px-0.5 border border-white">
                {activeCount > 9 ? "9+" : activeCount}
              </span>
            )}
          </div>
          <span className="text-[9px] text-white/70 group-hover:text-white font-medium leading-none hidden xl:block">Alerts</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
        <div className="px-3 py-2 flex items-center gap-2 border-b">
          <Bell className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-800">AUM Alerts</span>
          {activeCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
              {activeCount} active
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
          </div>
        ) : sortedAlerts.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Check className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No active AUM alerts.</p>
            <p className="text-xs text-gray-400 mt-1">All firms are within their thresholds.</p>
          </div>
        ) : (
          <>
            {sortedAlerts.map((a) => {
              const isBelow = (a.alert_type || "below_min") === "below_min";
              return (
                <div key={a.id} className="border-b last:border-b-0">
                  <div className="px-3 py-2.5 hover:bg-gray-50">
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isBelow ? "bg-red-100" : "bg-amber-100"
                        }`}
                      >
                        {isBelow ? (
                          <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                        ) : (
                          <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-800 truncate">{a.firm_name || "Unknown firm"}</span>
                          <span
                            className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                              isBelow
                                ? "bg-red-50 text-red-600 border border-red-100"
                                : "bg-amber-50 text-amber-600 border border-amber-100"
                            }`}
                          >
                            {isBelow ? "Below min" : "Above max"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          AUM: <span className="font-semibold text-gray-700">{fmtCurrency(a.aum_value)}</span>
                          {" · "}
                          {isBelow ? "below" : "exceeds"} {fmtCurrency(a.threshold)}
                        </div>
                        {a.month_end_date && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {format(parseISO(a.month_end_date), "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {onFirmClick && (
                        <button
                          onClick={() => onFirmClick(a.firm_id)}
                          className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
                        >
                          <Building className="w-3 h-3" /> View Firm
                        </button>
                      )}
                      <button
                        onClick={() => acknowledgeMutation.mutate(a.id)}
                        disabled={acknowledgeMutation.isPending}
                        className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                        title="Acknowledge"
                      >
                        <Check className="w-3 h-3" /> Acknowledge
                      </button>
                      <button
                        onClick={() => resolveMutation.mutate(a.id)}
                        disabled={resolveMutation.isPending}
                        className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-emerald-600 px-2 py-1 rounded hover:bg-emerald-50"
                        title="Mark resolved"
                      >
                        <X className="w-3 h-3" /> Resolve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}