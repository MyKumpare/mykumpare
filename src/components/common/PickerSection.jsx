import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

/**
 * Lightweight collapsible section that mirrors the visual style of the inline
 * data sections (Portfolios/Firms/…) but opens a picker modal instead of
 * rendering an inline list. Used to keep the vertical section list consistent
 * with the main header navigation.
 */
export default function PickerSection({
  label,
  icon: Icon,
  iconColor = "text-gray-500",
  count,
  entityName,
  onOpen,
  openLabel,
  description,
  forceExpanded,
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  // Optionally fetch a live count from an entity (e.g. DueDiligence which the
  // parent page doesn't already load). An explicit `count` prop wins.
  const { data: fetched = [] } = useQuery({
    queryKey: ["picker_count", entityName],
    queryFn: () => base44.entities[entityName].list("-created_date", 5000),
    enabled: !!entityName,
  });

  const resolvedCount =
    count !== undefined ? count : entityName ? fetched.filter((x) => !x.deleted_at).length : undefined;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 group">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          )}
          {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{label}</span>
          {resolvedCount !== undefined && (
            <span className="text-xs text-gray-400 font-normal">({resolvedCount})</span>
          )}
        </button>
        {onOpen && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1 text-xs"
            onClick={onOpen}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            {openLabel || `Open ${label}`}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="py-3 text-center border border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2">
          <span className="text-sm text-gray-400 italic">
            {description || `Open ${label} to view and manage records.`}
          </span>
          {onOpen && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onOpen}
            >
              {openLabel || `Open ${label}`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}