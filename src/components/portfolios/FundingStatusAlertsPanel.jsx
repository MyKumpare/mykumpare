import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, X, Loader2, RefreshCw, TrendingUp, TrendingDown, Building2, Package } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "@/components/ui/use-toast";

const STATUS_COLORS = {
  Funded: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Terminated: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_ICONS = {
  Funded: TrendingUp,
  Terminated: TrendingDown,
};

function describeTransition(prev, next) {
  if (!prev && next) return `Funding status set to "${next}"`;
  if (prev && !next) return `Funding status cleared (was "${prev}")`;
  if (prev && next && prev !== next) return `Funding status changed from "${prev}" to "${next}"`;
  return `Funding status updated`;
}

/**
 * Panel listing active FundingStatusAlert records — firms and products whose
 * funding status changed (Funded ↔ Terminated, or started/cleared). Lets the
 * user acknowledge and resolve alerts, and filter by entity type.
 */
export default function FundingStatusAlertsPanel() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all"); // "all" | "Product" | "Firm"

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["fundingStatusAlerts"],
    queryFn: () => base44.entities.FundingStatusAlert.filter({ status: "active" }, "-created_date", 200),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fundingStatusAlerts"] });

  const acknowledgeMutation = useMutation({
    mutationFn: (id) => base44.entities.FundingStatusAlert.update(id, { status: "acknowledged", acknowledged_at: new Date().toISOString() }),
    onSuccess: () => { invalidate(); toast({ title: "Alert acknowledged" }); },
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => base44.entities.FundingStatusAlert.update(id, { status: "resolved", resolved_at: new Date().toISOString() }),
    onSuccess: () => { invalidate(); toast({ title: "Alert resolved" }); },
  });

  const filtered = useMemo(() => {
    if (filter === "all") return alerts;
    return alerts.filter((a) => a.entity_type === filter);
  }, [alerts, filter]);

  const productCount = alerts.filter((a) => a.entity_type === "Product").length;
  const firmCount = alerts.filter((a) => a.entity_type === "Firm").length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-600" />
          <h2 className="text-sm font-semibold text-gray-800">Funding Status Change Alerts</h2>
          {filtered.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{filtered.length} active</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {[
              { key: "all", label: "All", count: alerts.length },
              { key: "Product", label: "Products", count: productCount },
              { key: "Firm", label: "Firms", count: firmCount },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  filter === f.key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f.label} {f.count > 0 && `(${f.count})`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => invalidate()} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-24 flex items-center justify-center text-gray-400 text-sm"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
          <div className="text-center">
            <Check className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
            No active funding status alerts.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const NewIcon = STATUS_ICONS[a.new_status] || Bell;
            const isProduct = a.entity_type === "Product";
            const EntityIcon = isProduct ? Package : Building2;
            return (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-amber-100 bg-amber-50/40 hover:bg-amber-50/70 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <NewIcon className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <EntityIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-sm font-semibold text-gray-800 truncate">{a.entity_name}</span>
                    {a.product_name && a.firm_name && (
                      <span className="text-xs text-gray-500 truncate">· {a.firm_name}</span>
                    )}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[a.new_status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {a.new_status || "Cleared"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-500">
                    <span>{describeTransition(a.previous_status, a.new_status)}</span>
                    {a.source === "manual" && <span className="text-indigo-500">· manual</span>}
                    {a.changed_by_name && <span className="text-gray-400">· by {a.changed_by_name}</span>}
                    <span className="text-gray-400">· {format(parseISO(a.created_date), "MMM d, yyyy h:mm a")}</span>
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
  );
}