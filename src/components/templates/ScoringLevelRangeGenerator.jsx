import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

/**
 * Inline control that lets the template author define a numerical min/max
 * range plus an interval (step) and auto-generate one descriptor row per
 * stepped value in that range (e.g. 0–100 step 10 → 0,10,20,…,100).
 * Existing descriptor text for levels that remain in the new range is
 * preserved; levels outside the range are dropped.
 *
 * Props:
 *   descriptors: [{ level, text }] — current descriptor rows
 *   onGenerate: (newDescriptors) => void
 */
export default function ScoringLevelRangeGenerator({ descriptors = [], onGenerate }) {
  const existingLevels = descriptors.map((d) => Number(d.level)).filter((n) => !Number.isNaN(n));
  const minExisting = existingLevels.length ? Math.min(...existingLevels) : 0;
  const maxExisting = existingLevels.length ? Math.max(...existingLevels) : 100;

  const [min, setMin] = useState(minExisting);
  const [max, setMax] = useState(maxExisting);
  const [interval, setInterval] = useState(1);

  const handleGenerate = () => {
    const lo = parseFloat(min);
    const hi = parseFloat(max);
    const step = parseFloat(interval);
    if (Number.isNaN(lo) || Number.isNaN(hi) || Number.isNaN(step)) {
      toast({ title: "Enter valid numbers", variant: "destructive" });
      return;
    }
    if (lo > hi) {
      toast({ title: "Min must be less than or equal to max", variant: "destructive" });
      return;
    }
    if (step <= 0) {
      toast({ title: "Interval must be greater than 0", variant: "destructive" });
      return;
    }

    // Preserve existing text for levels that remain in the new range
    const textByLevel = {};
    descriptors.forEach((d) => {
      textByLevel[Number(d.level)] = d.text || "";
    });

    const newDescriptors = [];
    // Build stepped values from lo to hi inclusive
    const count = Math.floor((hi - lo) / step) + 1;
    if (count > 100) {
      toast({ title: "Range too large", description: "Maximum 100 levels allowed. Increase the interval.", variant: "destructive" });
      return;
    }
    for (let i = 0; i < count; i++) {
      const lvl = lo + step * i;
      // Round to avoid floating point noise (e.g. 0.30000000000000004)
      const rounded = Math.round(lvl * 1000) / 1000;
      newDescriptors.push({ level: rounded, text: textByLevel[rounded] || "" });
    }
    // Ensure the max value is included even if it doesn't land exactly on a step
    const last = newDescriptors[newDescriptors.length - 1]?.level;
    if (last !== undefined && last !== hi) {
      newDescriptors.push({ level: hi, text: textByLevel[hi] || "" });
    }

    onGenerate(newDescriptors);
    toast({ title: `Generated ${newDescriptors.length} level${newDescriptors.length === 1 ? "" : "s"}`, description: `${lo} to ${hi} every ${step}.` });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs bg-cyan-50/40 border border-cyan-200 rounded-md px-2 py-1.5">
      <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
      <span className="text-cyan-700 font-medium whitespace-nowrap">Generate levels from range:</span>
      <Input
        type="number"
        value={min}
        onChange={(e) => setMin(e.target.value)}
        className="h-7 w-16 text-xs text-center"
        placeholder="min"
      />
      <span className="text-gray-400">to</span>
      <Input
        type="number"
        value={max}
        onChange={(e) => setMax(e.target.value)}
        className="h-7 w-16 text-xs text-center"
        placeholder="max"
      />
      <span className="text-gray-400">every</span>
      <Input
        type="number"
        value={interval}
        onChange={(e) => setInterval(e.target.value)}
        className="h-7 w-16 text-xs text-center"
        placeholder="step"
        min="1"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleGenerate}
        className="h-7 text-xs border-cyan-300 text-cyan-700 hover:bg-cyan-50"
      >
        Generate
      </Button>
    </div>
  );
}