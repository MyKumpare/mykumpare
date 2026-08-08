import React, { useState } from "react";
import { RefreshCw, Check, AlertTriangle, Eraser, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

// Placeholder strings that should be treated as "no data" and cleared.
const PLACEHOLDERS = [
  "not_available", "not_provided", "n_a", "not available", "not provided",
  "n/a", "null", "undefined", "none", "unknown", "-",
];

// String fields to scan on each entity type.
const ENTITY_FIELDS = {
  Contact: ["email", "linkedin_url", "biography", "photo_url", "title", "bio_url"],
  Firm: ["email", "website", "linkedin_url", "description", "logo_url", "name"],
};

const ENTITY_LABELS = {
  Contact: "Contacts",
  Firm: "Firms",
};

function isPlaceholder(val) {
  if (!val || typeof val !== "string") return false;
  const lower = val.trim().toLowerCase().replace(/_/g, " ");
  return PLACEHOLDERS.includes(lower);
}

// Scan a single entity type, paginating through all records.
// Returns an array of { id, name, fields: ["email", ...] }.
async function scanEntity(entityName, fields) {
  const dirty = [];
  let skip = 0;
  let hasMore = true;
  while (hasMore) {
    const batch = await base44.entities[entityName].list("-created_date", 500, skip);
    for (const record of batch) {
      const dirtyFields = fields.filter((f) => isPlaceholder(record[f]));
      if (dirtyFields.length > 0) {
        const name =
          entityName === "Contact"
            ? [record.first_name, record.last_name].filter(Boolean).join(" ")
            : record.name || "(unnamed)";
        dirty.push({ id: record.id, name, fields: dirtyFields });
      }
    }
    hasMore = batch.length === 500;
    skip += batch.length;
  }
  return dirty;
}

function EntityGroup({ entityName, items, selectedIds, onToggle, onToggleAll }) {
  const [open, setOpen] = useState(true);
  const allSelected = items.every((i) => selectedIds.has(`${entityName}:${i.id}`));
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 w-full px-3 py-2 bg-gray-50 hover:bg-gray-100">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 flex-1 text-left">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="text-sm font-semibold text-gray-700">{ENTITY_LABELS[entityName]}</span>
          <span className="text-xs text-gray-400">({items.length})</span>
        </button>
        <button
          onClick={() => onToggleAll(entityName, items)}
          className={`text-[11px] px-2 py-0.5 rounded ${allSelected ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}
        >
          {allSelected ? "Unselect all" : "Select all"}
        </button>
      </div>
      {open && (
        <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
          {items.map((item) => {
            const key = `${entityName}:${item.id}`;
            const selected = selectedIds.has(key);
            return (
              <div
                key={item.id}
                className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${selected ? "border-indigo-300 bg-indigo-50" : "border-gray-100 bg-white hover:bg-gray-50"}`}
              >
                <button
                  onClick={() => onToggle(entityName, item.id)}
                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300"}`}
                >
                  {selected && <Check className="w-3 h-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-800 truncate">{item.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.fields.map((f) => (
                      <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PlaceholderCleanup() {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [results, setResults] = useState(null); // { Contact: [...], Firm: [...] }
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const scan = async () => {
    setScanning(true);
    setError(null);
    setResults(null);
    setSelectedIds(new Set());
    try {
      const [contacts, firms] = await Promise.all([
        scanEntity("Contact", ENTITY_FIELDS.Contact),
        scanEntity("Firm", ENTITY_FIELDS.Firm),
      ]);
      setResults({ Contact: contacts, Firm: firms });
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const toggle = (entityName, id) => {
    const key = `${entityName}:${id}`;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = (entityName, items) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const keys = items.map((i) => `${entityName}:${i.id}`);
      const allSelected = keys.every((k) => next.has(k));
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const totalFound = results ? results.Contact.length + results.Firm.length : 0;

  const cleanAll = async () => {
    setCleaning(true);
    setError(null);
    try {
      let totalCleaned = 0;
      for (const entityName of ["Contact", "Firm"]) {
        const items = results[entityName] || [];
        const updates = items.map((item) => {
          const update = { id: item.id };
          for (const f of item.fields) update[f] = "";
          return update;
        });
        if (updates.length > 0) {
          await base44.entities[entityName].bulkUpdate(updates);
          totalCleaned += updates.length;
        }
      }
      toast({
        title: "Placeholder cleanup complete",
        description: `${totalCleaned} record(s) cleaned.`,
      });
      setResults(null);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setCleaning(false);
    }
  };

  const cleanSelected = async () => {
    if (selectedIds.size === 0) return;
    setCleaning(true);
    setError(null);
    try {
      let totalCleaned = 0;
      for (const entityName of ["Contact", "Firm"]) {
        const items = (results[entityName] || []).filter((i) =>
          selectedIds.has(`${entityName}:${i.id}`)
        );
        const updates = items.map((item) => {
          const update = { id: item.id };
          for (const f of item.fields) update[f] = "";
          return update;
        });
        if (updates.length > 0) {
          await base44.entities[entityName].bulkUpdate(updates);
          totalCleaned += updates.length;
        }
      }
      toast({
        title: "Placeholder cleanup complete",
        description: `${totalCleaned} record(s) cleaned.`,
      });
      await scan();
    } catch (err) {
      setError(err.message);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Eraser className="w-4 h-4 text-indigo-600" />
        <p className="text-sm font-semibold text-gray-700">Placeholder Cleanup</p>
      </div>
      <p className="text-xs text-gray-500">
        Scans all Contact and Firm records for inconsistent placeholder values (e.g. "not_available", "n/a", "unknown")
        that were stored during enrichment instead of being left blank, and clears them in one go.
      </p>

      {!results && !scanning && (
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-dashed border-gray-200 bg-white text-center">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
            <Eraser className="w-5 h-5 text-indigo-600" />
          </div>
          <Button type="button" onClick={scan} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Scan for Placeholder Values
          </Button>
        </div>
      )}

      {scanning && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Scanning all records for placeholder values...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {results && !scanning && (
        <>
          {totalFound === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-dashed border-green-200 bg-green-50 text-center">
              <Check className="w-6 h-6 text-green-600" />
              <p className="text-sm font-semibold text-green-700">No placeholder values found</p>
              <p className="text-xs text-green-600">All records are clean.</p>
              <Button type="button" variant="ghost" size="sm" onClick={scan} className="mt-2 text-green-700 hover:bg-green-100">
                <RefreshCw className="w-3.5 h-3.5" />
                Re-scan
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">{totalFound}</span> record(s) with placeholder values
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={scan} className="text-gray-500 hover:bg-gray-100">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-scan
                  </Button>
                  {selectedIds.size > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={cleanSelected}
                      disabled={cleaning}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                    >
                      {cleaning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eraser className="w-3.5 h-3.5" />}
                      {cleaning ? "Cleaning..." : `Clean Selected (${selectedIds.size})`}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={cleanAll}
                      disabled={cleaning}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                    >
                      {cleaning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eraser className="w-3.5 h-3.5" />}
                      {cleaning ? "Cleaning..." : "Clean All"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                Placeholder fields will be set to blank. This cannot be undone.
              </div>

              <div className="space-y-2">
                {results.Contact.length > 0 && (
                  <EntityGroup
                    entityName="Contact"
                    items={results.Contact}
                    selectedIds={selectedIds}
                    onToggle={toggle}
                    onToggleAll={toggleAll}
                  />
                )}
                {results.Firm.length > 0 && (
                  <EntityGroup
                    entityName="Firm"
                    items={results.Firm}
                    selectedIds={selectedIds}
                    onToggle={toggle}
                    onToggleAll={toggleAll}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}