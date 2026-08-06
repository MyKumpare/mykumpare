import React, { useState, useMemo } from "react";
import { computeApprovalStatus } from "@/components/firms/DueDiligenceKanbanBoard";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  "Pipeline": "#3b82f6",
  "Buy List": "#10b981",
  "Rejected": "#ef4444",
  "Not Started": "#9ca3af",
  "In-process": "#f59e0b",
  "Completed": "#10b981",
  "In Pipeline": "#3b82f6",
  "Awaiting Approval": "#f59e0b",
  "Approved": "#10b981",
};

function getStatusValue(rec, groupMode, fallback) {
  if (groupMode === "approval_status") return computeApprovalStatus(rec);
  return rec[groupMode] || fallback;
}

export default function DdSummaryChart({ records, groupMode, columns, onRecordClick }) {
  const [hoveredCol, setHoveredCol] = useState(null);

  const data = useMemo(() => {
    return columns.map((col) => {
      const items = records.filter((r) => getStatusValue(r, groupMode, columns[0]) === col);
      return {
        name: col,
        count: items.length,
        items,
        color: STATUS_COLORS[col] || "#6b7280",
      };
    });
  }, [records, groupMode, columns]);

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const total = records.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-700">Summary Statistics</h3>
          <span className="text-xs text-gray-400">({total} total)</span>
        </div>
        <span className="text-[11px] text-gray-400 hidden sm:block">
          Hover a bar to see records • Click a record to open
        </span>
      </div>

      <div className="space-y-2">
        {data.map((seg) => (
          <div
            key={seg.name}
            className="relative"
            onMouseEnter={() => setHoveredCol(seg.name)}
            onMouseLeave={() => setHoveredCol(null)}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-600 w-28 sm:w-32 truncate flex-shrink-0">
                {seg.name}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-visible">
                <div
                  className="h-full rounded-full transition-all duration-300 flex items-center justify-end px-2 min-w-0"
                  style={{
                    width: `${Math.max((seg.count / maxCount) * 100, seg.count > 0 ? 6 : 0)}%`,
                    backgroundColor: seg.color,
                  }}
                >
                  {seg.count > 0 && (
                    <span className="text-[10px] font-bold text-white whitespace-nowrap">{seg.count}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Drill-down popover on hover */}
            {hoveredCol === seg.name && seg.items.length > 0 && (
              <div className="absolute z-50 top-7 left-28 sm:left-32 right-0 bg-white border border-gray-200 shadow-lg rounded-lg p-1.5 max-h-52 overflow-y-auto min-w-[240px]">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1.5 py-0.5">
                  {seg.items.length} record{seg.items.length !== 1 ? "s" : ""}
                </p>
                {seg.items.map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => onRecordClick?.(rec)}
                    className="block w-full text-left px-2 py-1.5 hover:bg-indigo-50 rounded transition-colors group"
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-xs font-medium text-gray-800 truncate flex-1">
                        {rec.product_name || "—"}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 block pl-3 truncate">
                      {rec.firm_name || ""}
                      {rec.primary_analyst_name ? ` • ${rec.primary_analyst_name}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {hoveredCol === seg.name && seg.items.length === 0 && (
              <div className="absolute z-50 top-7 left-28 sm:left-32 right-0 bg-white border border-gray-200 shadow-lg rounded-lg p-2 min-w-[180px]">
                <p className="text-[11px] text-gray-400 italic">No records in this status</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}