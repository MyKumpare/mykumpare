import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

export default function AddFirmDialog({ open, onOpenChange, onSubmit, editingFirm, preselectedType, existingFirms = [] }) {
  const [firmType, setFirmType] = useState(editingFirm?.firm_type || "");
  const [firmName, setFirmName] = useState(editingFirm?.name || "");

  useEffect(() => {
    if (editingFirm) {
      setFirmType(editingFirm.firm_type);
      setFirmName(editingFirm.name);
    } else {
      setFirmType(preselectedType || "");
      setFirmName("");
    }
  }, [editingFirm, preselectedType, open]);

  const isDuplicate = firmName.trim() &&
    existingFirms.some(
      (f) => f.name.toLowerCase() === firmName.trim().toLowerCase() && f.id !== editingFirm?.id
    );

  const handleSubmit = () => {
    if (!firmType || !firmName.trim() || isDuplicate) return;
    onSubmit({ firm_type: firmType, name: firmName.trim() });
    setFirmType("");
    setFirmName("");
  };

  const isValid = firmType && firmName.trim() && !isDuplicate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {editingFirm ? "Edit Firm" : "Add Firm"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Type of Firm</Label>
            <Select value={firmType} onValueChange={setFirmType}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select firm type..." />
              </SelectTrigger>
              <SelectContent>
                {FIRM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Firm Name</Label>
            <Input
              placeholder="Enter firm name..."
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              className="h-11"
              onKeyDown={(e) => e.key === "Enter" && isValid && handleSubmit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {editingFirm ? "Save Changes" : "Add Firm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}