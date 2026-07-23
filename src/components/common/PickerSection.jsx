import React from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

/**
 * Collapsible-style section that opens a picker modal directly when the
 * header is clicked — no intermediate "Open" button. Mirrors the visual
 * style of the inline data sections (Portfolios/Firms/…) so the vertical
 * section list stays consistent with the main header navigation.
 *
 * Optionally renders a "+ Add …" action button on the right of the header
 * when `onAdd` is supplied, matching the pattern used by Portfolios/Firms.
 */
export default function PickerSection({
  label,
  icon: Icon,
  iconColor = "text-gray-500",
  count,
  entityName,
  onOpen,
  onAdd,
  addLabel,
  addColor = "text-gray-600",
  addHoverColor = "hover:text-gray-700",
  addHoverBg = "hover:bg-gray-50",
  openLabel: _openLabel,
  description: _description,
  forceExpanded: _forceExpanded,
}) {
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
        <button onClick={onOpen} className="flex items-center gap-2 group">
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{label}</span>
          {resolvedCount !== undefined && (
            <span className="text-xs text-gray-400 font-normal">({resolvedCount})</span>
          )}
        </button>
        {onAdd && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 ${addColor} ${addHoverColor} ${addHoverBg} gap-1 text-xs`}
            onClick={onAdd}
          >
            <Plus className="w-3.5 h-3.5" />
            {addLabel || `Add ${label}`}
          </Button>
        )}
      </div>
    </div>
  );
}