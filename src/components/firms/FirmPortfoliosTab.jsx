import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import AddPortfolioDialog from "@/components/portfolios/AddPortfolioDialog";

export default function FirmPortfoliosTab({
  firmId,
  firmName,
  onPortfolioClick,
  // advisorMode: show portfolios where this firm is the advisor (MoM or IM)
  advisorMode = false,
  advisorType = null,
}) {
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState(null);

  const { data: portfolios = [] } = useQuery({
    queryKey: advisorMode ? ["portfolios-advisor", firmId] : ["portfolios", firmId],
    queryFn: () =>
      advisorMode
        ? base44.entities.Portfolio.filter({ advisor_firm_id: firmId })
        : base44.entities.Portfolio.filter({ firm_id: firmId }),
  });

  // Sort ascending by portfolio name
  const sorted = [...portfolios].sort((a, b) =>
    (a.portfolio_name || "").localeCompare(b.portfolio_name || "")
  );

  const handleAddClick = () => {
    setEditingPortfolio(null);
    setPortfolioDialogOpen(true);
  };

  const handlePortfolioClick = (p) => {
    if (onPortfolioClick) {
      onPortfolioClick(p);
    } else {
      setEditingPortfolio(p);
      setPortfolioDialogOpen(true);
    }
  };

  // Build the preselected data for advisor mode
  const preselectedAdvisorFirmId = advisorMode ? firmId : undefined;
  const preselectedAdvisorType = advisorMode ? advisorType : undefined;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={handleAddClick}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Portfolio
        </Button>
      </div>

      {sorted.length === 0 && (
        <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
          No portfolios found
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
            onClick={() => handlePortfolioClick(p)}
          >
            <div>
              <p className="text-sm font-medium text-gray-800">{p.portfolio_name}</p>
              <p className="text-xs text-gray-500">
                {advisorMode && p.allocator_name ? `${p.allocator_name} · ` : ""}
                Inception: {p.inception_date ? format(parseISO(p.inception_date), "MMM d, yyyy") : "—"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <AddPortfolioDialog
        open={portfolioDialogOpen}
        onOpenChange={setPortfolioDialogOpen}
        editingPortfolio={editingPortfolio}
        preselectedAllocatorId={!advisorMode ? firmId : undefined}
        preselectedAdvisorFirmId={preselectedAdvisorFirmId}
        preselectedAdvisorType={preselectedAdvisorType}
        onSuccess={() => {
          setPortfolioDialogOpen(false);
          setEditingPortfolio(null);
        }}
      />
    </div>
  );
}