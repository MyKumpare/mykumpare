import React from "react";
import { Label } from "@/components/ui/label";
import { calculateNetFlow, formatCurrency } from "./capitalFlowCalculator";

/**
 * Displays three read-only calculated fields:
 * Total Capital Additions, Total Capital Redemptions, Net Capital Flow.
 *
 * Props:
 *  - totalAdditions: number
 *  - totalRedemptions: number
 *  - initialAllocation: number|string (for net flow calculation)
 */
export default function CapitalFlowFields({ totalAdditions = 0, totalRedemptions = 0, initialAllocation }) {
  const netFlow = calculateNetFlow(initialAllocation, totalAdditions, totalRedemptions);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-500">Total Capital Additions</Label>
        <div className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">
          {formatCurrency(totalAdditions)}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-500">Total Capital Redemptions</Label>
        <div className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50">
          {formatCurrency(totalRedemptions)}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-500">Net Capital Flow</Label>
        <div className="text-sm text-gray-900 px-3 py-2 rounded-md border bg-gray-50 font-medium">
          {formatCurrency(netFlow)}
        </div>
      </div>
    </div>
  );
}