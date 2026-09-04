import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { UserCircle2, X, Loader2 } from "lucide-react";

const getFullName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

const ENTITY_CONFIG = {
  Product: { entity: base44.entities.Product, label: "product", theme: "violet" },
  Firm: { entity: base44.entities.Firm, label: "firm", theme: "indigo" },
};

/**
 * Sticky bulk-reassign bar shown when items are selected on a coverage dashboard.
 *
 * Props:
 *  - selectedItems: (Product|Firm)[] currently selected
 *  - xponanceContacts: Contact[] (tenant analysts) to choose from
 *  - entityType: "Product" | "Firm" (drives which entity is bulk-updated)
 *  - onDone: () => void — called after a successful bulk update (parent refreshes + clears)
 *  - onClear: () => void — clear the selection
 */
export default function BulkReassignBar({ selectedItems, xponanceContacts, entityType = "Product", onDone, onClear }) {
  const [role, setRole] = useState("primary");
  const [analystId, setAnalystId] = useState("");
  const [clearMode, setClearMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const config = ENTITY_CONFIG[entityType] || ENTITY_CONFIG.Product;
  const entityLabel = config.label;
  const themeColor = config.theme;

  const sortedContacts = [...xponanceContacts].sort((a, b) =>
    getFullName(a).localeCompare(getFullName(b))
  );

  const canApply = clearMode || analystId;

  const handleApply = async () => {
    if (!selectedItems.length) return;
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
      const updates = selectedItems.map((item) => {
        const next = clearMode
          ? { [idField]: "", [nameField]: "" }
          : { [idField]: analystId, [nameField]: contactName };
        return { id: item.id, ...next };
      });
      await config.entity.bulkUpdate(updates);
      onDone();
    } catch (err) {
      console.error("Bulk reassign failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const themeClasses = {
    violet: { bar: "bg-violet-600 border-violet-400", btn: "text-violet-700 hover:bg-violet-50", ring: "focus:ring-violet-400" },
    indigo: { bar: "bg-indigo-600 border-indigo-400", btn: "text-indigo-700 hover:bg-indigo-50", ring: "focus:ring-indigo-400" },
  };
  const tc = themeClasses[themeColor];

  return (
    <div className="sticky bottom-4 z-40 mx-auto max-w-3xl">
      <div className={`${tc.bar} text-white rounded-xl shadow-2xl border px-4 py-3 flex flex-wrap items-center gap-3`}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 text-sm font-bold">
            {selectedItems.length}
          </span>
          <span className="text-sm font-medium">
            {selectedItems.length === 1 ? `${entityLabel} selected` : `${entityLabel}s selected`}
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
            className={`h-8 flex-1 rounded-md bg-white text-gray-800 border border-white/30 text-sm px-2 focus:outline-none focus:ring-2 ${tc.ring} disabled:opacity-50`}
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
          title={`Clear the selected role's assignment on all selected ${entityLabel}s`}
        >
          {clearMode ? "Clearing ✓" : "Clear"}
        </button>

        <button
          type="button"
          onClick={handleApply}
          disabled={saving || !canApply}
          className={`h-8 px-4 rounded-md bg-white ${tc.btn} text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5`}
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