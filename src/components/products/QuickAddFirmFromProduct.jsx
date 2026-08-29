import React, { useState, useMemo } from "react";
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
import { AlertTriangle, Loader2, Building } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { findFirmNameDuplicates } from "@/components/firms/firmNameDuplicateCheck";
import { toast } from "@/components/ui/use-toast";

/**
 * Quick-add-firm dialog launched from the Product form when the desired
 * firm is not found in the Associated Firm dropdown.
 *
 * Follows the standard firm-creation protocol: duplicate name detection
 * (fuzzy matching via findFirmNameDuplicates) with a confirm-before-create
 * warning, then creates the firm and auto-selects it in the parent form.
 *
 * Props:
 *   open          — boolean, controls dialog visibility
 *   onOpenChange  — (open) => void
 *   firmType      — the firm type to pre-select (derived from product type)
 *   existingFirms — full firm list for duplicate checking
 *   onFirmCreated — (newFirm) => void  — called after successful creation
 */
export default function QuickAddFirmFromProduct({
  open,
  onOpenChange,
  firmType = "",
  existingFirms = [],
  onFirmCreated,
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Live duplicate check as the user types (not shown until they try to save,
  // but computed up front so the save handler can use it without a re-render race).
  const potentialDuplicates = useMemo(
    () => findFirmNameDuplicates(name, existingFirms),
    [name, existingFirms]
  );

  const reset = () => {
    setName("");
    setDuplicateWarning(null);
    setCreating(false);
  };

  const handleClose = (v) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const doCreate = async (firmName) => {
    setCreating(true);
    try {
      const newFirm = await base44.entities.Firm.create({
        name: firmName.trim(),
        firm_type: firmType,
        firm_types: [firmType],
        tenant_id: user?.linked_firm_id,
      });
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      toast({
        title: "✅ Firm created",
        description: `"${newFirm.name}" has been added and selected for this product.`,
      });
      onFirmCreated?.(newFirm);
      handleClose(false);
    } catch (err) {
      toast({
        title: "Could not create firm",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !firmType) return;
    // Standard protocol: check for duplicates before creating.
    if (potentialDuplicates.length > 0) {
      setDuplicateWarning(potentialDuplicates);
      return;
    }
    doCreate(name);
  };

  const confirmCreateAnyway = () => {
    setDuplicateWarning(null);
    doCreate(name);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              Add New Firm
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Firm type (read-only, derived from product type) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Firm Type</Label>
              <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700 font-medium">
                {firmType || "—"}
              </div>
              <p className="text-xs text-gray-400">
                Automatically set based on the product type.
              </p>
            </div>

            {/* Firm name */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Firm Name *</Label>
              <Input
                autoFocus
                placeholder="Enter firm name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim() && firmType && !creating) {
                    handleSubmit();
                  }
                }}
                className="h-9"
                spellCheck
                autoCorrect="on"
                autoCapitalize="words"
                lang="en"
              />
              {name.trim().length >= 2 && potentialDuplicates.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1">
                  <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {potentialDuplicates.length} similar firm
                    {potentialDuplicates.length > 1 ? "s" : ""} already in the
                    system
                  </p>
                  <ul className="space-y-0.5">
                    {potentialDuplicates.slice(0, 5).map((d) => (
                      <li
                        key={d.firm.id}
                        className="text-xs text-gray-700 flex items-start gap-1"
                      >
                        <span className="font-medium">{d.name}</span>
                        <span className="text-gray-500">
                          — {d.reasons.join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || !firmType || creating}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create & Select Firm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate confirmation dialog */}
      {duplicateWarning && (
        <Dialog open={true} onOpenChange={() => setDuplicateWarning(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Similar Firm Name Exists
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600">
                A firm with a similar name already exists. Would you like to
                add this firm anyway?
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {duplicateWarning.map((d) => {
                  const types = d.firm.firm_types?.length
                    ? d.firm.firm_types
                    : d.firm.firm_type
                    ? [d.firm.firm_type]
                    : [];
                  return (
                    <div
                      key={d.firm.id}
                      className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                    >
                      <p className="font-semibold text-sm text-gray-800">
                        {d.name}
                      </p>
                      {types.length > 0 && (
                        <p className="text-xs text-gray-500">
                          {types.join(", ")}
                        </p>
                      )}
                      <p className="text-xs text-amber-700 mt-1">
                        {d.reasons.join(", ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDuplicateWarning(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={confirmCreateAnyway}
              >
                Add Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}