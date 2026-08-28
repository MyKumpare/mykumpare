import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, X, TrendingDown, Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

/**
 * Dialog to configure per-firm scoring thresholds. Lists the user's firms,
 * shows existing thresholds inline (editable), and lets the user add/remove
 * a threshold for any firm. One ScoringThresholdSetting per firm.
 */
export default function ScoringThresholdManager({ linkedFirmId, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-name", 500),
  });

  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["scoringThresholdSettings"],
    queryFn: () => base44.entities.ScoringThresholdSetting.list("-created_date", 500),
  });

  const settingsByFirmId = useMemo(() => {
    const map = new Map();
    for (const s of settings) map.set(s.firm_id, s);
    return map;
  }, [settings]);

  const visibleFirms = useMemo(() => {
    const filtered = (firms || []).filter((f) => !f.deleted_at);
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((f) => (f.name || "").toLowerCase().includes(q));
  }, [firms, search]);

  const createMutation = useMutation({
    mutationFn: ({ firmId, firmName, threshold }) =>
      base44.entities.ScoringThresholdSetting.create({
        tenant_id: linkedFirmId,
        firm_id: firmId,
        firm_name: firmName,
        threshold: Number(threshold),
        enabled: true,
      }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scoringThresholdSettings"] }); toast({ title: "Threshold set" }); },
    onError: (e) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScoringThresholdSetting.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scoringThresholdSettings"] }),
    onError: (e) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoringThresholdSetting.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scoringThresholdSettings"] }); toast({ title: "Threshold removed" }); },
  });

  const handleThresholdChange = (firm, value) => {
    const existing = settingsByFirmId.get(firm.id);
    const numVal = value === "" ? "" : Math.max(0, Math.min(5, Number(value)));
    if (!existing) {
      if (numVal === "" || numVal == null) return;
      createMutation.mutate({ firmId: firm.id, firmName: firm.name, threshold: numVal });
    } else {
      if (numVal === "" || numVal == null) {
        deleteMutation.mutate(existing.id);
      } else {
        updateMutation.mutate({ id: existing.id, data: { threshold: numVal } });
      }
    }
  };

  const toggleEnabled = (firm) => {
    const existing = settingsByFirmId.get(firm.id);
    if (!existing) return;
    updateMutation.mutate({ id: existing.id, data: { enabled: !existing.enabled } });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-indigo-600" />
            Manage Per-Firm Scoring Thresholds
          </DialogTitle>
          <p className="text-xs text-gray-500 font-normal">
            Set a minimum weighted final score (1-5) for each firm. When a finalized scoring matrix falls below it, an alert appears on the Overview Dashboard.
          </p>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search firms..."
            className="pl-9 pr-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {firmsLoading || settingsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : visibleFirms.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">No firms found.</div>
          ) : (
            visibleFirms.map((firm) => {
              const setting = settingsByFirmId.get(firm.id);
              return (
                <div key={firm.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{firm.name}</div>
                    {setting && (
                      <div className="text-[10px] text-gray-400">
                        {setting.enabled ? "Active" : "Disabled"} · alert when below {setting.threshold}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={setting ? setting.threshold : ""}
                      onChange={(e) => handleThresholdChange(firm, e.target.value)}
                      placeholder="—"
                      className="w-20 h-8 text-center text-sm"
                    />
                    {setting && (
                      <>
                        <Switch checked={setting.enabled} onCheckedChange={() => toggleEnabled(firm)} />
                        <button
                          onClick={() => deleteMutation.mutate(setting.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                          title="Remove threshold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}