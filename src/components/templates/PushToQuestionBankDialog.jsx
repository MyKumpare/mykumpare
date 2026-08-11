import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Plus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { findQuestionDuplicate } from "./questionBankSimilarity";
import { toast } from "@/components/ui/use-toast";
import CategoryCombobox from "./CategoryCombobox";

/**
 * Dialog for pushing a question (e.g. a stage/sub-stage name) into the
 * Question Bank. Performs duplicate validation: if the text is an exact or
 * near-duplicate of an existing bank question, the user is prompted to
 * Accept (add anyway) or Reject (cancel).
 *
 * Props:
 *   open, onOpenChange
 *   initialText — pre-filled question text (e.g. from a stage/sub-stage)
 *   initialCategories — optional array of pre-assigned categories
 */
export default function PushToQuestionBankDialog({ open, onOpenChange, initialText = "", initialCategories = [] }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [categories, setCategories] = useState([]);
  const [duplicate, setDuplicate] = useState(null);

  useEffect(() => {
    if (open) {
      setText(initialText || "");
      setCategories(Array.isArray(initialCategories) ? [...initialCategories] : []);
      setDuplicate(null);
    }
  }, [open, initialText, initialCategories]);

  const { data: existing = [] } = useQuery({
    queryKey: ["question_bank"],
    queryFn: () => base44.entities.QuestionBank.list("-created_date"),
    enabled: open,
  });

  const allCategories = useMemo(() => {
    const set = new Set();
    existing.forEach((q) => (q.categories || []).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [existing]);

  const createMutation = useMutation({
    mutationFn: (payload) => base44.entities.QuestionBank.create({ ...payload, tenant_id: user?.linked_firm_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question_bank"] });
    },
  });

  const handleSubmit = (force = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!force) {
      const dup = findQuestionDuplicate(trimmed, existing);
      if (dup) {
        setDuplicate(dup);
        return;
      }
    }
    createMutation.mutate(
      { question_text: trimmed, categories, created_by_name: user?.full_name || "" },
      {
        onSuccess: () => {
          toast({ title: "Added to Question Bank", description: `"${trimmed}" has been saved.` });
          onOpenChange(false);
        },
        onError: (err) => {
          toast({ title: "Failed to add question", description: err?.message || "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Push to Question Bank</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qb-text">Question Text *</Label>
            <Input
              id="qb-text"
              autoFocus
              value={text}
              onChange={(e) => { setText(e.target.value); setDuplicate(null); }}
              placeholder="Enter the question text..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categories</Label>
            <CategoryCombobox
              options={allCategories}
              selected={categories}
              onChange={setCategories}
            />
          </div>

          {duplicate && (
            <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-800">
                  This is very similar to an existing question: <strong>"{duplicate.question_text}"</strong>. Add anyway?
                </p>
                <div className="flex gap-1.5 mt-1.5">
                  <Button size="sm" className="h-6 text-xs" onClick={() => handleSubmit(true)}>
                    Add anyway
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDuplicate(null)}>
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!text.trim() || createMutation.isPending} onClick={() => handleSubmit(false)}>
            <Plus className="w-3.5 h-3.5" /> Add to Bank
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}