import React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { formatCurrency } from "./capitalFlowCalculator";

/**
 * Shows whether an allocation is over, under, or fully matching a total cap.
 *
 * Props:
 *  - allocated: number|string — the amount allocated to the product(s)
 *  - total: number|string — the cap (e.g. the portfolio's initial allocation amount)
 *  - label: string — description of the cap shown in the messages
 */
export default function AllocationValidation({ allocated = 0, total = 0, label = "initial allocation amount" }) {
  const alloc = parseFloat(allocated) || 0;
  const tot = parseFloat(total) || 0;
  if (!tot || tot <= 0) return null;

  const remaining = tot - alloc;

  if (alloc > tot) {
    return (
      <div className="flex items-start gap-2 mt-1.5 p-2 rounded-md bg-red-50 border border-red-200">
        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
        <p className="text-xs text-red-700">
          Over-allocated — exceeds the {label} by{" "}
          <span className="font-semibold">{formatCurrency(alloc - tot)}</span>.
        </p>
      </div>
    );
  }

  if (remaining > 0) {
    return (
      <div className="flex items-start gap-2 mt-1.5 p-2 rounded-md bg-amber-50 border border-amber-200">
        <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">
          Not fully allocated —{" "}
          <span className="font-semibold">{formatCurrency(remaining)}</span> remaining of{" "}
          {formatCurrency(tot)}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 mt-1.5 p-2 rounded-md bg-emerald-50 border border-emerald-200">
      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
      <p className="text-xs text-emerald-700">Fully allocated.</p>
    </div>
  );
}