import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

/**
 * Wraps a criterion label in a hover tooltip that shows the full criterion
 * name, category, and level descriptors (the "full descriptions" analysts
 * need to read when reviewing a comparison matrix).
 *
 * The trigger is the label itself (no extra icon) so the whole cell is
 * hoverable; an optional `showIcon` prop adds an info glyph for discoverability.
 */
export default function CriterionTooltip({ criterion, children, showIcon = true, side = "top", className = "" }) {
  const descriptors = Array.isArray(criterion?.descriptors) ? criterion.descriptors : [];
  const hasContent = criterion?.name || descriptors.length > 0;

  if (!hasContent) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
            {children}
            {showIcon && <Info className="w-3 h-3 text-gray-400 shrink-0" />}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-[420px] bg-white text-gray-700 border border-gray-200 shadow-lg p-3 text-left"
        >
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-gray-900">{criterion.name}</div>
            {criterion.category && (
              <div className="text-[10px] text-gray-500">{criterion.category}</div>
            )}
            {descriptors.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-gray-100">
                {descriptors.map((d) => (
                  <div key={d.level} className="text-[10px] leading-snug flex gap-1.5">
                    <span className="font-bold text-gray-400 shrink-0">L{d.level}:</span>
                    <span className="text-gray-600">{d.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}