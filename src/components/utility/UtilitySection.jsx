import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Plus, Gauge } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AddBenchmarkDialog from "./AddBenchmarkDialog";

function BenchmarkItem({ b, onClick }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 text-sm cursor-pointer"
      onClick={onClick}
    >
      <Gauge className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <p className="font-medium text-gray-800 truncate">{b.name}</p>
    </div>
  );
}

function CollapsibleGroup({ label, labelClass = "text-xs font-semibold text-indigo-600 uppercase tracking-wide", indent = 0, children }) {
  const [open, setOpen] = useState(true);
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

export default function UtilitySection({ deletedCount }) {
  const [expanded, setExpanded] = useState(true);
  const [benchmarkDialogOpen, setBenchmarkDialogOpen] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState(null);

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date"),
  });

  // Group benchmarks: Equity → by region → by market_cap → by style (all ascending)
  // Non-equity → by asset_class → by name
  const groupedBenchmarks = useMemo(() => {
    const equityBenchmarks = benchmarks
      .filter(b => b.asset_class === "Equity")
      .sort((a, b) =>
        (a.region || "").localeCompare(b.region || "") ||
        (a.market_capitalization || "").localeCompare(b.market_capitalization || "") ||
        (a.style || "").localeCompare(b.style || "") ||
        a.name.localeCompare(b.name)
      );

    // Group equity by region → market_cap → style
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

    const nonEquity = benchmarks
      .filter(b => b.asset_class !== "Equity")
      .sort((a, b) => (a.asset_class || "").localeCompare(b.asset_class || "") || a.name.localeCompare(b.name));

    const nonEquityGroups = {};
    for (const b of nonEquity) {
      const ac = b.asset_class || "Other";
      if (!nonEquityGroups[ac]) nonEquityGroups[ac] = [];
      nonEquityGroups[ac].push(b);
    }

    return { equityGroups, nonEquityGroups, hasEquity: equityBenchmarks.length > 0, hasNonEquity: nonEquity.length > 0 };
  }, [benchmarks]);

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
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Utility
          </span>
        </button>
      </div>

      {/* Utility options */}
      {expanded && (
        <div className="space-y-2 pl-2 border-l-2 border-gray-100">
          {/* Benchmark */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Benchmark
              </span>
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
            {benchmarks.length === 0 ? (
              <div className="text-xs text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-lg">
                No benchmarks yet
              </div>
            ) : (
              <div className="space-y-2">
                {/* Equity benchmarks grouped by Region → Market Cap → Style */}
                {groupedBenchmarks.hasEquity && (
                  <CollapsibleGroup label="Equity">
                    <div className="space-y-1 ml-1">
                      {Object.keys(groupedBenchmarks.equityGroups).sort().map(region => (
                        <CollapsibleGroup key={region} label={region} labelClass="text-xs font-medium text-gray-600" indent={1}>
                          <div className="space-y-1 ml-1">
                            {Object.keys(groupedBenchmarks.equityGroups[region]).sort().map(mc => (
                              <CollapsibleGroup key={mc} label={mc} labelClass="text-xs text-gray-500 italic" indent={2}>
                                <div className="space-y-1 ml-1">
                                  {Object.keys(groupedBenchmarks.equityGroups[region][mc]).sort().map(style => (
                                    <CollapsibleGroup key={style} label={style} labelClass="text-xs text-gray-400 italic" indent={3}>
                                      <div className="space-y-1 ml-2">
                                        {groupedBenchmarks.equityGroups[region][mc][style].map(b => (
                                          <BenchmarkItem key={b.id} b={b} onClick={() => { setSelectedBenchmark(b); setBenchmarkDialogOpen(true); }} />
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
                    </div>
                  </CollapsibleGroup>
                )}
                {/* Non-equity benchmarks grouped by Asset Class */}
                {groupedBenchmarks.hasNonEquity && (
                  <div className="space-y-1">
                    {Object.keys(groupedBenchmarks.nonEquityGroups).sort().map(ac => (
                      <CollapsibleGroup key={ac} label={ac}>
                        <div className="space-y-1 ml-1">
                          {groupedBenchmarks.nonEquityGroups[ac].map(b => (
                            <BenchmarkItem key={b.id} b={b} onClick={() => { setSelectedBenchmark(b); setBenchmarkDialogOpen(true); }} />
                          ))}
                        </div>
                      </CollapsibleGroup>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>


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