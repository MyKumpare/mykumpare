import React, { useState, useMemo, useRef, useEffect } from "react";
import { Check, X, Plus, ChevronDown, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Simple similarity check - returns true if strings are very similar
function areSimilar(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match (case-insensitive)
  if (s1 === s2) return true;
  
  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) return true;
  
  // Check for plural/singular variations (simple check)
  if (s1 === s2 + "s" || s2 === s1 + "s") return true;
  
  // Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  // If distance is less than 20% of length, consider similar
  return maxLength > 3 && distance / maxLength < 0.2;
}

// Levenshtein distance algorithm
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  
  return dp[m][n];
}

// Activity type picker with search-as-you-type and add-new functionality
export default function ActivityTypePicker({ value = "", onChange, placeholder = "Select type..." }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newType, setNewType] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [similarTypes, setSimilarTypes] = useState([]);
  const ref = useRef(null);

  // Fetch all unique activity types from ContactActivity entities
  const { data: allTypes = [] } = useQuery({
    queryKey: ["all_activity_types"],
    queryFn: async () => {
      const activities = await base44.entities.ContactActivity.list();
      const types = activities
        .map(a => a.activity_type)
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i) // unique
        .sort((a, b) => a.localeCompare(b));
      return types;
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filteredTypes = useMemo(() => {
    if (!search.trim()) return allTypes;
    return allTypes.filter(s => s.toLowerCase().includes(search.toLowerCase()));
  }, [allTypes, search]);

  const handleSelectType = (type) => {
    onChange(type);
    setOpen(false);
    setSearch("");
  };

  const checkSimilarity = (type) => {
    const similar = allTypes.filter(existing => areSimilar(type, existing));
    return similar;
  };

  const handleAddNewAttempt = () => {
    if (!newType.trim()) return;
    
    // Check for exact duplicates
    const exactMatch = allTypes.find(
      s => s.toLowerCase().trim() === newType.toLowerCase().trim()
    );
    
    if (exactMatch) {
      // Exact duplicate exists - show error
      alert(`Activity type "${exactMatch}" already exists. Please select it from the list instead.`);
      return;
    }
    
    // Check for similar types
    const similar = checkSimilarity(newType);
    
    if (similar.length > 0) {
      // Show warning with similar types
      setSimilarTypes(similar);
      setShowWarning(true);
    } else {
      // No similarities - add directly
      finalizeAddNew();
    }
  };

  const finalizeAddNew = () => {
    onChange(newType.trim());
    setAddingNew(false);
    setNewType("");
    setSearch("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
  };

  const handleWarningConfirm = () => {
    setShowWarning(false);
    setSimilarTypes([]);
    finalizeAddNew();
  };

  const handleWarningCancel = () => {
    setShowWarning(false);
    setSimilarTypes([]);
    // Keep the new type input open so user can modify it
  };

  const handleUseExisting = (type) => {
    onChange(type);
    setShowWarning(false);
    setSimilarTypes([]);
    setAddingNew(false);
    setNewType("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Selected type display */}
      {value && (
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700">
            {value}
            <button type="button" onClick={handleClear} className="text-indigo-300 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
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
        <span className={`truncate ${value ? "text-gray-400" : ""}`}>
          {value ? "Change type..." : placeholder}
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
                <p className="text-xs font-semibold text-gray-700">Add New Type</p>
              </div>
              <Input
                autoFocus
                value={newType}
                onChange={e => setNewType(e.target.value)}
                placeholder="Enter type..."
                className="h-8 text-sm"
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddNewAttempt();
                  if (e.key === "Escape") setAddingNew(false);
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setAddingNew(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNewAttempt}
                  disabled={!newType.trim()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Add Type
                </button>
              </div>
            </div>
          ) : showWarning ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-800">Similar Types Found</h4>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {similarTypes.map((type, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200"
                  >
                    <span className="text-sm text-amber-900">{type}</span>
                    <button
                      type="button"
                      onClick={() => handleUseExisting(type)}
                      className="text-xs text-amber-700 hover:text-amber-900 hover:underline"
                    >
                      Use this instead
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600">
                Did you mean one of the above? Or you can add "<span className="font-semibold">{newType}</span>" as a new type.
              </p>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleWarningCancel}
                >
                  Cancel & Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={handleWarningConfirm}
                >
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
                  placeholder="Search types..."
                  className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
                />
              </div>

              {/* Content */}
              <div className="max-h-56 overflow-y-auto">
                {filteredTypes.length === 0 ? (
                  <div className="px-3 py-3 space-y-1">
                    <p className="text-xs text-gray-400 italic text-center">
                      {search ? "No types found" : "No types yet"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setAddingNew(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add new type
                    </button>
                  </div>
                ) : (
                  <>
                    {/* All types from database */}
                    <div className="space-y-1 p-2">
                      {filteredTypes.map(type => {
                        const isSelected = value === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleSelectType(type)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                              isSelected
                                ? "bg-indigo-50 border border-indigo-200 text-indigo-700"
                                : "bg-white border border-gray-100 hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                isSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="flex-1 truncate">{type}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="px-2 py-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setAddingNew(true)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add new type
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}