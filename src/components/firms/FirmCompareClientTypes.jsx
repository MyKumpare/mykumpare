import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fmt(n) {
  const v = Math.round(toNumber(n));
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US");
}

/**
 * Client type allocation for one firm, derived from the latest AUM history
 * entry's client_type_breakdown. Shown as labeled progress bars with %.
 */
export default function FirmCompareClientTypes({ firm }) {
  const latest = useMemo(() => {
    const hist = firm?.aum_history || [];
    if (!hist.length) return null;
    return [...hist].sort((a, b) =>
      (b.month_end_date || "").localeCompare(a.month_end_date || "")
    )[0];
  }, [firm]);

  if (!latest) {
    return <p className="text-sm text-gray-400 italic">No AUM history.</p>;
  }

  const rows = latest.client_type_breakdown || [];
  const total = rows.reduce((s, r) => s + toNumber(r.aum_amount), 0);
  const dateLabel = latest.month_end_date
    ? format(parseISO(latest.month_end_date), "MM/dd/yyyy")
    : "";

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        No client type breakdown for {dateLabel}.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-gray-500">
        As of <span className="font-medium text-gray-600">{dateLabel}</span> · Firm AUM{" "}
        <span className="font-medium text-gray-700">{fmt(toNumber(latest.firm_aum))}</span>
      </p>
      {rows.map((r, i) => {
        const amt = toNumber(r.aum_amount);
        const pct = total > 0 ? (amt / total) * 100 : 0;
        return (
          <div key={r.id || i}>
            <div className="flex items-center justify-between text-xs mb-1 gap-2">
              <span className="font-medium text-gray-700 truncate">{r.client_type || "—"}</span>
              <span className="text-gray-500 whitespace-nowrap">
                {fmt(amt)} · {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}