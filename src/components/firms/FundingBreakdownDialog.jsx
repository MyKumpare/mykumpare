import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, LayoutList, Package } from "lucide-react";
import { format, parseISO } from "date-fns";

function formatCurrency(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * Drill-down dialog showing the breakdown behind a funding summary metric.
 * Each row is a hyperlink that opens the source portfolio.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(v:boolean)=>void} props.onOpenChange
 * @param {string} props.title  — dialog title (e.g. "Total Funding Amount Breakdown")
 * @param {string} props.subtitle — e.g. "by Client Portfolio"
 * @param {Array} props.items — [{ id, name, subtext, amount, date, portfolio }]
 * @param {function} props.onPortfolioClick — (portfolio) => navigate to portfolio
 * @param {boolean} [props.showAmount=true]
 */
export default function FundingBreakdownDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  items = [],
  onPortfolioClick,
  showAmount = true,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <LayoutList className="w-4 h-4 text-indigo-500" />
            {title}
          </DialogTitle>
          {subtitle && (
            <p className="text-xs text-gray-500 -mt-1">{subtitle}</p>
          )}
        </DialogHeader>

        {items.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
            <Package className="w-7 h-7 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No records to show.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {items.map((item, i) => {
              const clickable = item.portfolio && onPortfolioClick;
              return (
                <div
                  key={item.id || i}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-white ${
                    clickable
                      ? "border-indigo-100 hover:bg-indigo-50/60 hover:border-indigo-200 cursor-pointer"
                      : "border-gray-100"
                  }`}
                  onClick={clickable ? () => onPortfolioClick(item.portfolio) : undefined}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {clickable && <ExternalLink className="w-3 h-3 text-indigo-500 flex-shrink-0" />}
                      <span
                        className={`text-sm font-medium truncate ${
                          clickable ? "text-indigo-600 hover:underline" : "text-gray-800"
                        }`}
                      >
                        {item.name}
                      </span>
                    </div>
                    {item.subtext && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{item.subtext}</p>
                    )}
                    {item.date && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {format(parseISO(item.date), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  {showAmount && item.amount != null && (
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      {formatCurrency(item.amount)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 && showAmount && (
          <div className="flex items-center justify-between pt-2 border-t mt-1">
            <span className="text-xs font-medium text-gray-500">Total</span>
            <span className="text-sm font-bold text-indigo-700">
              {formatCurrency(items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0))}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}