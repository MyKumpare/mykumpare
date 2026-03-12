import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation } from "@tanstack/react-query";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

export default function QuickAddFirmForm({ onFirmCreated, onCancel }) {
  const [name, setName] = useState("");
  const [firmType, setFirmType] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Firm.create(data),
    onSuccess: (newFirm) => {
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      onFirmCreated(newFirm);
    },
  });

  const handleSubmit = () => {
    if (!name.trim() || !firmType) return;
    createMutation.mutate({ name: name.trim(), firm_type: firmType });
  };

  return (
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
          onClick={handleSubmit}
        >
          {createMutation.isPending ? "Saving..." : "Save Firm"}
        </Button>
      </div>
    </div>
  );
}