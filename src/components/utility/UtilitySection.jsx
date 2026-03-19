import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Trash2, Plus, Gauge } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AddBenchmarkDialog from "./AddBenchmarkDialog";

export default function UtilitySection({ deletedCount }) {
  const [expanded, setExpanded] = useState(true);
  const [benchmarkDialogOpen, setBenchmarkDialogOpen] = useState(false);

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date"),
  });

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
                onClick={() => setBenchmarkDialogOpen(true)}
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
              <div className="space-y-1">
                {benchmarks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 text-sm"
                  >
                    <Gauge className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {b.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {b.asset_class}
                        {b.region && ` • ${b.region}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deleted Records */}
          <Link
            to="/DeletedRecords"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 transition-colors group"
          >
            <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                Deleted Records
              </span>
            </div>
            {deletedCount > 0 && (
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-full flex-shrink-0">
                {deletedCount}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
          </Link>
        </div>
      )}

      <AddBenchmarkDialog
        open={benchmarkDialogOpen}
        onOpenChange={setBenchmarkDialogOpen}
        benchmarks={benchmarks}
      />
    </div>
  );
}