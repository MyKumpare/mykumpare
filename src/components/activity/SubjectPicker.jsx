import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, AlertTriangle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Levenshtein distance for similarity check
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function isSimilar(str1, str2, threshold = 2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  return levenshtein(s1, s2) <= threshold;
}

export default function SubjectPicker({ value = [], onChange, placeholder = "Select subjects..." }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [similarMatch, setSimilarMatch] = useState(null);
  const ref = useRef(null);

  const { data: subjects = [], refetch } = useQuery({
    queryKey: ["activity_subjects"],
    queryFn: () => base44.entities.ActivitySubject.list(),
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.toLowerCase();
    return subjects.filter(s => s.name.toLowerCase().includes(q));
  }, [subjects, search]);

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.ActivitySubject.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity_subjects"] });
      refetch();
    },
  });

  const handleSelect = (subject) => {
    if (!value.includes(subject.name)) {
      onChange([...value, subject.name]);
    }
    setSearch("");
  };

  const handleRemove = (subjectName) => {
    onChange(value.filter(s => s !== subjectName));
  };

  const handleAddNew = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;

    // Check for exact duplicate
    const exactMatch = subjects.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
    if (exactMatch) {
      if (!value.includes(exactMatch.name)) {
        onChange([...value, exactMatch.name]);
      }
      setAddingNew(false);
      setNewSubject("");
      return;
    }

    // Check for similar matches
    const similar = subjects.find(s => isSimilar(s.name, trimmed));
    if (similar) {
      setSimilarMatch(similar);
      return;
    }

    // No conflicts - create new
    createMutation.mutate(trimmed, {
      onSuccess: () => {
        onChange([...value, trimmed]);
        setAddingNew(false);
        setNewSubject("");
      }
    });
  };

  const confirmSimilarAdd = () => {
    const trimmed = newSubject.trim();
    createMutation.mutate(trimmed, {
      onSuccess: () => {
        onChange([...value, trimmed]);
        setAddingNew(false);
        setNewSubject("");
        setSimilarMatch(null);
      }
    });
  };

  return (
    <div className="space-y-2" ref={ref}>
      {/* Selected badges */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(subject => (
            <Badge key={subject} variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              {subject}
              <button type="button" onClick={() => handleRemove(subject)} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between h-8 px-2.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors bg-white"
      >
        <span>{value.length > 0 ? `${value.length} selected` : placeholder}</span>
        <Plus className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subjects..."
              className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
            />
          </div>

          {/* Results */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && !addingNew && (
              <div className="p-3 space-y-2">
                <p className="text-xs text-gray-400 italic text-center">No subjects found</p>
                <button
                  type="button"
                  onClick={() => setAddingNew(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add "{search || "new subject"}"
                </button>
              </div>
            )}

            {filtered.map(subject => {
              const selected = value.includes(subject.name);
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => handleSelect(subject)}
                  disabled={selected}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                    selected ? "bg-gray-50 text-gray-400 cursor-default" : "hover:bg-indigo-50 text-gray-700"
                  }`}
                >
                  <span className="font-medium">{subject.name}</span>
                  {selected && <Check className="w-3 h-3 text-green-500" />}
                </button>
              );
            })}

            {filtered.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setAddingNew(true); setSearch(""); }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add new subject
                </button>
              </div>
            )}
          </div>

          {/* Add new form */}
          {addingNew && (
            <div className="p-3 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">New Subject</p>
              <Input
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                className="h-8 text-xs mb-2"
                placeholder="Enter subject name..."
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setAddingNew(false); setNewSubject(""); }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={!newSubject.trim() || createMutation.isPending}
                  onClick={handleAddNew}
                >
                  {createMutation.isPending ? "Adding..." : "Add Subject"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Similar match confirmation dialog */}
      <Dialog open={!!similarMatch} onOpenChange={() => setSimilarMatch(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Similar Subject Exists
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-xs text-gray-600">
              A similar subject "<strong>{similarMatch?.name}</strong>" already exists.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Do you want to add "<strong>{newSubject.trim()}</strong>" anyway?
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setSimilarMatch(null); setAddingNew(false); setNewSubject(""); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={confirmSimilarAdd}
            >
              Add Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}