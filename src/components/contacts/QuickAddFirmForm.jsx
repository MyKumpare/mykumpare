import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { findFirmNameDuplicates } from "../firms/firmNameDuplicateCheck";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

export default function QuickAddFirmForm({ onFirmCreated, onCancel }) {
  const [name, setName] = useState("");
  const [firmType, setFirmType] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: existingFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });

  const liveDuplicates = useMemo(() => {
    if (name.trim().length < 3) return [];
    return findFirmNameDuplicates(name.trim(), existingFirms).slice(0, 3);
  }, [name, existingFirms]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Firm.create(data),
    onSuccess: (newFirm) => {
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      onFirmCreated(newFirm);
    },
  });

  const handleSubmit = (force = false) => {
    if (!name.trim() || !firmType) return;
    if (!force && name.trim().length >= 2) {
      const dups = findFirmNameDuplicates(name.trim(), existingFirms);
      if (dups.length > 0) {
        setDuplicateWarning(dups);
        return;
      }
    }
    createMutation.mutate({ name: name.trim(), firm_type: firmType, tenant_id: user?.linked_firm_id });
  };

  return (
    <>
      <div className="p-3 space-y-2.5 bg-indigo-50/50 border-t">
        <div className="text-xs font-semibold text-indigo-700">New Firm</div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Firm Name *</Label>
          <Input
            autoFocus
            placeholder="Enter firm name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm bg-white"
          />
          {liveDuplicates.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-1.5 space-y-0.5">
              <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {liveDuplicates.length} potential duplicate{liveDuplicates.length > 1 ? "s" : ""} found
              </p>
              <ul className="space-y-0.5">
                {liveDuplicates.map((d) => (
                  <li key={d.firm.id} className="text-xs text-gray-700 flex items-start gap-1">
                    {d.score === 1
                      ? <span className="text-red-600 font-medium">● Exact:</span>
                      : <span className="text-amber-600 font-medium">○ Near:</span>}
                    <span className="font-medium">{d.firm.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Firm Type *</Label>
          <Select value={firmType} onValueChange={setFirmType}>
            <SelectTrigger className="h-8 text-sm bg-white">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {FIRM_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={!name.trim() || !firmType || createMutation.isPending}
            onClick={() => handleSubmit()}
          >
            {createMutation.isPending ? "Saving..." : "Save Firm"}
          </Button>
        </div>
      </div>

      {duplicateWarning && (
        <Dialog open={true} onOpenChange={() => setDuplicateWarning(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {duplicateWarning.some((d) => d.score === 1) ? "Duplicate Firm Name Found" : "Similar Firm Name Found"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600">
                {duplicateWarning.some((d) => d.score === 1)
                  ? "A firm with an exact matching name already exists. Please review before proceeding."
                  : "A firm with a similar name already exists. Would you like to add this firm anyway?"}
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {duplicateWarning.map((d) => {
                  const f = d.firm;
                  const types = f.firm_types?.length ? f.firm_types : (f.firm_type ? [f.firm_type] : []);
                  const isExact = d.score === 1;
                  return (
                    <div key={f.id} className={`rounded-lg border p-3 ${isExact ? "border-red-300 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-gray-800">{f.name}</p>
                        {isExact ? (
                          <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded">Exact Match</span>
                        ) : (
                          <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Near Match</span>
                        )}
                      </div>
                      {types.length > 0 && <p className="text-xs text-gray-500 mt-0.5">{types.join(", ")}</p>}
                      <p className="text-xs text-gray-600 mt-1">{d.reasons.join(" ")}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateWarning(null)}>Cancel</Button>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setDuplicateWarning(null); handleSubmit(true); }}>
                Add Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}