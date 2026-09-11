import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, ArrowRightLeft, Trash2, Loader2, User, ScanSearch } from "lucide-react";
import { findContactDuplicates, findExactDuplicateClusters } from "@/components/contacts/contactDuplicateCheck";
import { useDuplicateReviews } from "@/components/contacts/useDuplicateReviews";
import MergeDuplicateContactsDialog from "@/components/contacts/MergeDuplicateContactsDialog";

function contactName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(" ") || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}

/** Fuzzy clustering using findContactDuplicates (name/email/phone/photo). */
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
      if (findContactDuplicates(a, [b]).length > 0) {
        group.push(b);
        assigned.add(b.id);
      }
    }
    if (group.length > 1) clusters.push(group);
  }
  return clusters;
}

export default function DuplicateContactsReview() {
  const queryClient = useQueryClient();
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mergeCluster, setMergeCluster] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [autoMerging, setAutoMerging] = useState(false);
  const [autoMergeResult, setAutoMergeResult] = useState(null);

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { isGroupAccepted, acceptGroup } = useDuplicateReviews();

  const activeContacts = useMemo(
    () => contacts.filter((c) => !c.deleted_at),
    [contacts]
  );

  const clusters = useMemo(() => findDuplicateClusters(activeContacts), [activeContacts]);
  const pendingClusters = useMemo(
    () => clusters.filter((g) => !isGroupAccepted(g)),
    [clusters, isGroupAccepted]
  );

  // For each cluster, compute the pairwise match reasons so the user can see
  // exactly which records are duplicates of which and on what fields.
  const clusterPairMatches = useMemo(
    () => clusters.map((cluster) => {
      const pairs = [];
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          const dups = findContactDuplicates(cluster[i], [cluster[j]]);
          if (dups.length > 0 && dups[0].reasons?.length) {
            pairs.push({ a: cluster[i], b: cluster[j], reasons: dups[0].reasons });
          }
        }
      }
      return pairs;
    }),
    [clusters]
  );

  const runScan = () => {
    setBusy(true);
    // Allow the list query to settle before revealing results.
    setTimeout(() => {
      setScanned(true);
      setBusy(false);
    }, 300);
  };

  const handleAccept = async (group) => {
    setBusy(true);
    try {
      await acceptGroup(group);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await base44.functions.invoke("deleteContactCascade", { contact_id: deleteTarget.id });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["duplicateReviews"] });
      queryClient.invalidateQueries({ queryKey: ["deletedContacts"] });
      setDeleteTarget(null);
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setBusy(false);
    }
  };

  // Auto-merge contacts that are 100% identical (same signature on all fields).
  // For each cluster of exact duplicates, keeps the most complete record and
  // merges the rest into it via the mergeContacts backend function.
  const handleAutoMergeExact = async () => {
    const clusters = findExactDuplicateClusters(activeContacts);
    if (clusters.length === 0) {
      setAutoMergeResult({ merged: 0, clusters: 0, skipped: 0 });
      return;
    }
    setAutoMerging(true);
    setAutoMergeResult(null);
    let totalMerged = 0;
    let totalClusters = 0;
    let skipped = 0;
    const errors = [];
    for (const cluster of clusters) {
      // Keep the most complete record (longest full name, tiebreak by most recently updated)
      const fullNameLen = (c) =>
        [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
          .filter(Boolean).join(" ").length;
      let primary = cluster[0];
      for (let i = 1; i < cluster.length; i++) {
        const c = cluster[i];
        if (
          fullNameLen(c) > fullNameLen(primary) ||
          (fullNameLen(c) === fullNameLen(primary) &&
            new Date(c.updated_date || c.created_date || 0).getTime() >
              new Date(primary.updated_date || primary.created_date || 0).getTime())
        ) {
          primary = c;
        }
      }
      const secondaries = cluster.filter((c) => c.id !== primary.id);
      let clusterMerged = 0;
      for (const sec of secondaries) {
        try {
          const res = await base44.functions.invoke("mergeContacts", {
            primary_id: primary.id,
            secondary_id: sec.id,
          });
          if (res?.success) {
            clusterMerged++;
            totalMerged++;
          } else {
            skipped++;
            errors.push(`${contactName(sec)}: ${res?.error || "unknown error"}`);
          }
        } catch (err) {
          skipped++;
          errors.push(`${contactName(sec)}: ${err.message}`);
        }
      }
      if (clusterMerged > 0) totalClusters++;
    }
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    await queryClient.invalidateQueries({ queryKey: ["duplicateReviews"] });
    setAutoMergeResult({ merged: totalMerged, clusters: totalClusters, skipped, errors });
    setAutoMerging(false);
    setScanned(true);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanSearch className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-700">Contact Duplicates</span>
          {scanned && pendingClusters.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <AlertTriangle className="w-3 h-3" /> {pendingClusters.length} set{pendingClusters.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs border-green-300 text-green-700 hover:bg-green-50"
            onClick={handleAutoMergeExact}
            disabled={busy || autoMerging || activeContacts.length === 0}
          >
            {autoMerging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {autoMerging ? "Merging…" : "Auto-merge 100% duplicates"}
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={runScan} disabled={busy || autoMerging}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
            {scanned ? "Re-scan" : "Scan Now"}
          </Button>
        </div>
      </div>

      {autoMergeResult && (
        <div className={`rounded-lg border p-2.5 text-xs ${autoMergeResult.merged > 0 ? "border-green-200 bg-green-50 text-green-800" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
          {autoMergeResult.merged > 0 ? (
            <p>
              ✅ Auto-merged <strong>{autoMergeResult.merged}</strong> exact duplicate contact{autoMergeResult.merged === 1 ? "" : "s"} across <strong>{autoMergeResult.clusters}</strong> set{autoMergeResult.clusters === 1 ? "" : "s"}.
              {autoMergeResult.skipped > 0 && ` ${autoMergeResult.skipped} skipped due to errors.`}
            </p>
          ) : (
            <p>No 100% identical duplicate contacts found — all potential duplicates have at least some differing data and need manual review.</p>
          )}
          {autoMergeResult.errors?.length > 0 && (
            <details className="mt-1 text-[10px] text-gray-500">
              <summary className="cursor-pointer">View errors ({autoMergeResult.errors.length})</summary>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {autoMergeResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {!scanned ? (
        <p className="text-xs text-gray-500 py-2">
          Run a scan to find potential duplicate contacts across all firms. For each set you can keep both (accept), merge them, or delete the duplicate.
        </p>
      ) : pendingClusters.length === 0 ? (
        <p className="text-xs text-gray-500 py-2 text-center">
          No duplicate contacts detected. 🎉
        </p>
      ) : (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {pendingClusters.map((group, gi) => (
            <div key={gi} className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 space-y-2">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Duplicate set {gi + 1}</div>
              {(clusterPairMatches[gi] || []).length > 0 && (
                <div className="space-y-0.5 rounded-md bg-amber-100/50 border border-amber-200/70 px-2 py-1">
                  {(clusterPairMatches[gi] || []).map((p, pi) => (
                    <div key={pi} className="text-[10px] leading-tight text-gray-600">
                      <span className="font-semibold text-amber-700">{contactName(p.a)} ↔ {contactName(p.b)}:</span>{" "}
                      {p.reasons.join(" · ")}
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-1.5">
                {group.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 bg-white rounded-md border border-gray-200 px-2 py-1.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {c.photo_url
                        ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                        : <User className="w-3 h-3 text-indigo-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-800 truncate">{contactName(c)}</p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {c.title || "—"}{c.email ? ` · ${c.email}` : ""}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(c)} disabled={busy}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleAccept(group)} disabled={busy}>
                  <Check className="w-3.5 h-3.5" /> Accept (keep both)
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setMergeCluster(group)} disabled={busy || group.length < 2}>
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Merge…
                </Button>
              </div>
              <p className="text-[10px] text-gray-400 pt-0.5">Merge opens a picker to choose which record to keep — the others are combined into it and removed.</p>
            </div>
          ))}
        </div>
      )}

      {mergeCluster && (
        <MergeDuplicateContactsDialog
          open={true}
          onOpenChange={(v) => { if (!v) setMergeCluster(null); }}
          contacts={mergeCluster}
          onMerged={() => {
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
            queryClient.invalidateQueries({ queryKey: ["duplicateReviews"] });
            setMergeCluster(null);
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-red-600 font-semibold">
              <AlertTriangle className="w-5 h-5" /> Delete Contact?
            </div>
            <p className="text-sm text-gray-600">
              Delete <strong>{contactName(deleteTarget)}</strong>{deleteTarget.email ? ` (${deleteTarget.email})` : ""}? This moves the contact to deleted records.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={busy}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}