import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, ArrowRightLeft } from "lucide-react";
import { findContactDuplicates } from "@/components/contacts/contactDuplicateCheck";

function completenessScore(c) {
  let n = 0;
  ["salutation", "first_name", "last_name", "title", "email", "linkedin_url", "biography", "photo_url",
   "employee_status", "contact_status"].forEach((k) => { if (c[k]) n++; });
  if (Array.isArray(c.contact_type) ? c.contact_type.length > 0 : c.contact_type) n++;
  ["firm_ids", "designations", "contact_roles", "phones", "addresses", "education", "professional_experience"].forEach((k) => { if (c[k]?.length) n += c[k].length; });
  return n;
}

function contactName(c) {
  return [c.salutation, c.first_name, c.last_name].filter(Boolean).join(" ") || [c.first_name, c.last_name].filter(Boolean).join(" ");
}

/**
 * Groups a list of contacts into duplicate clusters using findContactDuplicates.
 */
function findDuplicateClusters(contacts) {
  const clusters = [];
  const assigned = new Set();
  for (let i = 0; i < contacts.length; i++) {
    const a = contacts[i];
    if (assigned.has(a.id)) continue;
    const group = [a];
    assigned.add(a.id);
    for (let j = i + 1; j < contacts.length; j++) {
      const b = contacts[j];
      if (assigned.has(b.id)) continue;
      const dups = findContactDuplicates(a, [b]);
      if (dups.length > 0) {
        group.push(b);
        assigned.add(b.id);
      }
    }
    if (group.length > 1) clusters.push(group);
  }
  return clusters;
}

export default function MergeDuplicateContactsDialog({ open, onOpenChange, contacts = [], onMerged }) {
  const queryClient = useQueryClient();
  const clusters = useMemo(() => findDuplicateClusters(contacts), [contacts]);
  // For each cluster, pick the "keep" index (primary). Default to most complete.
  const [keepIndex, setKeepIndex] = useState({});
  const [merging, setMerging] = useState(false);
  // Manual merge mode — pick any two contacts to merge regardless of auto-detection
  const [manualMode, setManualMode] = useState(false);
  const [manualPrimary, setManualPrimary] = useState("");
  const [manualSecondary, setManualSecondary] = useState("");

  const getKeepId = (cluster, ci) => {
    const idx = keepIndex[ci];
    if (idx !== undefined) return cluster[idx].id;
    let best = 0;
    let bestScore = -1;
    cluster.forEach((c, k) => {
      const s = completenessScore(c);
      if (s > bestScore) { bestScore = s; best = k; }
    });
    return cluster[best].id;
  };

  const handleMergeAll = async () => {
    setMerging(true);
    let mergedCount = 0;
    try {
      for (let ci = 0; ci < clusters.length; ci++) {
        const cluster = clusters[ci];
        const keepId = getKeepId(cluster, ci);
        for (const c of cluster) {
          if (c.id === keepId) continue;
          try {
            const res = await base44.functions.invoke("mergeContacts", {
              primary_id: keepId,
              secondary_id: c.id,
            });
            if (res?.data?.success) mergedCount++;
          } catch {}
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      await queryClient.invalidateQueries({ queryKey: ["orgchart"] });
      await queryClient.invalidateQueries({ queryKey: ["ownership"] });
      onMerged?.(mergedCount);
      onOpenChange(false);
    } finally {
      setMerging(false);
    }
  };

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => contactName(a).localeCompare(contactName(b))),
    [contacts]
  );

  const handleManualMerge = async () => {
    if (!manualPrimary || !manualSecondary || manualPrimary === manualSecondary) return;
    setMerging(true);
    try {
      const res = await base44.functions.invoke("mergeContacts", {
        primary_id: manualPrimary,
        secondary_id: manualSecondary,
      });
      if (res?.data?.success) {
        await queryClient.invalidateQueries({ queryKey: ["contacts"] });
        await queryClient.invalidateQueries({ queryKey: ["orgchart"] });
        await queryClient.invalidateQueries({ queryKey: ["ownership"] });
        onMerged?.(1);
        onOpenChange(false);
        setManualMode(false);
        setManualPrimary("");
        setManualSecondary("");
      } else {
        onMerged?.(0);
      }
    } catch {
      onMerged?.(0);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!merging) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Resolve Duplicate Contacts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          {/* Manual merge toggle */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <button
              type="button"
              onClick={() => setManualMode((v) => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-sm font-medium text-gray-700">Merge two contacts manually</span>
              <span className="text-xs text-indigo-600">{manualMode ? "Hide" : "Show"}</span>
            </button>
            {manualMode && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-500">Pick any two contacts to merge — useful when names differ (e.g. maiden vs married) but it's the same person.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Keep (primary)</label>
                    <select
                      value={manualPrimary}
                      onChange={(e) => setManualPrimary(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">Select contact…</option>
                      {sortedContacts.map((c) => (
                        <option key={c.id} value={c.id}>{contactName(c)}{c.title ? ` — ${c.title}` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Merge & remove (secondary)</label>
                    <select
                      value={manualSecondary}
                      onChange={(e) => setManualSecondary(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">Select contact…</option>
                      {sortedContacts.map((c) => (
                        <option key={c.id} value={c.id} disabled={c.id === manualPrimary}>{contactName(c)}{c.title ? ` — ${c.title}` : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full mt-1 gap-1.5"
                  onClick={handleManualMerge}
                  disabled={merging || !manualPrimary || !manualSecondary || manualPrimary === manualSecondary}
                >
                  {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  {merging ? "Merging…" : "Merge selected"}
                </Button>
              </div>
            )}
          </div>

          {clusters.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No auto-detected duplicates. Use the manual option above to merge any two contacts.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                {clusters.length} duplicate set{clusters.length > 1 ? "s" : ""} found. Select which record to keep — the other will be merged into it (data combined) and removed.
              </p>
              {clusters.map((cluster, ci) => {
                const keepId = getKeepId(cluster, ci);
                return (
                  <div key={ci} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                    <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Duplicate set {ci + 1}</div>
                    <div className="space-y-2">
                      {cluster.map((c) => {
                        const isKeep = c.id === keepId;
                        return (
                          <label key={c.id} className={`flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-colors ${isKeep ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                            <input
                              type="radio"
                              name={`cluster-${ci}`}
                              checked={isKeep}
                              onChange={() => setKeepIndex((prev) => ({ ...prev, [ci]: cluster.findIndex((x) => x.id === c.id) }))}
                              className="accent-indigo-600"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800 truncate">{contactName(c)}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {c.title || "—"}{c.email ? ` · ${c.email}` : ""}
                              </p>
                            </div>
                            {isKeep && <span className="text-xs font-semibold text-indigo-600">Keep</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>Cancel</Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            onClick={handleMergeAll}
            disabled={merging || clusters.length === 0}
          >
            {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            {merging ? "Merging…" : "Merge & Remove Duplicates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}