import React, { useState, useMemo, useRef, useEffect } from "react";
import { Check, X, Plus, ChevronDown, AlertTriangle, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

// Simple similarity check
function areSimilar(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  if (s1 === s2 + "s" || s2 === s1 + "s") return true;
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  return maxLength > 3 && distance / maxLength < 0.2;
}

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export default function ActivityCategoryPicker({ value = [], onChange, placeholder = "Select categories..." }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [similarCategories, setSimilarCategories] = useState([]);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const ref = useRef(null);

  const { data: allCategories = [], refetch } = useQuery({
    queryKey: ["all_activity_categories"],
    queryFn: async () => {
      const types = await base44.entities.ActivityType.list();
      return types.map(t => t.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return allCategories;
    return allCategories.filter(s => s.toLowerCase().includes(search.toLowerCase()));
  }, [allCategories, search]);

  const handleToggleCategory = (category) => {
    if (value.includes(category)) {
      onChange(value.filter(c => c !== category));
    } else {
      onChange([...value, category]);
    }
  };

  const checkSimilarity = (category) => {
    return allCategories.filter(existing => areSimilar(category, existing));
  };

  const handleAddNewAttempt = () => {
    if (!newCategory.trim()) return;
    const exactMatch = allCategories.find(s => s.toLowerCase().trim() === newCategory.toLowerCase().trim());
    if (exactMatch) {
      alert(`Category "${exactMatch}" already exists. Please select it from the list instead.`);
      return;
    }
    const similar = checkSimilarity(newCategory);
    if (similar.length > 0) {
      setSimilarCategories(similar);
      setShowWarning(true);
    } else {
      finalizeAddNew();
    }
  };

  const finalizeAddNew = async () => {
    const trimmedCategory = newCategory.trim();
    try {
      await base44.entities.ActivityType.create({ name: trimmedCategory });
      refetch();
    } catch (error) {
      console.error("Failed to save category:", error);
      toast({ title: "Failed to save category", description: error.message || "Could not save this category.", variant: "destructive" });
    }
    onChange([...value, trimmedCategory]);
    setAddingNew(false);
    setNewCategory("");
    setSearch("");
    setOpen(false);
  };

  const handleWarningConfirm = () => {
    setShowWarning(false);
    setSimilarCategories([]);
    finalizeAddNew();
  };

  const handleWarningCancel = () => {
    setShowWarning(false);
    setSimilarCategories([]);
  };

  const handleUseExisting = (category) => {
    if (!value.includes(category)) {
      onChange([...value, category]);
    }
    setShowWarning(false);
    setSimilarCategories([]);
    setAddingNew(false);
    setNewCategory("");
    setOpen(false);
  };

  const handleDeleteCategory = async (categoryToDelete) => {
    try {
      const types = await base44.entities.ActivityType.list();
      const typeRecord = types.find(t => t.name === categoryToDelete);
      if (typeRecord) {
        await base44.entities.ActivityType.delete(typeRecord.id);
        refetch();
        if (value.includes(categoryToDelete)) {
          onChange(value.filter(c => c !== categoryToDelete));
        }
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
    setDeletingCategory(null);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Selected categories display */}
      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          {value.map(cat => (
            <span key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700">
              {cat}
              <button type="button" onClick={() => handleToggleCategory(cat)} className="text-indigo-300 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between h-8 px-3 rounded-lg border text-xs transition-colors bg-white ${
          open ? "border-indigo-400" : "border-gray-200 hover:border-indigo-300"
        }`}
      >
        <span className={`truncate ${value.length > 0 ? "text-gray-400" : ""}`}>
          {value.length > 0 ? "Change categories..." : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {addingNew && !showWarning ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => setAddingNew(false)} className="text-gray-400 hover:text-gray-600">
                  <ChevronDown className="w-3 h-3 rotate-90" />
                </button>
                <p className="text-xs font-semibold text-gray-700">Add New Category</p>
              </div>
              <Input
                autoFocus
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Enter category..."
                className="h-8 text-sm"
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddNewAttempt();
                  if (e.key === "Escape") setAddingNew(false);
                }}
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setAddingNew(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNewAttempt}
                  disabled={!newCategory.trim()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Add Category
                </button>
              </div>
            </div>
          ) : showWarning ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-800">Similar Categories Found</h4>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {similarCategories.map((category, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-sm text-amber-900">{category}</span>
                    <button type="button" onClick={() => handleUseExisting(category)} className="text-xs text-amber-700 hover:text-amber-900 hover:underline">
                      Use this instead
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600">
                Did you mean one of the above? Or you can add "<span className="font-semibold">{newCategory}</span>" as a new category.
              </p>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleWarningCancel}>
                  Cancel & Edit
                </Button>
                <Button type="button" size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleWarningConfirm}>
                  Add Anyway
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Search input */}
              <div className="p-2 border-b border-gray-100">
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
                />
              </div>

              {/* Content */}
              <div className="max-h-56 overflow-y-auto">
                {filteredCategories.length === 0 ? (
                  <div className="px-3 py-3 space-y-1">
                    <p className="text-xs text-gray-400 italic text-center">
                      {search ? "No categories found" : "No categories yet"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setAddingNew(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add new category
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1 p-2">
                      {filteredCategories.map(category => {
                        const isSelected = value.includes(category);
                        return (
                          <div
                            key={category}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors border border-gray-100 hover:bg-gray-50"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleCategory(category)}
                              className={`flex-1 flex items-center gap-2 ${
                                isSelected ? "text-indigo-700" : "text-gray-700"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span className="truncate">{category}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDeletingCategory(category); }}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                              title="Delete this category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-2 py-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setAddingNew(true)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add new category
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Delete confirmation dialog */}
          {deletingCategory && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-xl p-4 w-[90%] max-w-xs mx-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h4 className="text-sm font-semibold text-gray-800">Delete Category?</h4>
                </div>
                <p className="text-xs text-gray-600 mb-4">
                  Are you sure you want to delete "<span className="font-semibold">{deletingCategory}</span>"? This action cannot be undone.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeletingCategory(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDeleteCategory(deletingCategory)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}