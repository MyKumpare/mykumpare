import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { Plus, Search, LayoutList } from "lucide-react";
import AddPortfolioDialog from "@/components/portfolios/AddPortfolioDialog";

const ADVISOR_TYPE_FILTERS = ["All", "Manager of Managers", "Investment Manager", "None"];

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
  const [search, setSearch] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("All");

  const { data: portfolios = [] } = useQuery({
    queryKey: advisorMode ? ["portfolios-advisor", firmId] : ["portfolios", firmId],
    queryFn: () =>
      advisorMode
        ? base44.entities.Portfolio.filter({ advisor_firm_id: firmId })
        : base44.entities.Portfolio.filter({ firm_id: firmId }),
  });

  // Filter by search text and advisor type filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return portfolios
      .filter((p) => {
        // Advisor type filter
        if (advisorFilter !== "All") {
          if (advisorFilter === "None") {
            if (p.advisor_type) return false;
          } else if (p.advisor_type !== advisorFilter) return false;
        }
        // Search filter
        if (!q) return true;
        return (
          (p.portfolio_name || "").toLowerCase().includes(q) ||
          (p.allocator_name || "").toLowerCase().includes(q) ||
          (p.advisor_firm_name || "").toLowerCase().includes(q) ||
          (p.advisor_type || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.portfolio_name || "").localeCompare(b.portfolio_name || ""));
  }, [portfolios, search, advisorFilter]);

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
      {/* Search + filter + add button row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search portfolios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <select
          value={advisorFilter}
          onChange={(e) => setAdvisorFilter(e.target.value)}
          className="h-8 text-sm rounded-md border border-input bg-transparent px-2 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {ADVISOR_TYPE_FILTERS.map((t) => (
            <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs whitespace-nowrap"
          onClick={handleAddClick}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Portfolio
        </Button>
      </div>

      {/* Result count */}
      {portfolios.length > 0 && (
        <p className="text-xs text-gray-400">
          {filtered.length} of {portfolios.length} portfolio{portfolios.length !== 1 ? "s" : ""}
        </p>
      )}

      {filtered.length === 0 && (
        <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
          {portfolios.length === 0 ? "No portfolios found" : "No portfolios match your search"}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
            onClick={() => handlePortfolioClick(p)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <LayoutList className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <p className="text-sm font-medium text-gray-800 truncate">{p.portfolio_name}</p>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {advisorMode && p.allocator_name ? `${p.allocator_name} · ` : ""}
                Inception: {p.inception_date ? format(parseISO(p.inception_date), "MMM d, yyyy") : "—"}
                {p.initial_allocation_amount != null && p.initial_allocation_amount !== "" ? ` · $${p.initial_allocation_amount}` : ""}
              </p>
              {p.advisor_type && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.advisor_type === "Manager of Managers" ? "MoM" : "Investment Manager"}
                  {p.advisor_firm_name ? `: ${p.advisor_firm_name}` : ""}
                  {p.advisor_inception_date ? ` (since ${format(parseISO(p.advisor_inception_date), "MMM d, yyyy")})` : ""}
                </p>
              )}
              {(p.primary_benchmark_name || (p.secondary_benchmarks && p.secondary_benchmarks.length > 0)) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.primary_benchmark_name && <>Benchmark: {p.primary_benchmark_name}</>}
                  {p.secondary_benchmarks && p.secondary_benchmarks.length > 0 && (
                    <> {p.primary_benchmark_name ? "+" : ""}{p.secondary_benchmarks.length} secondary</>
                  )}
                </p>
              )}
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