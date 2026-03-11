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
import { Pencil } from "lucide-react";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

export default function AddFirmDialog({ open, onOpenChange, onSubmit, onDelete, editingFirm, preselectedType, existingFirms = [] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [firmType, setFirmType] = useState("");
  const [firmName, setFirmName] = useState("");
  const nameInputRef = useRef(null);

  const isAddMode = !editingFirm;

  useEffect(() => {
    if (open) {
      if (editingFirm) {
        setFirmType(editingFirm.firm_type);
        setFirmName(editingFirm.name);
        setIsEditing(false); // always open in view mode when editing
      } else {
        setFirmType(preselectedType || "");
        setFirmName("");
        setIsEditing(true); // add mode is always in edit mode
      }
    }
  }, [editingFirm, preselectedType, open]);

  useEffect(() => {
    if (open && preselectedType && !editingFirm) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [open, preselectedType, editingFirm]);

  useEffect(() => {
    if (isEditing && editingFirm) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isEditing]);

  const hasChanges = editingFirm
    ? firmName.trim() !== editingFirm.name || firmType !== editingFirm.firm_type
    : false;

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

  const handleClose = () => {
    onOpenChange(false);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    // Reset to original values
    setFirmType(editingFirm.firm_type);
    setFirmName(editingFirm.name);
    setIsEditing(false);
  };

  const isValid = firmType && firmName.trim() && !isDuplicate;
  const activelyEditing = isAddMode || isEditing;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-xl font-semibold">
              {isAddMode ? "Add Firm" : "Firm Details"}
            </DialogTitle>
            {!isAddMode && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1.5"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Firm Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Type of Firm</Label>
            {!activelyEditing || (preselectedType && !editingFirm) ? (
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

          {/* Firm Name */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Firm Name</Label>
            {!activelyEditing ? (
              <div className="h-11 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-900 font-medium">
                {firmName}
              </div>
            ) : (
              <>
                <Input
                  ref={nameInputRef}
                  placeholder="Enter firm name..."
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  className={`h-11 ${isDuplicate ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                  onKeyDown={(e) => e.key === "Enter" && isValid && handleSubmit()}
                  spellCheck={true}
                  autoCorrect="on"
                  autoCapitalize="words"
                  lang="en"
                />
                {isDuplicate && (
                  <p className="text-sm text-red-500 mt-1">The Firm is Already in the System.</p>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {/* Left: Delete */}
          <div>
            {editingFirm && onDelete && (
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 w-full sm:w-auto"
                onClick={() => { handleClose(); onDelete(editingFirm); }}
              >
                Delete Firm
              </Button>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex gap-2 justify-end">
            {isEditing && !isAddMode ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!isValid || !hasChanges}
                  className={`text-white transition-all ${hasChanges && isValid ? "bg-indigo-600 hover:bg-indigo-700 shadow-md" : "bg-indigo-300"}`}
                >
                  Save Changes
                </Button>
              </>
            ) : isAddMode ? (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!isValid}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Add Firm
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}