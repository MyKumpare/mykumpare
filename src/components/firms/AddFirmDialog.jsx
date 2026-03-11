import React, { useState, useEffect, useRef } from "react";
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
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (editingFirm) {
      setFirmType(editingFirm.firm_type);
      setFirmName(editingFirm.name);
    } else {
      setFirmType(preselectedType || "");
      setFirmName("");
    }
  }, [editingFirm, preselectedType, open]);

  useEffect(() => {
    if (open && preselectedType && !editingFirm) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [open, preselectedType, editingFirm]);

  const isDuplicate = firmName.trim().length > 0 &&
    existingFirms.some((f) => {
      if (f.id === editingFirm?.id) return false;
      const existing = f.name.toLowerCase();
      const input = firmName.trim().toLowerCase();
      return existing.includes(input) || input.includes(existing);
    });

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
            {preselectedType && !editingFirm ? (
              <div className="h-11 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700 font-medium">
                {firmType}
              </div>
            ) : (
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
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Firm Name</Label>
            <Input
              placeholder="Enter firm name..."
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              className={`h-11 ${isDuplicate ? "border-red-400 focus-visible:ring-red-400" : ""}`}
              onKeyDown={(e) => e.key === "Enter" && isValid && handleSubmit()}
            />
            {isDuplicate && (
              <p className="text-sm text-red-500 mt-1">The Firm is Already in the System.</p>
            )}
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