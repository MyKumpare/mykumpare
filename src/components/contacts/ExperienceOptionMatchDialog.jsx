import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { fetchExperienceOptionLists, buildExperienceConflicts } from "./experienceOptionMatch";

/**
 * Reviews extracted experience items against the global company / job-title
 * master lists. For each fuzzy or exact match, the user chooses to accept an
 * existing entry (replace) or reject (keep the new value). When there are no
 * conflicts, resolves immediately with the original items.
 */
export default function ExperienceOptionMatchDialog({ open, onOpenChange, items, onResolve }) {
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [choices, setChoices] = useState({}); // conflictIndex -> 'new' | existingName

  useEffect(() => {
    if (!open || !items || items.length === 0) return;
    let active = true;
    setLoading(true);
    setConflicts([]);
    setChoices({});
    fetchExperienceOptionLists()
      .then(({ companyNames, titleNames }) => {
        if (!active) return;
        const found = buildExperienceConflicts(items, companyNames, titleNames);
        setConflicts(found);
        const initial = {};
        found.forEach((_, i) => { initial[i] = "new"; });
        setChoices(initial);
        setLoading(false);
        if (found.length === 0) onResolve(items);
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, items]);

  const handleApply = () => {
    const resolved = items.map((item) => ({ ...item }));
    conflicts.forEach((c, i) => {
      const choice = choices[i];
      if (choice && choice !== "new") {
        resolved[c.itemIndex][c.field] = choice;
      }
    });
    onResolve(resolved);
  };

  const handleKeepAllNew = () => onResolve(items);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Review Company / Title Matches
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : conflicts.length === 0 ? null : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-gray-600">
              Some extracted entries match existing company names or titles in the system.
              Choose whether to use the existing entry or keep the new one.
            </p>
            {conflicts.map((c, i) => (
              <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-xs font-medium text-amber-800">
                  {c.field === "company_name" ? "Company" : "Title"}:{" "}
                  <span className="font-semibold">"{c.newValue}"</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setChoices((p) => ({ ...p, [i]: "new" }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${choices[i] === "new" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                  >
                    Keep new: "{c.newValue}"
                  </button>
                  {c.matches.map((m, mi) => (
                    <button
                      key={mi}
                      type="button"
                      onClick={() => setChoices((p) => ({ ...p, [i]: m.name }))}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${choices[i] === m.name ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                    >
                      Use: {m.name} <span className="opacity-60">({Math.round(m.score * 100)}%)</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && conflicts.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={handleKeepAllNew}>Keep all new</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleApply}>Apply</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}