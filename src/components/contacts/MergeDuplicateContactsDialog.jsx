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
   "employee_status", "contact_type", "contact_status"].forEach((k) => { if (c[k]) n++; });
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
          {clusters.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No duplicate contacts detected.</p>
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