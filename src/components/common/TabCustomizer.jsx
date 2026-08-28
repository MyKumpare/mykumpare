import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";

/**
 * Tab customization popover. Lets a logged-in user choose which tabs are
 * visible on a form and in what order. `allTabs` is the full set of tabs
 * available for the current form instance (already filtered by firm/product
 * type); `visibleTabs` is the user's current visible+ordered subset.
 */
export default function TabCustomizer({ allTabs, visibleTabs, onToggle, onMove, onReset }) {
  const visibleKeys = new Set(visibleTabs.map((t) => t.key));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-2 gap-1 text-xs shrink-0"
          title="Customize tabs"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">Tabs</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Customize Tabs</p>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={onReset}>
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
          </div>
          <p className="text-xs text-gray-500">Check tabs to show them. Use the arrows to reorder.</p>
          <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
            {allTabs.map((tab) => {
              const visible = visibleKeys.has(tab.key);
              return (
                <div
                  key={tab.key}
                  className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${visible ? "" : "opacity-50"}`}
                >
                  <Checkbox checked={visible} onCheckedChange={() => onToggle(tab.key)} />
                  <span className="flex-1 text-sm text-gray-700 truncate">{tab.label}</span>
                  {visible && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onMove(tab.key, "up")}
                        title="Move up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onMove(tab.key, "down")}
                        title="Move down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}