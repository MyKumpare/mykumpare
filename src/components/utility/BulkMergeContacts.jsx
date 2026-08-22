import React, { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  ScanSearch, ArrowRightLeft, Loader2, User, Check, AlertTriangle,
  CheckCircle2, Users, Building2,
} from "lucide-react";
import { findContactDuplicates } from "@/components/contacts/contactDuplicateCheck";
import { useDuplicateReviews } from "@/components/contacts/useDuplicateReviews";

function contactName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(" ") || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}

function completenessScore(c) {
  let n = 0;
  ["salutation", "first_name", "last_name", "title", "email", "linkedin_url", "biography", "photo_url",
   "employee_status", "contact_status"].forEach((k) => { if (c[k]) n++; });
  if (Array.isArray(c.contact_type) ? c.contact_type.length > 0 : c.contact_type) n++;
  ["firm_ids", "designations", "contact_roles", "phones", "addresses", "education", "professional_experience"].forEach((k) => { if (c[k]?.length) n += c[k].length; });
  return n;
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

function FirmBadges({ contact, firmMap }) {
  const firmIds = contact.firm_ids || [];
  if (!firmIds.length) return <span className="text-[10px] text-gray-400">No firm</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {firmIds.slice(0, 2).map((fid) => (
        <span key={fid} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700">
          <Building2 className="w-2.5 h-2.5" />
          {firmMap.get(fid) || "Unknown"}
        </span>
      ))}
      {firmIds.length > 2 && (
        <span className="text-[10px] text-gray-400">+{firmIds.length - 2}</span>
      )}
    </div>
  );
}

