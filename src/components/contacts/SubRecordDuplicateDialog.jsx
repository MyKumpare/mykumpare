import React, { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, GitMerge, Trash2, Check } from "lucide-react";
import { resolveSubRecordDuplicates, summarizeSubRecord } from "./subRecordDuplicateCheck";

const TAB_LABEL = {
  education: "Education",
  experience: "Professional Experience",
  phones: "Phones",
};

export default function SubRecordDuplicateDialog({ review, onApply, onCancel }) {
  const [decisions, setDecisions] = useState({});

  const pairs = review?.pairs || [];

  const pairKey = (p) => `${p.type}::${p.aId}::${p.bId}`;

  const setDecision = (p, action) =>
    setDecisions((prev) => ({ ...prev, [pairKey(p)]: action }));

  const counts = useMemo(() => {
    const c = { accept: 0, merge: 0, delete: 0 };
    pairs.forEach((p) => {
      c[decisions[pairKey(p)] || "accept"]++;
    });
    return c;
  }, [decisions, pairs]);

  const handleApply = () => {
    const resolved = resolveSubRecordDuplicates(review.arrays, pairs, decisions);
    onApply(resolved, decisions);
  };

  return (
    <Dialog open={!!review} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Review Duplicate Records
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-gray-600">
          Possible duplicate entries were found within this contact. For each pair, choose whether to{" "}
          <strong>accept</strong> (keep both), <strong>merge</strong> (combine into one), or{" "}
          <strong>delete</strong> (remove the second entry).
        </div>

        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {pairs.map((p, idx) => {
            const key = pairKey(p);
            const action = decisions[key] || "accept";
            return (
              <div key={key} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    {TAB_LABEL[p.type]} · {p.reason}
                  </span>
                  <span className="text-xs text-gray-400">#{idx + 1}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-white border border-amber-100 p-2">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Record A</div>
                    <div className="text-gray-800">{summarizeSubRecord(p.type, p.a)}</div>
                  </div>
                  <div className="rounded-md bg-white border border-amber-100 p-2">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Record B</div>
                    <div className="text-gray-800">{summarizeSubRecord(p.type, p.b)}</div>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <Button
                    type="button" size="sm" variant={action === "accept" ? "default" : "outline"}
                    className={`h-7 text-xs flex-1 ${action === "accept" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}`}
                    onClick={() => setDecision(p, "accept")}
                  >
                    <Check className="w-3 h-3" /> Accept
                  </Button>
                  <Button
                    type="button" size="sm" variant={action === "merge" ? "default" : "outline"}
                    className={`h-7 text-xs flex-1 ${action === "merge" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                    onClick={() => setDecision(p, "merge")}
                  >
                    <GitMerge className="w-3 h-3" /> Merge
                  </Button>
                  <Button
                    type="button" size="sm" variant={action === "delete" ? "default" : "outline"}
                    className={`h-7 text-xs flex-1 ${action === "delete" ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                    onClick={() => setDecision(p, "delete")}
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="pt-2 border-t">
          <div className="text-xs text-gray-400 mr-auto">
            {counts.accept} accept · {counts.merge} merge · {counts.delete} delete
          </div>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}