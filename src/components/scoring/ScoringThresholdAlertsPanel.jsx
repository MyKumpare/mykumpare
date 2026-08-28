import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, X, Loader2, TrendingDown, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import ScoringThresholdManager from "./ScoringThresholdManager";

/**
 * Panel shown on the OverviewDashboard listing active ScoringThresholdAlert
 * records — firms whose finalized scoring matrix weighted final score fell
 * below their configured per-firm threshold. Lets the user acknowledge, resolve,
 * and run a manual check, plus manage per-firm thresholds.
 */
export default function ScoringThresholdAlertsPanel({ linkedFirmId }) {
  const queryClient = useQueryClient();
  const [showManager, setShowManager] = useState(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["scoringThresholdAlerts"],
    queryFn: () => base44.entities.ScoringThresholdAlert.filter({ status: "active" }, "-created_date", 200),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["scoringThresholdAlerts"] });

  const acknowledgeMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoringThresholdAlert.update(id, { status: "acknowledged", acknowledged_at: new Date().toISOString() }),
    onSuccess: () => { invalidate(); toast({ title: "Alert acknowledged" }); },
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoringThresholdAlert.update(id, { status: "resolved", resolved_at: new Date().toISOString() }),
    onSuccess: () => { invalidate(); toast({ title: "Alert resolved" }); },
  });

  const runCheckMutation = useMutation({
    mutationFn: () => base44.functions.invoke("checkScoringThresholds", {}),
    onSuccess: (res) => {
      invalidate();
      const data = res?.data || res;
      toast({ title: "Threshold check complete", description: `${data?.raised || 0} new alert(s) raised.` });
    },
    onError: (err) => toast({ title: "Check failed", description: err?.message, variant: "destructive" }),
  });

  const sorted = useMemo(
    () => [...alerts].sort((a, b) => (a.weighted_final_score - a.threshold) - (b.weighted_final_score - b.threshold)),
    [alerts]
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-red-200 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h2 className="text-sm font-semibold text-gray-800">Below-Threshold Scoring Alerts</h2>
          {sorted.length > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">{sorted.length} active</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => runCheckMutation.mutate()} disabled={runCheckMutation.isPending}>
            {runCheckMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Run Check
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => setShowManager(true)}>
            <TrendingDown className="w-3.5 h-3.5" />
            Manage Thresholds
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-24 flex items-center justify-center text-gray-400 text-sm"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : sorted.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
          <div className="text-center">
            <Check className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
            No firms are currently below their scoring threshold.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((a) => {
            const thresholdStr = typeof a.threshold === "number" ? a.threshold.toFixed(2) : String(a.threshold);
            return (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-red-100 bg-red-50/40 hover:bg-red-50/70 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800 truncate">{a.firm_name}</span>
                    <span className="text-xs text-gray-500 truncate">· {a.product_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-500">
                    <span className="text-gray-400">{a.template_name} · v{a.version_number}</span>
                    {a.scoring_end_date && (
                      <span className="text-gray-400">· {format(parseISO(a.scoring_end_date), "MMM d, yyyy")}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-red-600">{a.weighted_final_score.toFixed(2)}</div>
                  <div className="text-[10px] text-gray-400">threshold {thresholdStr}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => acknowledgeMutation.mutate(a.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Acknowledge">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => resolveMutation.mutate(a.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-emerald-600" title="Mark resolved (re-evaluated)">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showManager && <ScoringThresholdManager linkedFirmId={linkedFirmId} onClose={() => setShowManager(false)} />}
    </div>
  );
}