export default function BulkMergeContacts() {
  const queryClient = useQueryClient();
  const [keepIndex, setKeepIndex] = useState({});
  const [merging, setMerging] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: [] });
  const [mergeComplete, setMergeComplete] = useState(false);
  const [scanned, setScanned] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(null, 5000),
  });

  const { isGroupAccepted, acceptGroup } = useDuplicateReviews();

  const firmMap = useMemo(() => {
    const m = new Map();
    for (const f of firms) m.set(f.id, f.name);
    return m;
  }, [firms]);

  const activeContacts = useMemo(
    () => contacts.filter((c) => !c.deleted_at),
    [contacts]
  );

  const clusters = useMemo(
    () => findDuplicateClusters(activeContacts),
    [activeContacts]
  );

  const pendingClusters = useMemo(
    () => clusters.filter((g) => !isGroupAccepted(g)),
    [clusters, isGroupAccepted]
  );

  // Default keep = most complete record in each cluster.
  const getKeepId = useCallback((cluster, ci) => {
    const idx = keepIndex[ci];
    if (idx !== undefined) return cluster[idx].id;
    let best = 0;
    let bestScore = -1;
    cluster.forEach((c, k) => {
      const s = completenessScore(c);
      if (s > bestScore) { bestScore = s; best = k; }
    });
    return cluster[best].id;
  }, [keepIndex]);

  const handleScan = () => {
    setScanned(true);
    setMergeComplete(false);
    setProgress({ done: 0, total: 0, errors: [] });
  };

  const handleMergeAll = async () => {
    if (merging || pendingClusters.length === 0) return;
    setMerging(true);
    setMergeComplete(false);
    const totalPairs = pendingClusters.reduce((sum, g) => sum + g.length - 1, 0);
    setProgress({ done: 0, total: totalPairs, errors: [] });
    let done = 0;
    const errors = [];
    let mergedCount = 0;
    try {
      for (let ci = 0; ci < pendingClusters.length; ci++) {
        const cluster = pendingClusters[ci];
        const keepId = getKeepId(cluster, ci);
        for (const c of cluster) {
          if (c.id === keepId) continue;
          try {
            const res = await base44.functions.invoke("mergeContacts", {
              primary_id: keepId,
              secondary_id: c.id,
            });
            if (res?.data?.success) mergedCount++;
            else errors.push(`${contactName(c)}: merge returned no success`);
          } catch (e) {
            errors.push(`${contactName(c)}: ${e.message || "merge failed"}`);
          }
          done++;
          setProgress({ done, total: totalPairs, errors: [...errors] });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      await queryClient.invalidateQueries({ queryKey: ["orgchart"] });
      await queryClient.invalidateQueries({ queryKey: ["ownership"] });
      await queryClient.invalidateQueries({ queryKey: ["duplicateReviews"] });
      setMergeComplete(true);
    } finally {
      setMerging(false);
    }
  };

  const handleAcceptAll = async () => {
    setMerging(true);
    try {
      for (const group of pendingClusters) {
        await acceptGroup(group);
      }
    } finally {
      setMerging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        <span className="ml-2 text-sm text-gray-500">Loading contacts…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header / scan bar */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-rose-600" />
          <span className="text-sm font-semibold text-gray-700">Bulk Merge Duplicates</span>
          {scanned && pendingClusters.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <AlertTriangle className="w-3 h-3" /> {pendingClusters.length} duplicate set{pendingClusters.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={handleScan} disabled={merging}>
          <ScanSearch className="w-3.5 h-3.5" />
          {scanned ? "Re-scan" : "Scan All Firms"}
        </Button>
      </div>

      {!scanned ? (
        <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border border-dashed border-gray-200 bg-white text-center">
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
            <ScanSearch className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Bulk Contact Merge</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Scans all contacts across every firm and groups potential duplicates by name, email, phone, and photo similarity. Pick which record to keep for each set, then merge all at once — all data is combined into the kept record.
            </p>
          </div>
          <Button type="button" onClick={handleScan} className="bg-rose-600 hover:bg-rose-700 text-white">
            Start Bulk Scan
          </Button>
        </div>
      ) : mergeComplete ? (
        <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border border-emerald-200 bg-emerald-50/60 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-gray-700">Merge complete</p>
            <p className="text-xs text-gray-500 mt-1">
              {progress.done} record{progress.done !== 1 ? "s" : ""} consolidated into their kept records.
              {progress.errors.length > 0 && ` ${progress.errors.length} error(s).`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setScanned(false); setMergeComplete(false); }}>
              Done
            </Button>
            <Button size="sm" variant="outline" onClick={handleScan} disabled={merging}>
              Scan Again
            </Button>
          </div>
        </div>
      ) : pendingClusters.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border border-emerald-200 bg-emerald-50/40 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          <p className="text-sm font-semibold text-gray-700">No duplicates detected</p>
          <p className="text-xs text-gray-400">All contacts across all firms are unique. 🎉</p>
        </div>
      ) : (
        <>
          {/* Bulk action bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 backdrop-blur px-3 py-2">
            <div className="text-xs text-indigo-700">
              <strong>{pendingClusters.length}</strong> set{pendingClusters.length > 1 ? "s" : ""} ·{" "}
              <strong>{pendingClusters.reduce((s, g) => s + g.length - 1, 0)}</strong> duplicate record{pendingClusters.reduce((s, g) => s + g.length - 1, 0) !== 1 ? "s" : ""} to merge
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleAcceptAll} disabled={merging}>
                <Check className="w-3.5 h-3.5" /> Accept all (keep both)
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleMergeAll}
                disabled={merging}
              >
                {merging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                {merging ? `Merging… (${progress.done}/${progress.total})` : "Merge All"}
              </Button>
            </div>
          </div>

          {merging && progress.total > 0 && (
            <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          )}

          {/* Cluster list */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {pendingClusters.map((cluster, ci) => {
              const keepId = getKeepId(cluster, ci);
              return (
                <div key={ci} className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                      Set {ci + 1} · {cluster.length} records
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {cluster.length - 1} will be merged away
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {cluster.map((c, ki) => {
                      const isKeep = c.id === keepId;
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-colors ${isKeep ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                        >
                          <input
                            type="radio"
                            name={`bulk-cluster-${ci}`}
                            checked={isKeep}
                            onChange={() => setKeepIndex((prev) => ({ ...prev, [ci]: ki }))}
                            className="accent-indigo-600"
                          />
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {c.photo_url
                              ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                              : <User className="w-3 h-3 text-indigo-600" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-800 truncate">{contactName(c)}</p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {c.title || "—"}{c.email ? ` · ${c.email}` : ""}
                            </p>
                            <FirmBadges contact={c} firmMap={firmMap} />
                          </div>
                          {isKeep && <span className="text-xs font-semibold text-indigo-600 flex-shrink-0">Keep</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {progress.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 space-y-1">
              <p className="text-xs font-semibold text-red-700">Errors ({progress.errors.length})</p>
              <div className="max-h-24 overflow-y-auto space-y-0.5">
                {progress.errors.map((e, i) => (
                  <p key={i} className="text-[10px] text-red-600">{e}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}