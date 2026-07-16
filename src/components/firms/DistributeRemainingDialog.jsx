import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function DistributeRemainingDialog({ open, onOpenChange, owners = [], remaining = 0, onConfirm }) {
  const [selected, setSelected] = useState({}); // { [ownerId]: bool }
  const [weights, setWeights] = useState({}); // { [ownerId]: number }

  useEffect(() => {
    if (open && owners.length > 0) {
      const share = +(remaining / owners.length).toFixed(2);
      const sel = {};
      const w = {};
      owners.forEach((o) => {
        sel[o.id] = true;
        w[o.id] = share;
      });
      setSelected(sel);
      setWeights(w);
    }
  }, [open, owners, remaining]);

  const enteredTotal = owners
    .filter((o) => selected[o.id])
    .reduce((sum, o) => sum + (parseFloat(weights[o.id]) || 0), 0);
  const left = remaining - enteredTotal;

  const handleConfirm = () => {
    const additions = {};
    owners.forEach((o) => {
      const val = parseFloat(weights[o.id]) || 0;
      if (selected[o.id] && val > 0) additions[o.id] = val;
    });
    onConfirm(additions);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Distribute remaining weights</DialogTitle>
          <DialogDescription>
            Remaining to allocate: <strong>{remaining.toFixed(2)}%</strong>. Select which owners receive the remaining weights and enter the amount for each.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {owners.map((o) => {
            const isSel = !!selected[o.id];
            return (
              <div
                key={o.id}
                className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${isSel ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-gray-50"}`}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => setSelected((prev) => ({ ...prev, [o.id]: !prev[o.id] }))}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={o.contact_photo_url} alt={o.contact_full_name} />
                  <AvatarFallback className="text-xs">{o.contact_full_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 min-w-0 truncate text-xs font-medium text-gray-700">{o.contact_full_name}</span>
                <span className="text-xs text-gray-400">+</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={weights[o.id] ?? 0}
                  disabled={!isSel}
                  onChange={(e) => setWeights((prev) => ({ ...prev, [o.id]: e.target.value }))}
                  className="h-8 w-20 text-xs text-right"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            );
          })}
        </div>

        <div className={`text-xs font-medium ${left === 0 ? "text-green-600" : left < 0 ? "text-red-600" : "text-amber-600"}`}>
          Entered: {enteredTotal.toFixed(2)}% ·{" "}
          {left === 0
            ? "Fully allocated"
            : left < 0
            ? `${Math.abs(left).toFixed(2)}% over remaining`
            : `${left.toFixed(2)}% still unallocated`}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleConfirm}
            disabled={Object.keys(selected).filter((id) => selected[id] && (parseFloat(weights[id]) || 0) > 0).length === 0}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}