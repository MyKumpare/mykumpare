import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Search, Lock, Building2, BarChart2, LayoutList } from "lucide-react";

const formatPeriodMDY = (ymStr) => {
  if (!ymStr) return "";
  const [year, month] = ymStr.split("-");
  return `${month}/01/${year}`;
};

export default function ExistingAnalysesDialog({ open, onOpenChange, onSelect }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ["analyses"],
    queryFn: () => base44.entities.Analysis.list("-created_date"),
    enabled: open,
  });

  const visible = analyses.filter((a) => {
    if (a.visibility === "personal" && a.created_by_id !== user?.id) return false;
    const q = search.toLowerCase();
    return !q || a.name.toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-800">Existing Analyses</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search analyses…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No analyses found.</p>
        ) : (
          <div className="space-y-2">
            {visible.map((a) => (
              <button
                key={a.id}
                onClick={() => { onSelect(a); onOpenChange(false); }}
                className="w-full text-left p-3 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {a.analysis_type === "single"
                    ? <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                    : <LayoutList className="w-3.5 h-3.5 text-violet-500" />}
                  <span className="text-sm font-semibold text-gray-800">{a.name}</span>
                  <span className="ml-auto">
                    {a.visibility === "personal"
                      ? <Lock className="w-3 h-3 text-gray-400" />
                      : <Building2 className="w-3 h-3 text-gray-400" />}
                  </span>
                </div>
                <p className="text-xs text-gray-500 pl-5">
                  {a.analysis_type === "single" ? "Single product" : `${(a.product_configs ?? []).length} products`}
                  {" · "}
                  {a.period_start && a.period_end ? `${formatPeriodMDY(a.period_start)} → ${formatPeriodMDY(a.period_end)}` : "All periods"}
                </p>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}