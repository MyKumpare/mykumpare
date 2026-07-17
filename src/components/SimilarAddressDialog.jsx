import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { formatAddress } from "./addressDuplicateCheck";

// Confirmation dialog shown when similar (but not exact) addresses are
// detected during save. For each similar pair the user chooses to keep both
// as separate addresses or merge by removing the duplicate.
//
// pairs: [{ i, j, ai, aj }]
// onResolve: (removeIndices: number[]) => void
export default function SimilarAddressDialog({ open, onOpenChange, pairs, onResolve }) {
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    if (open) {
      const init = {};
      (pairs || []).forEach((p) => { init[`${p.i}-${p.j}`] = "keep"; });
      setDecisions(init);
    }
  }, [open, pairs]);

  const handleConfirm = () => {
    const removeIndices = new Set();
    (pairs || []).forEach((p) => {
      if (decisions[`${p.i}-${p.j}`] === "merge") removeIndices.add(p.j);
    });
    onResolve(Array.from(removeIndices));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Similar addresses found
          </DialogTitle>
          <DialogDescription>
            Some addresses look similar to each other. Choose whether to keep them as separate addresses or merge the duplicate into the existing one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
          {(pairs || []).map((p) => {
            const key = `${p.i}-${p.j}`;
            return (
              <div key={key} className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="space-y-1 text-xs">
                  <p>
                    <span className="font-semibold text-gray-600">Address #{p.i + 1}: </span>
                    <span className="text-gray-800">{formatAddress(p.ai) || "(empty)"}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-gray-600">Address #{p.j + 1}: </span>
                    <span className="text-gray-800">{formatAddress(p.aj) || "(empty)"}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={decisions[key] === "keep" ? "default" : "outline"}
                    onClick={() => setDecisions((d) => ({ ...d, [key]: "keep" }))}
                    className="h-7 text-xs"
                  >
                    Keep both
                  </Button>
                  <Button
                    size="sm"
                    variant={decisions[key] === "merge" ? "default" : "outline"}
                    onClick={() => setDecisions((d) => ({ ...d, [key]: "merge" }))}
                    className="h-7 text-xs"
                  >
                    Merge (remove #{p.j + 1})
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}