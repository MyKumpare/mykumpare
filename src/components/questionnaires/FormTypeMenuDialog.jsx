import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus, AlertTriangle, Loader2, FileText } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { findFormTypeDuplicates } from "./formTypeSimilarity";

// The built-in form type that always exists (not stored in the DB).
const DEFAULT_FORM_TYPES = [
  { id: "__questionnaire__", name: "Questionnaire", isDefault: true },
];

/**
 * Menu dialog shown when the user clicks "+ Add" in the Forms picker.
 * Lets the user pick which form type to open, or add a new form type.
 * Adding a new form type runs duplicate validation; near-matches must be
 * accepted or rejected before the new type is saved.
 *
 * Props:
 *   open, onOpenChange
 *   onSelectType: (formType) => void  — called when user picks a type to open
 *   user
 */
export default function FormTypeMenuDialog({ open, onOpenChange, onSelectType, user }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState(null);

  const { data: customTypes = [] } = useQuery({
    queryKey: ["form-types"],
    queryFn: () => base44.entities.FormType.list("-created_date", 500),
    enabled: open,
  });

  const allTypes = useMemo(
    () => [...DEFAULT_FORM_TYPES, ...customTypes.map((t) => ({ id: t.id, name: t.name, isDefault: false }))],
    [customTypes]
  );

  const sortedTypes = useMemo(
    () => [...allTypes].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [allTypes]
  );

  const handleSelect = (formType) => {
    onOpenChange(false);
    if (onSelectType) onSelectType(formType);
  };

  const startAddNew = () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: "Name required", description: "Enter a form type name.", variant: "destructive" });
      return;
    }
    const matches = findFormTypeDuplicates(name, allTypes);
    if (matches.length > 0) {
      setDuplicateMatches({ name, matches });
      return;
    }
    confirmAddNew(name);
  };

  const confirmAddNew = async (name) => {
    setAdding(true);
    try {
      const created = await base44.entities.FormType.create({
        name,
        tenant_id: user?.linked_firm_id,
      });
      queryClient.invalidateQueries({ queryKey: ["form-types"] });
      toast({ title: "Form type added", description: `"${name}" is now available.` });
      setNewName("");
      setDuplicateMatches(null);
      // Immediately open the new form type
      handleSelect({ id: created.id, name: created.name, isDefault: false });
    } catch (err) {
      toast({ title: "Failed to add form type", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const acceptDuplicate = () => {
    if (duplicateMatches) confirmAddNew(duplicateMatches.name);
  };

  const rejectDuplicate = () => {
    setDuplicateMatches(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setNewName(""); setDuplicateMatches(null); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-violet-500" />
            New Form
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Label className="text-xs text-gray-500">Choose a form type</Label>
          <div className="grid grid-cols-1 gap-2">
            {sortedTypes.map((ft) => (
              <button
                key={ft.id}
                type="button"
                onClick={() => handleSelect(ft)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-left"
              >
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">{ft.name}</span>
              </button>
            ))}
          </div>

          {/* Add new form type */}
          <div className="pt-2 border-t">
            <Label className="text-xs text-gray-500">Or add a new form type</Label>
            {!duplicateMatches ? (
              <div className="flex gap-2 mt-1.5">
                <Input
                  placeholder="Enter new form type name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") startAddNew(); }}
                  className="h-8 text-sm"
                />
                <Button type="button" size="sm" onClick={startAddNew} disabled={adding || !newName.trim()}>
                  {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add
                </Button>
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium mb-1">Possible duplicate form type</p>
                    <p>“{duplicateMatches.name}” may already exist:</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {duplicateMatches.matches.map((m) => (
                    <div key={m.formType.id} className="rounded border border-amber-200 bg-white px-2 py-1.5 text-xs">
                      <span className="font-medium text-gray-800">{m.formType.name}</span>
                      <span className="text-gray-400 ml-2">{Math.round(m.score * 100)}% match</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={rejectDuplicate} className="flex-1">
                    Reject
                  </Button>
                  <Button type="button" size="sm" onClick={acceptDuplicate} className="flex-1">
                    Accept & Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}