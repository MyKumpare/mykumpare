import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

/**
 * Inline control that lets the template author define a numerical min/max
 * range and auto-generate one descriptor row per integer in that range.
 * Existing descriptor text for levels that still fall inside the new range
 * is preserved; levels outside the range are dropped.
 *
 * Props:
 *   descriptors: [{ level, text }] — current descriptor rows
 *   onGenerate: (newDescriptors) => void
 */
export default function ScoringLevelRangeGenerator({ descriptors = [], onGenerate }) {
  const existingLevels = descriptors.map((d) => Number(d.level)).filter((n) => !Number.isNaN(n));
  const minExisting = existingLevels.length ? Math.min(...existingLevels) : 1;
  const maxExisting = existingLevels.length ? Math.max(...existingLevels) : 5;

  const [min, setMin] = useState(minExisting);
  const [max, setMax] = useState(maxExisting);

  const handleGenerate = () => {
    const lo = parseInt(min, 10);
    const hi = parseInt(max, 10);
    if (Number.isNaN(lo) || Number.isNaN(hi)) {
      toast({ title: "Enter valid numbers", variant: "destructive" });
      return;
    }
    if (lo > hi) {
      toast({ title: "Min must be less than or equal to max", variant: "destructive" });
      return;
    }
    // Cap to a sane maximum to avoid creating hundreds of rows by accident
    const count = hi - lo + 1;
    if (count > 100) {
      toast({ title: "Range too large", description: "Maximum 100 levels allowed.", variant: "destructive" });
      return;
    }

    // Preserve existing text for levels that remain in the new range
    const textByLevel = {};
    descriptors.forEach((d) => {
      textByLevel[Number(d.level)] = d.text || "";
    });

    const newDescriptors = [];
    for (let lvl = lo; lvl <= hi; lvl++) {
      newDescriptors.push({ level: lvl, text: textByLevel[lvl] || "" });
    }
    onGenerate(newDescriptors);
    toast({ title: `Generated ${count} level${count === 1 ? "" : "s"}`, description: `Scores ${lo} to ${hi}.` });
  };

  return (
    <div className="flex items-center gap-2 text-xs bg-cyan-50/40 border border-cyan-200 rounded-md px-2 py-1.5">
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