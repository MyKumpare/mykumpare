import React, { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, X, Loader2, RefreshCw, Scale } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const fmtCurrency = (n) => {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
};

const fmtSigned = (n) => {
  if (n == null || isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + fmtCurrency(n);
};

/**
 * Panel that displays portfolio reconciliation alerts — portfolios where the
 * sum of sub-manager allocations does not match the parent investment
 * manager's (advisor) total. Users can acknowledge or resolve alerts, and
 * run an on-demand check across all portfolios.
 */
export default function PortfolioReconciliationAlertsPanel({ portfolioId }) {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["portfolioReconciliationAlerts", portfolioId || "all"],
    queryFn: () =>
      portfolioId
        ? base44.entities.PortfolioReconciliationAlert.filter(
            { portfolio_id: portfolioId, status: "active" },
            "-created_date",
            50
          )
        : base44.entities.PortfolioReconciliationAlert.filter(
            { status: "active" },
            "-created_date",
            100
          ),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["portfolioReconciliationAlerts"] });
  };

  const acknowledgeMutation = useMutation({
    mutationFn: (id) =>
      base44.entities.PortfolioReconciliationAlert.update(id, {
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Alert acknowledged" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id) =>
      base44.entities.PortfolioReconciliationAlert.update(id, {
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Alert resolved" });
    },
  });

  const runCheckMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke("checkPortfolioReconciliationAlerts", portfolioId ? { portfolio_id: portfolioId } : {}),
    onSuccess: (res) => {
      invalidate();
      const data = res?.data || res;
      toast({
        title: "Reconciliation check complete",
        description: `${data?.raised || 0} new alert(s) raised, ${data?.resolved || 0} resolved.`,
      });
    },
    onError: (err) => toast({ title: "Check failed", description: err?.message, variant: "destructive" }),
  });

  const sortedAlerts = useMemo(
    () =>
      [...alerts].sort((a, b) => Math.abs(b.variance || 0) - Math.abs(a.variance || 0)),
    [alerts]
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <Scale className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Reconciliation Alerts</h3>
            <p className="text-xs text-gray-500">
              Portfolios where sub-manager allocations do not match the investment manager total.
            </p>
          </div>
          {sortedAlerts.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
              {sortedAlerts.length}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => runCheckMutation.mutate()}
          disabled={runCheckMutation.isPending}
        >
          {runCheckMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Run Check
        </Button>
      </div>

      {isLoading ? (
        <div className="h-20 flex items-center justify-center text-gray-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : sortedAlerts.length === 0 ? (
        <div className="h-20 flex items-center justify-center text-gray-400 text-sm">
          <div className="text-center">
            <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            All multi-manager portfolios are in balance.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedAlerts.map((a) => {
            const underAllocated = (a.variance || 0) > 0;
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-amber-100 bg-amber-50/40"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">
                    {a.portfolio_name || "Untitled Portfolio"}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {a.advisor_firm_name ? `IM: ${a.advisor_firm_name} · ` : ""}
                    {a.sub_manager_count || 0} sub-manager{(a.sub_manager_count || 0) !== 1 ? "s" : ""}
                  </div>
                  <div className="text-xs mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="text-gray-600">IM: <span className="font-medium">{fmtCurrency(a.advisor_total)}</span></span>
                    <span className="text-gray-600">Sub-Mgrs: <span className="font-medium">{fmtCurrency(a.sub_manager_total)}</span></span>
                    <span className={`font-medium ${underAllocated ? "text-amber-700" : "text-red-700"}`}>
                      Variance: {fmtSigned(a.variance)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => acknowledgeMutation.mutate(a.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    title="Acknowledge"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => resolveMutation.mutate(a.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-emerald-600"
                    title="Mark resolved"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}