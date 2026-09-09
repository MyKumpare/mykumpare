import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown, Check, Plus, AlertTriangle, Loader2,
  Settings2, Pencil, Trash2, ArrowUp, ArrowDown, X,
} from "lucide-react";
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

  // Manage mode state
  const [manageMode, setManageMode] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { name, dbRecord, isDefault } | null
  const [editValue, setEditValue] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const { data: dbOptions = [] } = useQuery({
    queryKey: ["dd-status-options", category],
    queryFn: () => base44.entities.DueDiligenceStatusOption.filter({ category }, "-created_date", 500),
  });

  // Build ordered option records: DB records (visible, by sort_order) then defaults not in DB (alphabetical)
  const optionRecords = useMemo(() => {
    const defaults = DEFAULTS[category] || [];
    const dbVisible = dbOptions.filter((o) => !o.is_hidden);
    const dbOrdered = [...dbVisible].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
    );
    const allDbNames = new Set(dbOptions.map((o) => normalize(o.name)));
    // Defaults that have no DB record at all (not even a hidden one) — appended alphabetically
    const defaultNotInDb = defaults
      .filter((d) => !allDbNames.has(normalize(d)))
      .sort((a, b) => a.localeCompare(b));

    const allOpts = [
      ...dbOrdered.map((o) => ({
        name: o.name,
        dbRecord: o,
        isDefault: defaults.some((d) => normalize(d) === normalize(o.name)),
      })),
      ...defaultNotInDb.map((d) => ({ name: d, dbRecord: null, isDefault: true })),
    ];

    if (allowedOptions) {
      return allOpts.filter((o) => allowedOptions.includes(o.name));
    }
    return allOpts;
  }, [dbOptions, category, allowedOptions]);

  const allOptions = optionRecords.map((o) => o.name);

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

  // ─── Manage mode helpers ───

  // Ensure a DB record exists for an option (create one for pure defaults)
  const ensureDbRecord = async (opt) => {
    if (opt.dbRecord) return opt.dbRecord;
    const created = await base44.entities.DueDiligenceStatusOption.create({
      name: opt.name,
      category,
      sort_order: 0,
    });
    queryClient.invalidateQueries({ queryKey: ["dd-status-options", category] });
    return created;
  };

  const handleReorder = async (index, direction) => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= optionRecords.length || actionLoading) return;

    setActionLoading(true);
    try {
      const itemA = optionRecords[index];
      const itemB = optionRecords[swapIndex];

      const recordA = await ensureDbRecord(itemA);
      const recordB = await ensureDbRecord(itemB);

      const orderA = recordA.sort_order ?? index;
      const orderB = recordB.sort_order ?? swapIndex;

      await base44.entities.DueDiligenceStatusOption.update(recordA.id, { sort_order: orderB });
      await base44.entities.DueDiligenceStatusOption.update(recordB.id, { sort_order: orderA });

      queryClient.invalidateQueries({ queryKey: ["dd-status-options", category] });
    } catch (err) {
      console.error("Reorder failed:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditStart = (opt) => {
    setEditTarget(opt);
    setEditValue(opt.name);
    setError("");
  };

  const handleEditSave = async () => {
    if (!editTarget || !editValue.trim()) return;
    const trimmed = editValue.trim();

    // Check for duplicates (excluding the one being edited)
    const duplicate = allOptions.some(
      (o) => normalize(o) === normalize(trimmed) && normalize(o) !== normalize(editTarget.name)
    );
    if (duplicate) {
      setError("An option with this name already exists.");
      return;
    }

    setActionLoading(true);
    try {
      const record = await ensureDbRecord(editTarget);
      await base44.entities.DueDiligenceStatusOption.update(record.id, { name: trimmed });
      queryClient.invalidateQueries({ queryKey: ["dd-status-options", category] });

      // If the current value was the old name, update it
      if (value === editTarget.name) {
        onChange(trimmed);
      }

      setEditTarget(null);
      setEditValue("");
      setError("");
    } catch (err) {
      setError(err?.message || "Failed to update option.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditCancel = () => {
    setEditTarget(null);
    setEditValue("");
    setError("");
  };

  const handleDeleteOption = async (opt) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      if (opt.isDefault) {
        // For defaults: create/update a DB record with is_hidden=true
        const record = await ensureDbRecord(opt);
        await base44.entities.DueDiligenceStatusOption.update(record.id, { is_hidden: true });
      } else {
        // For custom options: delete the DB record
        if (opt.dbRecord) {
          await base44.entities.DueDiligenceStatusOption.delete(opt.dbRecord.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["dd-status-options", category] });

      // If the current value was the deleted option, clear it
      if (value === opt.name) {
        onChange("");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const selected = allOptions.find((o) => o === value);

  const closePopover = () => {
    setOpen(false);
    setAdding(false);
    setNewOption("");
    setError("");
    setConfirmed(false);
    setSearch("");
    setManageMode(false);
    setEditTarget(null);
    setEditValue("");
  };

  return (
    <Popover open={open} onOpenChange={(v) => { if (!v) closePopover(); else setOpen(true); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between h-9 text-sm font-normal">
          <span className={selected ? "text-gray-900 truncate" : "text-gray-400"}>{selected || value || placeholder}</span>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
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
        ) : manageMode ? (
          <div>
            {/* Manage mode header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> Manage Options
              </span>
              <button type="button" onClick={() => { setManageMode(false); setEditTarget(null); setEditValue(""); setError(""); }} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                Done
              </button>
            </div>
            {/* Option list with controls */}
            <div className="max-h-64 overflow-y-auto">
              {optionRecords.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400 italic">No options</div>
              ) : (
                optionRecords.map((opt, idx) => {
                  const isEditing = editTarget && editTarget.name === opt.name;
                  return (
                    <div
                      key={opt.name}
                      className="flex items-center gap-1.5 px-2 py-1.5 border-b last:border-b-0 hover:bg-gray-50"
                    >
                      {/* Reorder controls */}
                      <div className="flex flex-col shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReorder(idx, "up")}
                          disabled={idx === 0 || actionLoading}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorder(idx, "down")}
                          disabled={idx === optionRecords.length - 1 || actionLoading}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {isEditing ? (
                        /* Inline edit */
                        <div className="flex-1 flex items-center gap-1 min-w-0">
                          <Input
                            value={editValue}
                            onChange={(e) => { setEditValue(e.target.value); setError(""); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); handleEditSave(); }
                              if (e.key === "Escape") handleEditCancel();
                            }}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <button type="button" onClick={handleEditSave} disabled={actionLoading || !editValue.trim()} className="text-green-600 hover:text-green-700 disabled:opacity-30">
                            {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button type="button" onClick={handleEditCancel} className="text-gray-400 hover:text-gray-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className={cn("flex-1 text-sm truncate", opt.isDefault && !opt.dbRecord && "text-gray-600")}>
                            {opt.name}
                          </span>
                          {opt.isDefault && !opt.dbRecord && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">Default</span>
                          )}
                          <button type="button" onClick={() => handleEditStart(opt)} disabled={actionLoading} className="text-gray-400 hover:text-indigo-600 p-1 shrink-0 disabled:opacity-30">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteOption(opt)} disabled={actionLoading} className="text-gray-400 hover:text-red-600 p-1 shrink-0 disabled:opacity-30">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })
              )}
              {actionLoading && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                </div>
              )}
              {error && <p className="text-xs text-red-600 px-3 py-1">{error}</p>}
            </div>
            {/* Footer: add + back */}
            <div className="border-t flex">
              <button
                type="button"
                className="flex-1 text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium"
                onClick={() => { setManageMode(false); setAdding(true); }}
              >
                <Plus className="w-3.5 h-3.5" /> Add new option
              </button>
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
              <div className="border-t flex">
                <button
                  type="button"
                  className="flex-1 text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium"
                  onClick={() => setAdding(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> Add new option
                </button>
                <button
                  type="button"
                  className="flex-1 text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 flex items-center gap-1.5 font-medium border-l"
                  onClick={() => setManageMode(true)}
                >
                  <Settings2 className="w-3.5 h-3.5" /> Manage
                </button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}