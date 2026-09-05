import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building, Package, Clock, ShieldCheck } from "lucide-react";

/**
 * Dialog showing the products included in a Due Diligence category
 * (all DD records, or only those with pending supervisor approvals).
 * Each row shows the product name, firm name, DD status, and (for
 * pending approvals) the stages awaiting approval.
 */
export default function DdProductsListDialog({ open, onOpenChange, title, ddRecords }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto -mx-1 px-1">
          {ddRecords.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No products in this category.</p>
          ) : (
            <div className="space-y-2">
              {ddRecords.map((dd) => {
                const pendingStages = (dd.stages || []).filter(
                  (s) => s.supervisor_status === "pending" && s.supervisor_contact_id
                );
                return (
                  <div key={dd.id} className="rounded-lg border border-gray-200 p-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{dd.product_name || "—"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500 truncate">{dd.firm_name || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{dd.status || "Pipeline"}</span>
                        {pendingStages.length > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {pendingStages.length} pending stage{pendingStages.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      {pendingStages.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {pendingStages.map((s) => (
                            <p key={s.id} className="text-[11px] text-amber-600 pl-2 border-l border-amber-200">
                              {s.name}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}