import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { History, Loader2, Calendar } from "lucide-react";

// Shared dialog for launching a historical news scrub with an optional date range.
// `open`, `onOpenChange`, `onConfirm` (async (range) => {}), `keywords` (current scrub keywords).
export default function HistoricalScrubDialog({
  open,
  onOpenChange,
  onConfirm,
  keywords = [],
  targetLabel = "this firm",
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStartDate("");
      setEndDate("");
      setSubmitting(false);
    }
  }, [open]);

  const rangeLabel = (() => {
    if (startDate && endDate) return `between ${startDate} and ${endDate}`;
    if (startDate) return `from ${startDate} onward`;
    if (endDate) return `up to ${endDate}`;
    return "across all available history (multi-period search)";
  })();

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm({
        start_date: startDate || null,
        end_date: endDate || null,
      });
      onOpenChange(false);
    } catch (e) {
      // caller surfaces its own toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <History className="w-4 h-4" />
            Historical News Scrub
          </DialogTitle>
          <DialogDescription>
            Search the web for historical news about {targetLabel}. The scrub runs in the background and new items appear shortly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-amber-50/60 border border-amber-100 p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-800">Date Range (optional)</span>
            </div>
            <p className="text-[11px] text-gray-500">
              Focus the search on a specific period. Leave both blank to search across all available history in multiple time periods.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-500">Start date</Label>
                <Input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={e => setStartDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-500">End date</Label>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={e => setEndDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-[11px] text-gray-400 hover:text-red-500"
              >
                Clear dates
              </button>
            )}
          </div>

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[11px] text-gray-500">Priority keywords:</span>
              {keywords.map(k => (
                <span key={k} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                  {k}
                </span>
              ))}
            </div>
          )}

          <p className="text-[11px] text-gray-400 italic">
            The search will run {rangeLabel}.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <History className="w-3.5 h-3.5 mr-1" />}
            {submitting ? "Starting..." : "Start Scrub"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}