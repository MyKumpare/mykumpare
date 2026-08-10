import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Check, Plus, AlertTriangle, X, Library } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { findQuestionDuplicate } from "./questionBankSimilarity";
import { toast } from "@/components/ui/use-toast";

/**
 * Picker modal for the Question Bank.
 * - Browse / search / filter-by-category the saved questions.
 * - Select questions and insert them into the template as Sections (top-level
 *   stages) or as Questions (sub-stages under a chosen section).
 * - Add a brand-new question to the bank inline (with duplicate validation).
 *
 * Props:
 *   open, onClose
 *   stages — current template stages (for the "insert under section" dropdown)
 *   onInsert — (questions: Array, mode: "sections" | "questions", targetStageId?: string) => void
 *   sectionLabel — "Section" | "Stage" (display only)
 */
export default function QuestionBankPickerModal({ open, onClose, stages = [], onInsert, sectionLabel = "Section" }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [selected, setSelected] = useState([]); // ids
  const [mode, setMode] = useState("sections");
  const [targetStageId, setTargetStageId] = useState("");

  // Inline "add to bank" form
  const [newText, setNewText] = useState("");
  const [newCategories, setNewCategories] = useState([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [dupMatch, setDupMatch] = useState(null);

  const { data: questions = [] } = useQuery({
    queryKey: ["question_bank"],
    queryFn: () => base44.entities.QuestionBank.list("-created_date"),
    enabled: open,
  });

  const categories = useMemo(() => {
    const set = new Set();
    questions.forEach((q) => (q.categories || []).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [questions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return questions.filter((item) => {
      if (activeCategory && !(item.categories || []).includes(activeCategory)) return false;
      if (!q) return true;
      return item.question_text.toLowerCase().includes(q);
    });
  }, [questions, search, activeCategory]);

  const namedStages = useMemo(() => stages.filter((s) => (s.name || "").trim()), [stages]);

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const createMutation = useMutation({
    mutationFn: (payload) => base44.entities.QuestionBank.create({ ...payload, tenant_id: user?.linked_firm_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question_bank"] });
    },
  });

  const addCategoryTag = (raw) => {
    const c = (raw || "").trim();
    if (!c) return;
    if (!newCategories.includes(c)) setNewCategories([...newCategories, c]);
    setCategoryInput("");
  };

  const handleAddNew = (force = false) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    if (!force) {
      const dup = findQuestionDuplicate(trimmed, questions);
      if (dup) { setDupMatch(dup); return; }
    }
    createMutation.mutate(
      { question_text: trimmed, categories: newCategories, created_by_name: user?.full_name || "" },
      {
        onSuccess: () => {
          toast({ title: "Added to Question Bank", description: `"${trimmed}" has been saved.` });
          setNewText("");
          setNewCategories([]);
          setCategoryInput("");
          setDupMatch(null);
        },
        onError: (err) => {
          toast({ title: "Failed to add question", description: err?.message || "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleInsert = () => {
    const chosen = questions.filter((q) => selected.includes(q.id));
    if (chosen.length === 0) return;
    if (mode === "questions" && !targetStageId) {
      toast({ title: "Select a section", description: `Choose a ${sectionLabel.toLowerCase()} to insert the questions into.`, variant: "destructive" });
      return;
    }
    onInsert(chosen, mode, targetStageId || null);
    setSelected([]);
    toast({ title: "Inserted from Question Bank", description: `${chosen.length} question${chosen.length === 1 ? "" : "s"} added.` });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setSelected([]); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Library className="w-4 h-4 text-cyan-600" /> Question Bank
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              autoFocus
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`text-[10px] px-2 py-0.5 rounded border ${activeCategory === null ? "bg-cyan-600 text-white border-cyan-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCategory(c)}
                  className={`text-[10px] px-2 py-0.5 rounded border ${activeCategory === c ? "bg-cyan-600 text-white border-cyan-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Questions list */}
          <div className="border border-gray-200 rounded-md max-h-[260px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-gray-400">
                {questions.length === 0 ? "No questions in the bank yet. Add one below." : "No questions match your search."}
              </div>
            ) : (
              filtered.map((q) => {
                const isSel = selected.includes(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => toggleSelect(q.id)}
                    className={`flex items-start gap-2 w-full text-left px-3 py-2 border-b last:border-b-0 ${isSel ? "bg-cyan-50" : "hover:bg-gray-50"}`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSel ? "bg-cyan-600 border-cyan-600" : "border-gray-300"}`}>
                      {isSel && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800">{q.question_text}</p>
                      {(q.categories || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(q.categories || []).map((c) => (
                            <span key={c} className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Insert controls */}
          {selected.length > 0 && (
            <div className="rounded-md border border-cyan-200 bg-cyan-50/40 p-2.5 space-y-2">
              <div className="text-xs font-medium text-gray-700">{selected.length} selected — insert as:</div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="radio" checked={mode === "sections"} onChange={() => setMode("sections")} />
                  New {sectionLabel}s
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="radio" checked={mode === "questions"} onChange={() => setMode("questions")} />
                  Questions under a {sectionLabel}:
                </label>
                {mode === "questions" && (
                  <select
                    value={targetStageId}
                    onChange={(e) => setTargetStageId(e.target.value)}
                    className="h-7 text-xs border border-gray-200 rounded px-1 flex-1"
                  >
                    <option value="">Select {sectionLabel}...</option>
                    {namedStages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Add new question to bank */}
          <div className="rounded-md border border-gray-200 bg-gray-50/50 p-2.5 space-y-2">
            <div className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add a new question to the bank
            </div>
            <Input
              placeholder="Question text..."
              value={newText}
              onChange={(e) => { setNewText(e.target.value); setDupMatch(null); }}
              className="h-8 text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {newCategories.map((c) => (
                <Badge key={c} variant="secondary" className="gap-1">
                  {c}
                  <button type="button" onClick={() => setNewCategories(newCategories.filter((x) => x !== c))}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategoryTag(categoryInput); } }}
                placeholder="Category (press Enter)..."
                className="h-8 text-sm flex-1"
              />
              <Button type="button" size="sm" className="h-8 text-xs" disabled={!newText.trim() || createMutation.isPending} onClick={() => handleAddNew(false)}>
                Add to Bank
              </Button>
            </div>
            {dupMatch && (
              <div className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-800">
                    Similar to <strong>"{dupMatch.question_text}"</strong>. Add anyway?
                  </p>
                  <div className="flex gap-1.5 mt-1">
                    <Button size="sm" className="h-6 text-xs" onClick={() => handleAddNew(true)}>Add anyway</Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDupMatch(null)}>Reject</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { onClose(); setSelected([]); }}>
            Cancel
          </Button>
          <Button type="button" disabled={selected.length === 0} onClick={handleInsert}>
            Insert {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}