import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Check, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULTS = {
  "Due Diligence Status": ["Pipeline", "Buy List", "Rejected"],
  "Due Diligence Process Status": ["Not Started", "In-process", "Completed"],
};

// Normalize: lowercase, trim, collapse internal whitespace
function normalize(s) {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

// Standard Levenshtein distance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Returns "exact" | "similar" | null
function checkSimilarity(input, existing) {
  const ni = normalize(input);
  const ne = normalize(existing);
  if (!ni || !ne) return null;
  if (ni === ne) return "exact";
  if (ni.includes(ne) || ne.includes(ni)) return "similar";
  const dist = levenshtein(ni, ne);
  const maxLen = Math.max(ni.length, ne.length);
  if (maxLen > 0) {
    const ratio = dist / maxLen;
    if (ratio <= 0.25 && dist <= 3) return "similar";
  }
  return null;
}

export default function StatusOptionSelect({ value, onChange, category, placeholder = "Select...", allowedOptions }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newOption, setNewOption] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: dbOptions = [] } = useQuery({
    queryKey: ["dd-status-options", category],
    queryFn: () => base44.entities.DueDiligenceStatusOption.filter({ category }, "-created_date", 500),
  });

  // Merge built-in defaults with DB-saved custom options (deduplicated, sorted)
  const allOptions = useMemo(() => {
    const defaults = DEFAULTS[category] || [];
    const set = new Set(defaults);
    dbOptions.forEach((o) => set.add(o.name));
    let opts = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (allowedOptions) {
      opts = opts.filter((o) => allowedOptions.includes(o));
    }
    return opts;
  }, [dbOptions, category, allowedOptions]);

  const filtered = useMemo(
    () => allOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [allOptions, search]
  );

  // Check the typed-in new option against all existing options
  const matchResult = useMemo(() => {
    if (!newOption.trim() || !confirmed) return null;
    for (const opt of allOptions) {
      const res = checkSimilarity(newOption, opt);
      if (res) return { existing: opt, type: res };
    }
    return null;
  }, [newOption, allOptions, confirmed]);

  const canAdd = newOption.trim() && !saving && (!matchResult || confirmed);

  const handleAdd = async () => {
    const trimmed = newOption.trim();
    if (!trimmed) return;

    // Final duplicate guard: block exact matches from being saved
    const exact = allOptions.some((o) => normalize(o) === normalize(trimmed));
    if (exact) {
      setError("This option already exists.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await base44.entities.DueDiligenceStatusOption.create({
        name: trimmed,
        category,
      });
      queryClient.invalidateQueries({ queryKey: ["dd-status-options", category] });
      onChange(trimmed);
      setNewOption("");
      setAdding(false);
      setConfirmed(false);
      setOpen(false);
    } catch (err) {
      setError(err?.message || "Failed to save option.");
    } finally {
      setSaving(false);
    }
  };

  const selected = allOptions.find((o) => o === value);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setAdding(false); setNewOption(""); setError(""); setConfirmed(false); setSearch(""); } }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between h-9 text-sm font-normal">
          <span className={selected ? "text-gray-900 truncate" : "text-gray-400"}>{selected || value || placeholder}</span>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        {adding ? (
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-700">Add New Option</span>
              <button type="button" onClick={() => { setAdding(false); setNewOption(""); setError(""); setConfirmed(false); }}>
                <span className="text-xs text-gray-400 hover:text-gray-600">cancel</span>
              </button>
            </div>
            <Input
              placeholder="Enter option name..."
              value={newOption}
              onChange={(e) => { setNewOption(e.target.value); setError(""); setConfirmed(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (canAdd) handleAdd(); } }}
              className={cn("h-9 text-sm", matchResult && "border-amber-400 focus-visible:ring-amber-400")}
              autoFocus
            />
            {/* Validation feedback */}
            {newOption.trim() && !confirmed && (() => {
              const match = allOptions.reduce((found, opt) => {
                if (found) return found;
                const res = checkSimilarity(newOption, opt);
                return res ? { existing: opt, type: res } : null;
              }, null);
              if (!match) return null;
              return (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-2 space-y-1">
                  <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {match.type === "exact" ? "Exact match exists:" : "Similar option exists:"}
                  </p>
                  <p className="text-sm font-medium text-gray-800">{match.existing}</p>
                  <div className="flex gap-1.5 pt-0.5">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => { onChange(match.existing); setAdding(false); setNewOption(""); setConfirmed(false); setOpen(false); }}>
                      Use Existing
                    </Button>
                    {match.type === "similar" && (
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => setConfirmed(true)}>
                        Add Anyway
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
            {matchResult && confirmed && matchResult.type === "similar" && (
              <p className="text-[11px] text-amber-600">Adding despite similarity — click "Add Option" to confirm.</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end pt-0.5">
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAdding(false); setNewOption(""); setError(""); setConfirmed(false); }}>Cancel</Button>
              <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!canAdd} onClick={handleAdd}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add Option"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-2 border-b">
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" autoFocus />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400 italic">No results</div>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
                    onClick={() => { onChange(o); setOpen(false); setSearch(""); }}
                  >
                    <Check className={cn("w-3.5 h-3.5 shrink-0", value === o ? "opacity-100 text-indigo-600" : "opacity-0")} />
                    <span className="truncate">{o}</span>
                  </button>
                ))
              )}
            </div>
            {!allowedOptions && (
            <div className="border-t">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium"
                onClick={() => setAdding(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Add new option
              </button>
            </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}