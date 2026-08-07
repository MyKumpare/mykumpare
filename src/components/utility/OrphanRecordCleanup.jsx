import React, { useState } from "react";
import { Search, Trash2, Check, RefreshCw, ShieldCheck, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

// Entity type display labels and the action allowed for each.
// "delete" entities are removed entirely; "clean" entities have the
// stale reference stripped but the record itself is kept.
const ENTITY_META = {
  PendingInvitation: { label: "Pending Invitations", mode: "delete" },
  ExternalChat: { label: "External Chats", mode: "delete" },
  DdNotification: { label: "Notifications", mode: "delete" },
  ContactActivity: { label: "Activities", mode: "delete" },
  FollowUpTask: { label: "Follow-up Tasks", mode: "delete" },
  DueDiligence: { label: "Due Diligence (clean refs)", mode: "clean" },
  Product: { label: "Products (clean team/firm)", mode: "clean" },
  Questionnaire: { label: "Questionnaires (clean refs)", mode: "clean" },
  OrgChart: { label: "Org Charts (clean nodes)", mode: "clean" },
  Contact: { label: "Contacts (clean firm links)", mode: "clean" },
};

function OrphanRow({ orphan, selected, onToggle }) {
  const meta = ENTITY_META[orphan.entity_type] || { label: orphan.entity_type, mode: "delete" };
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${selected ? "border-rose-300 bg-rose-50" : "border-gray-100 bg-white hover:bg-gray-50"}`}>
      <button
        onClick={() => onToggle(orphan)}
        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? "bg-rose-600 border-rose-600 text-white" : "border-gray-300"}`}
      >
        {selected && <Check className="w-3 h-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-gray-800">{orphan.description}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">
          {meta.label} · {orphan.record_id.slice(-8)}
        </p>
      </div>
    </div>
  );
}

function OrphanGroup({ entityType, orphans, selectedIds, onToggle, onToggleAll }) {
  const [open, setOpen] = useState(true);
  const meta = ENTITY_META[entityType] || { label: entityType, mode: "delete" };
  const allSelected = orphans.every((o) => selectedIds.has(`${o.entity_type}:${o.record_id}`));

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 w-full px-3 py-2 bg-gray-50 hover:bg-gray-100">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 flex-1 text-left">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="text-sm font-semibold text-gray-700">{meta.label}</span>
          <span className="text-xs text-gray-400">({orphans.length})</span>
        </button>
        <button
          onClick={() => onToggleAll(entityType, orphans)}
          className={`text-[11px] px-2 py-0.5 rounded ${allSelected ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-500"}`}
        >
          {allSelected ? "Unselect all" : "Select all"}
        </button>
      </div>
      {open && (
        <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
          {orphans.map((o) => (
            <OrphanRow
              key={`${o.entity_type}:${o.record_id}`}
              orphan={o}
              selected={selectedIds.has(`${o.entity_type}:${o.record_id}`)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrphanRecordCleanup() {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [orphansByKey, setOrphansByKey] = useState({});

  const scan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    setSelectedIds(new Set());
    setOrphansByKey({});
    try {
      const res = await base44.functions.invoke("findOrphanRecords", {});
      const data = res.data;
      if (data.error) throw new Error(data.error);
      setResult(data);
      const byKey = {};
      for (const o of Object.values(data.grouped || {}).flat()) {
        byKey[`${o.entity_type}:${o.record_id}`] = o;
      }
      setOrphansByKey(byKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const toggle = (orphan) => {
    const key = `${orphan.entity_type}:${orphan.record_id}`;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = (entityType, orphans) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const keys = orphans.map((o) => `${o.entity_type}:${o.record_id}`);
      const allSelected = keys.every((k) => next.has(k));
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    setError(null);
    try {
      const items = Array.from(selectedIds).map((key) => {
        const o = orphansByKey[key];
        const meta = ENTITY_META[o.entity_type] || { mode: "delete" };
        return {
          entity_type: o.entity_type,
          record_id: o.record_id,
          action: meta.mode === "clean" ? "clean" : "delete",
        };
      });
      const res = await base44.functions.invoke("deleteOrphanRecords", { items });
      const data = res.data;
      if (data.error) throw new Error(data.error);
      const successCount = (data.results || []).filter((r) => r.status === "success").length;
      const errorCount = (data.results || []).filter((r) => r.status === "error").length;
      toast({
        title: "Orphan cleanup complete",
        description: `${successCount} record(s) cleaned${errorCount ? `, ${errorCount} error(s)` : ""}.`,
      });
      await scan();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const totalOrphans = result?.total || 0;
  const grouped = result?.grouped || {};

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-600" />
        <p className="text-sm font-semibold text-gray-700">Orphan Record Cleanup</p>
      </div>
      <p className="text-xs text-gray-500">
        Scans for records that still reference deleted contacts or firms (e.g. invitations, chats, tasks, due diligence references).
        Review each found orphan and approve deletion — nothing is removed without your confirmation.
      </p>

      {!result && !scanning && (
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-dashed border-gray-200 bg-white text-center">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
            <Search className="w-5 h-5 text-amber-600" />
          </div>
          <Button type="button" onClick={scan} className="bg-amber-600 hover:bg-amber-700 text-white">
            Scan for Orphan Records
          </Button>
        </div>
      )}

      {scanning && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Scanning database for orphan records...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && !scanning && (
        <>
          {totalOrphans === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-dashed border-green-200 bg-green-50 text-center">
              <Check className="w-6 h-6 text-green-600" />
              <p className="text-sm font-semibold text-green-700">No orphan records found</p>
              <p className="text-xs text-green-600">Your database is clean.</p>
              <Button type="button" variant="ghost" size="sm" onClick={scan} className="mt-2 text-green-700 hover:bg-green-100">
                <RefreshCw className="w-3.5 h-3.5" />
                Re-scan
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">{totalOrphans}</span> orphan record(s) found
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={scan} className="text-gray-500 hover:bg-gray-100">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-scan
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={deleteSelected}
                    disabled={selectedIds.size === 0 || deleting}
                    className="bg-rose-600 hover:bg-rose-700 text-white gap-1"
                  >
                    {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {deleting ? "Cleaning..." : `Clean ${selectedIds.size > 0 ? `(${selectedIds.size})` : ""}`}
                  </Button>
                </div>
              </div>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Selected records will be permanently deleted or cleaned of stale references. This cannot be undone.
                </div>
              )}

              <div className="space-y-2">
                {Object.entries(grouped).map(([entityType, orphans]) => (
                  <OrphanGroup
                    key={entityType}
                    entityType={entityType}
                    orphans={orphans}
                    selectedIds={selectedIds}
                    onToggle={toggle}
                    onToggleAll={toggleAll}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}