import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, PackageCheck, GitCompare, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { productMatchStyle } from "./rfpRfiProgress";

const FIT_STYLES = {
  Strong: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2, label: "Strong" },
  Partial: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", icon: AlertTriangle, label: "Partial" },
  Gap: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", icon: XCircle, label: "Gap" },
};

function FitCell({ value }) {
  const s = FIT_STYLES[value] || FIT_STYLES.Gap;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${s.bg} ${s.text} border ${s.border}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}

/**
 * Comparison view showing how well each of the user's own products aligns with
 * the specific requirements of an RFP/RFI opportunity. Reads the structured
 * `product_alignment` breakdown produced by the product-match check; offers a
 * "Run match" action when no alignment has been generated yet.
 */
export default function RfpRfiAlignmentDialog({ open, onClose, record }) {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);

  const alignment = record?.product_alignment || [];
  const hasAlignment = alignment.length > 0;
  const matchStatus = record?.product_match_status || "Not Checked";

  const runMatch = async () => {
    if (!record?.id) return;
    setChecking(true);
    try {
      const res = await base44.functions.invoke("matchRfpRfiToProducts", { record_id: record.id });
      const data = res?.data || res;
      queryClient.invalidateQueries({ queryKey: ["rfp-rfi-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["firm-rfp-rfi", record.firm_id] });
      toast({ title: "Alignment generated", description: data.product_match_status || "" });
      // Close + reopen by invalidating; parent refetches and re-renders the card.
      onClose();
    } catch (err) {
      toast({ title: "Match check failed", description: err?.message || "Could not check product match.", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-primary" />
            Product Alignment Comparison
          </DialogTitle>
          <DialogDescription>
            How well our product features align with the requirements of "{record?.title || '—'}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Status row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Overall match:</span>
            <Badge variant="outline" className={`text-[11px] ${productMatchStyle(matchStatus)}`}>
              <PackageCheck className="w-3 h-3 mr-1" /> {matchStatus}
            </Badge>
            {record?.product_match_checked_at && (
              <span className="text-[10px] text-gray-400">
                checked {new Date(record.product_match_checked_at).toLocaleString()}
              </span>
            )}
          </div>

          {record?.product_match_summary && (
            <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-2.5 border border-gray-100">
              {record.product_match_summary}
            </p>
          )}

          {/* Alignment breakdown */}
          {hasAlignment ? (
            <div className="space-y-3">
              {alignment.map((prod) => (
                <div key={prod.product_id} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <PackageCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-sm font-semibold text-gray-800 truncate">{prod.product_name || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-gray-400">Overall fit:</span>
                      <FitCell value={prod.overall_fit} />
                    </div>
                  </div>
                  {prod.criteria?.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] text-gray-400 bg-white">
                          <th className="text-left font-medium px-3 py-1.5 w-[28%]">Requirement</th>
                          <th className="text-center font-medium px-3 py-1.5 w-[16%]">Alignment</th>
                          <th className="text-left font-medium px-3 py-1.5">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prod.criteria.map((c, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="px-3 py-1.5 text-gray-700 font-medium align-top">{c.requirement}</td>
                            <td className="px-3 py-1.5 text-center align-top"><FitCell value={c.alignment} /></td>
                            <td className="px-3 py-1.5 text-gray-600 align-top">{c.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-[11px] text-gray-400 italic px-3 py-2">No requirement breakdown available.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 flex flex-col items-center gap-2 text-center">
              <GitCompare className="w-7 h-7 text-gray-300" />
              <p className="text-sm text-gray-500">
                {matchStatus === "Not Checked"
                  ? "No product match has been run yet for this opportunity."
                  : "The match check found no plausible product fit, so no alignment breakdown was produced."}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={runMatch} disabled={checking} className="h-8 gap-1.5 text-xs mt-1">
                {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {checking ? "Running match…" : "Run product match"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}