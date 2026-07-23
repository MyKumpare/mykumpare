import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, Gauge, Wrench, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AddBenchmarkDialog from "./AddBenchmarkDialog";
import DuplicateContactsReview from "@/components/contacts/DuplicateContactsReview";

function BenchmarkItem({ b, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 text-sm cursor-pointer text-left"
    >
      <Gauge className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-800 truncate">{b.name}</p>
        {(b.region || b.market_capitalization || b.style || b.asset_class) && (
          <p className="text-[11px] text-gray-400 truncate">
            {[b.asset_class, b.region, b.market_capitalization, b.style].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </button>
  );
}

function CollapsibleGroup({ label, labelClass = "text-xs font-semibold text-indigo-600 uppercase tracking-wide", indent = 0, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ paddingLeft: indent * 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 w-full text-left mb-1 group"
      >
        {open
          ? <ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
        }
        <span className={labelClass}>{label}</span>
      </button>
      {open && children}
    </div>
  );
}

export default function UtilitySection({ deletedCount, forceExpanded = false }) {
  const [expanded, setExpanded] = useState(false);
  const [benchmarkDialogOpen, setBenchmarkDialogOpen] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState(null);
  const [benchmarkQuery, setBenchmarkQuery] = useState("");

  // Expand when the parent requests it (e.g. clicking the Utilities header icon),
  // while still letting the user collapse it manually afterwards.
  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date"),
  });

  const filteredBenchmarks = useMemo(() => {
    const q = benchmarkQuery.trim().toLowerCase();
    if (!q) return benchmarks;
    return benchmarks.filter(b =>
      (b.name || "").toLowerCase().includes(q) ||
      (b.asset_class || "").toLowerCase().includes(q) ||
      (b.region || "").toLowerCase().includes(q) ||
      (b.market_capitalization || "").toLowerCase().includes(q) ||
      (b.style || "").toLowerCase().includes(q)
    );
  }, [benchmarks, benchmarkQuery]);

  // Group benchmarks: Equity → by region → by market_cap → by style (all ascending)
  // Non-equity → by asset_class → by name
  const groupedBenchmarks = useMemo(() => {
    const equityBenchmarks = filteredBenchmarks
      .filter(b => b.asset_class === "Equity")
      .sort((a, b) =>
        (a.region || "").localeCompare(b.region || "") ||
        (a.market_capitalization || "").localeCompare(b.market_capitalization || "") ||
        (a.style || "").localeCompare(b.style || "") ||
        a.name.localeCompare(b.name)
      );

    const equityGroups = {};
    for (const b of equityBenchmarks) {
      const r = b.region || "—";
      const mc = b.market_capitalization || "—";
      const s = b.style || "—";
      if (!equityGroups[r]) equityGroups[r] = {};
      if (!equityGroups[r][mc]) equityGroups[r][mc] = {};
      if (!equityGroups[r][mc][s]) equityGroups[r][mc][s] = [];
      equityGroups[r][mc][s].push(b);
    }

    const nonEquity = filteredBenchmarks
      .filter(b => b.asset_class !== "Equity")
      .sort((a, b) => (a.asset_class || "").localeCompare(b.asset_class || "") || a.name.localeCompare(b.name));

    const nonEquityGroups = {};
    for (const b of nonEquity) {
      const ac = b.asset_class || "Other";
      if (!nonEquityGroups[ac]) nonEquityGroups[ac] = [];
      nonEquityGroups[ac].push(b);
    }

    return { equityGroups, nonEquityGroups, hasEquity: equityBenchmarks.length > 0, hasNonEquity: nonEquity.length > 0 };
  }, [filteredBenchmarks]);

  const openBenchmark = (b) => {
    setSelectedBenchmark(b);
    setBenchmarkDialogOpen(true);
  };

  const searching = benchmarkQuery.trim().length > 0;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 group"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          )}
          <Wrench className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Utility
          </span>
        </button>
      </div>

      {/* Utility options */}
      {expanded && (
        <div className="space-y-2 pl-2 border-l-2 border-gray-100">
          {/* Benchmark */}
          <CollapsibleGroup label="Benchmark" defaultOpen={true} labelClass="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            <div className="space-y-2">
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
                  onClick={() => { setSelectedBenchmark(null); setBenchmarkDialogOpen(true); }}
                >
                  <Plus className="w-3 h-3" />
                  Add Benchmark
                </Button>
              </div>

              {/* Benchmark search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={benchmarkQuery}
                  onChange={(e) => setBenchmarkQuery(e.target.value)}
                  placeholder="Search benchmarks..."
                  className="w-full pl-8 pr-3 h-8 rounded-lg bg-white border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                />
              </div>

              {filteredBenchmarks.length === 0 ? (
                <p className="text-xs text-gray-400 px-1 py-2">
                  {searching ? "No benchmarks match your search." : "No benchmarks yet."}
                </p>
              ) : (
                <div className="space-y-1">
                  {groupedBenchmarks.hasEquity && Object.entries(groupedBenchmarks.equityGroups)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([region, byMc]) => (
                      <CollapsibleGroup key={region} label={region} defaultOpen={true} labelClass="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <div className="space-y-1">
                          {Object.entries(byMc)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([mc, byStyle]) => (
                              <CollapsibleGroup key={mc} label={mc} defaultOpen={true} indent={1} labelClass="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                <div className="space-y-1">
                                  {Object.entries(byStyle)
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([style, items]) => (
                                      <CollapsibleGroup key={style} label={style} defaultOpen={true} indent={2} labelClass="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                        <div className="space-y-1">
                                          {items.map(b => (
                                            <BenchmarkItem key={b.id} b={b} onClick={() => openBenchmark(b)} />
                                          ))}
                                        </div>
                                      </CollapsibleGroup>
                                    ))}
                                </div>
                              </CollapsibleGroup>
                            ))}
                        </div>
                      </CollapsibleGroup>
                    ))}

                  {groupedBenchmarks.hasNonEquity && Object.entries(groupedBenchmarks.nonEquityGroups)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([ac, items]) => (
                      <CollapsibleGroup key={ac} label={ac} defaultOpen={true} labelClass="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <div className="space-y-1">
                          {items.map(b => (
                            <BenchmarkItem key={b.id} b={b} onClick={() => openBenchmark(b)} />
                          ))}
                        </div>
                      </CollapsibleGroup>
                    ))}
                </div>
              )}
            </div>
          </CollapsibleGroup>

          {/* Contact duplicates review */}
          <CollapsibleGroup label="Contact Cleanup" defaultOpen={false} labelClass="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            <div className="space-y-2 pt-2">
              <DuplicateContactsReview />
            </div>
          </CollapsibleGroup>

        </div>
      )}

      <AddBenchmarkDialog
        open={benchmarkDialogOpen}
        onOpenChange={(v) => { setBenchmarkDialogOpen(v); if (!v) setSelectedBenchmark(null); }}
        benchmarks={benchmarks}
        editingBenchmark={selectedBenchmark}
      />
    </div>
  );
}