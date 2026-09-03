import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { UserCircle2, X, Loader2 } from "lucide-react";

const getFullName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

/**
 * Sticky bulk-reassign bar shown when products are selected on the coverage dashboard.
 *
 * Props:
 *  - selectedProducts: Product[] currently selected
 *  - xponanceContacts: Contact[] (tenant analysts) to choose from
 *  - onDone: () => void — called after a successful bulk update (parent refreshes + clears)
 *  - onClear: () => void — clear the selection
 */
export default function BulkReassignBar({ selectedProducts, xponanceContacts, onDone, onClear }) {
  const [role, setRole] = useState("primary");
  const [analystId, setAnalystId] = useState("");
  const [clearMode, setClearMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const sortedContacts = [...xponanceContacts].sort((a, b) =>
    getFullName(a).localeCompare(getFullName(b))
  );

  const canApply = clearMode || analystId;

  const handleApply = async () => {
    if (!selectedProducts.length) return;
    if (!clearMode && !analystId) return;
    setSaving(true);
    try {
      const idField = role === "primary" ? "primary_xponance_contact_id" : "secondary_xponance_contact_id";
      const nameField = role === "primary" ? "primary_xponance_contact_name" : "secondary_xponance_contact_name";
      let contactName = "";
      if (!clearMode && analystId) {
        const c = xponanceContacts.find((x) => x.id === analystId);
        contactName = c ? getFullName(c) : "";
      }
      const updates = selectedProducts.map((p) => {
        const next = clearMode
          ? { [idField]: "", [nameField]: "" }
          : { [idField]: analystId, [nameField]: contactName };
        // avoid clobbering the other role's assignment
        return { id: p.id, ...next };
      });
      await base44.entities.Product.bulkUpdate(updates);
      onDone();
    } catch (err) {
      console.error("Bulk reassign failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sticky bottom-4 z-40 mx-auto max-w-3xl">
      <div className="bg-violet-600 text-white rounded-xl shadow-2xl border border-violet-400 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 text-sm font-bold">
            {selectedProducts.length}
          </span>
          <span className="text-sm font-medium">
            {selectedProducts.length === 1 ? "product selected" : "products selected"}
          </span>
        </div>

        <div className="h-6 w-px bg-white/30" />

        <div className="flex items-center gap-2">
          <label className="text-xs text-white/80">Reassign</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={saving}
            className="h-8 rounded-md bg-white/15 border border-white/30 text-sm px-2 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
          >
            <option value="primary" className="text-gray-800">Primary Analyst</option>
            <option value="secondary" className="text-gray-800">Secondary Analyst</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <select
            value={analystId}
            onChange={(e) => { setAnalystId(e.target.value); setClearMode(false); }}
            disabled={saving || clearMode}
            className="h-8 flex-1 rounded-md bg-white text-gray-800 border border-white/30 text-sm px-2 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
          >
            <option value="">Select analyst…</option>
            {sortedContacts.map((c) => (
              <option key={c.id} value={c.id}>{getFullName(c)}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => { setClearMode((v) => !v); setAnalystId(""); }}
          disabled={saving}
          className={`h-8 px-3 rounded-md text-xs font-medium transition-colors border disabled:opacity-50 ${
            clearMode
              ? "bg-white text-red-600 border-white"
              : "bg-white/15 text-white border-white/30 hover:bg-white/25"
          }`}
          title="Clear the selected role's assignment on all selected products"
        >
          {clearMode ? "Clearing ✓" : "Clear"}
        </button>

        <button
          type="button"
          onClick={handleApply}
          disabled={saving || !canApply}
          className="h-8 px-4 rounded-md bg-white text-violet-700 text-sm font-semibold hover:bg-violet-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCircle2 className="w-3.5 h-3.5" />}
          Apply
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={saving}
          className="h-8 w-8 rounded-md bg-white/15 hover:bg-white/25 flex items-center justify-center disabled:opacity-50"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}