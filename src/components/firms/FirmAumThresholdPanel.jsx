import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Check, X, Loader2, TrendingDown, TrendingUp, RefreshCw, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "@/components/ui/use-toast";

const fmtCurrency = (n) => {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
};

/**
 * Panel shown on the firm profile (AUM Alerts tab) that lets the user set a
 * per-firm AUM threshold, toggle it on/off, view active alerts for this firm,
 * and run a manual check. Mirrors the scoring threshold pattern.
 */
export default function FirmAumThresholdPanel({ firmId, firmName }) {
  const queryClient = useQueryClient();
  const [draftThreshold, setDraftThreshold] = useState("");
  const [draftMaxThreshold, setDraftMaxThreshold] = useState("");

  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["firmAumThreshold", firmId],
    queryFn: () => base44.entities.FirmAumThreshold.filter({ firm_id: firmId }, "-created_date", 10),
    enabled: !!firmId,
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["firmAumAlerts", firmId],
    queryFn: () => base44.entities.FirmAumAlert.filter({ firm_id: firmId, status: "active" }, "-created_date", 50),
    enabled: !!firmId,
  });

  const setting = settings[0];

  // Sync draft inputs with the saved setting when it loads/changes.
  React.useEffect(() => {
    if (setting) { setDraftThreshold(""); setDraftMaxThreshold(""); }
  }, [setting?.id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["firmAumThreshold", firmId] });
    queryClient.invalidateQueries({ queryKey: ["firmAumAlerts", firmId] });
  };

  const createMutation = useMutation({
    mutationFn: ({ threshold, max_threshold }) => {
      const data = { firm_id: firmId, firm_name: firmName, enabled: true };
      if (threshold != null && !isNaN(threshold)) data.threshold = threshold;
      if (max_threshold != null && !isNaN(max_threshold)) data.max_threshold = max_threshold;
      return base44.entities.FirmAumThreshold.create(data);
    },
    onSuccess: () => { invalidate(); toast({ title: "AUM threshold set" }); setDraftThreshold(""); setDraftMaxThreshold(""); },
    onError: (e) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FirmAumThreshold.update(id, data),
    onSuccess: () => { invalidate(); toast({ title: "Threshold updated" }); },
    onError: (e) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FirmAumThreshold.delete(id),
    onSuccess: () => { invalidate(); toast({ title: "Threshold removed" }); },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id) => base44.entities.FirmAumAlert.update(id, { status: "acknowledged", acknowledged_at: new Date().toISOString() }),
    onSuccess: () => { invalidate(); toast({ title: "Alert acknowledged" }); },
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => base44.entities.FirmAumAlert.update(id, { status: "resolved", resolved_at: new Date().toISOString() }),
    onSuccess: () => { invalidate(); toast({ title: "Alert resolved" }); },
  });

  const runCheckMutation = useMutation({
    mutationFn: () => base44.functions.invoke("checkFirmAumThresholds", { firm_id: firmId }),
    onSuccess: (res) => {
      invalidate();
      const data = res?.data || res;
      toast({ title: "Threshold check complete", description: `${data?.raised || 0} new alert(s) raised.` });
    },
    onError: (err) => toast({ title: "Check failed", description: err?.message, variant: "destructive" }),
  });

  const handleSaveThreshold = () => {
    const val = draftThreshold === "" ? null : Number(draftThreshold);
    const maxVal = draftMaxThreshold === "" ? null : Number(draftMaxThreshold);

    // At least one threshold must be set
    if ((val == null || isNaN(val) || val < 0) && (maxVal == null || isNaN(maxVal) || maxVal < 0)) {
      toast({ title: "Enter at least one threshold", description: "Set a minimum, maximum, or both.", variant: "destructive" });
      return;
    }
    // If both are set, min must be less than max
    if (val != null && maxVal != null && !isNaN(val) && !isNaN(maxVal) && val >= maxVal) {
      toast({ title: "Min must be below max", description: "The minimum threshold must be less than the maximum.", variant: "destructive" });
      return;
    }

    const data = {};
    if (val != null && !isNaN(val) && val >= 0) data.threshold = val;
    if (maxVal != null && !isNaN(maxVal) && maxVal >= 0) data.max_threshold = maxVal;

    if (setting) {
      updateMutation.mutate({ id: setting.id, data });
    } else {
      createMutation.mutate({ threshold: val, max_threshold: maxVal });
    }
  };

  const handleToggleEnabled = () => {
    if (!setting) return;
    updateMutation.mutate({ id: setting.id, data: { enabled: !setting.enabled } });
  };

  const handleRemove = () => {
    if (!setting) return;
    if (window.confirm("Remove the AUM threshold for this firm?")) {
      deleteMutation.mutate(setting.id);
    }
  };

  const sortedAlerts = useMemo(
    () => [...alerts].sort((a, b) => {
      const da = a.month_end_date || "";
      const db = b.month_end_date || "";
      return db.localeCompare(da);
    }),
    [alerts]
  );

  if (!firmId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
        Save the firm first to configure AUM alerts
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Threshold configuration card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">AUM Threshold Alert</h3>
            <p className="text-xs text-gray-500">Get notified when this firm's AUM drops below or exceeds a level you set.</p>
          </div>
        </div>

        {settingsLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
        ) : (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[160px] space-y-1">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-500" /> Min (below)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  type="number"
                  min="0"
                  step="1000000"
                  value={draftThreshold !== "" ? draftThreshold : (setting ? (setting.threshold ?? "") : "")}
                  onChange={(e) => setDraftThreshold(e.target.value)}
                  placeholder={setting && setting.threshold != null ? fmtCurrency(setting.threshold) : "e.g. 500000000"}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[160px] space-y-1">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-amber-500" /> Max (exceeds)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  type="number"
                  min="0"
                  step="1000000"
                  value={draftMaxThreshold !== "" ? draftMaxThreshold : (setting ? (setting.max_threshold ?? "") : "")}
                  onChange={(e) => setDraftMaxThreshold(e.target.value)}
                  placeholder={setting && setting.max_threshold != null ? fmtCurrency(setting.max_threshold) : "e.g. 2000000000"}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="h-9"
              onClick={handleSaveThreshold}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {setting ? "Update" : "Set Threshold"}
            </Button>
            {setting && (
              <>
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200">
                  <Switch checked={setting.enabled} onCheckedChange={handleToggleEnabled} />
                  <span className="text-xs text-gray-600">{setting.enabled ? "Active" : "Paused"}</span>
                </div>
                <button
                  onClick={handleRemove}
                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-200"
                  title="Remove threshold"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}

        {setting && (
          <div className="mt-2 text-xs text-gray-400">
            {setting.threshold != null && setting.max_threshold != null ? (
              <>Alert triggers when AUM falls below {fmtCurrency(setting.threshold)} or exceeds {fmtCurrency(setting.max_threshold)}.</>
            ) : setting.threshold != null ? (
              <>Alert triggers when the latest month-end AUM falls below {fmtCurrency(setting.threshold)}.</>
            ) : setting.max_threshold != null ? (
              <>Alert triggers when the latest month-end AUM exceeds {fmtCurrency(setting.max_threshold)}.</>
            ) : null}
          </div>
        )}
      </div>

      {/* Active alerts */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${sortedAlerts.length > 0 ? "text-red-600" : "text-gray-400"}`} />
            <h3 className="text-sm font-semibold text-gray-800">Active Alerts</h3>
            {sortedAlerts.length > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">{sortedAlerts.length}</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => runCheckMutation.mutate()}
            disabled={runCheckMutation.isPending || !setting}
            title={!setting ? "Set a threshold first" : "Check this firm's latest AUM now"}
          >
            {runCheckMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Run Check
          </Button>
        </div>

        {alertsLoading ? (
          <div className="h-20 flex items-center justify-center text-gray-400 text-sm"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : sortedAlerts.length === 0 ? (
          <div className="h-20 flex items-center justify-center text-gray-400 text-sm">
            <div className="text-center">
              <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              {setting ? "No active alerts — AUM is above threshold." : "No alerts yet. Set a threshold to start monitoring."}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedAlerts.map((a) => {
              const isBelow = (a.alert_type || "below_min") === "below_min";
              return (
                <div key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isBelow ? "border-red-100 bg-red-50/40" : "border-amber-100 bg-amber-50/40"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isBelow ? "bg-red-100" : "bg-amber-100"}`}>
                    {isBelow ? <TrendingDown className="w-4 h-4 text-red-600" /> : <TrendingUp className="w-4 h-4 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{fmtCurrency(a.aum_value)}</div>
                    <div className="text-xs text-gray-500">
                      {isBelow ? "below" : "exceeds"} {fmtCurrency(a.threshold)}
                      {a.month_end_date && <> · {format(parseISO(a.month_end_date), "MMM d, yyyy")}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => acknowledgeMutation.mutate(a.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Acknowledge">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => resolveMutation.mutate(a.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-emerald-600" title="Mark resolved">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}