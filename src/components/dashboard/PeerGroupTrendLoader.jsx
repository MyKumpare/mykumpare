import React, { useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Compact dropdown that lists Xponance Peer Groups and, on selection,
 * resolves the group's member products to their owning firms and pushes
 * those firm ids into the AUM trend comparison (capped to MAX_FIRMS).
 *
 * Props:
 *  - firms: full firm list available for comparison (used to resolve ids → names)
 *  - onApply: (firmIds: string[]) => void  — receives the resolved firm ids
 *  - maxFirms: number — cap applied to the resolved selection
 */
export default function PeerGroupTrendLoader({ firms = [], onApply, maxFirms = 6 }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    let active = true;
    base44.entities.XponancePeerGroup.list()
      .then((list) => active && setGroups(Array.isArray(list) ? list : []))
      .catch(() => active && setGroups([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const firmIdSet = useMemo(() => new Set(firms.map((f) => f.id)), [firms]);

  const applyGroup = async (group) => {
    setOpen(false);
    if (!group || !onApply) return;
    setBusy(true);
    try {
      const memberIds = Array.isArray(group.member_product_ids) ? group.member_product_ids : [];
      let resolvedFirmIds = [];
      if (memberIds.length) {
        // Fetch member products in one filtered call, then map to firm_ids.
        const products = await base44.entities.Product.filter({ id: { $in: memberIds } });
        const seen = new Set();
        for (const p of (Array.isArray(products) ? products : [])) {
          if (p?.firm_id && !seen.has(p.firm_id)) {
            seen.add(p.firm_id);
            resolvedFirmIds.push(p.firm_id);
          }
        }
      }
      // Keep only firms that exist in the available list, cap to max.
      const usable = resolvedFirmIds.filter((id) => firmIdSet.has(id)).slice(0, maxFirms);
      onApply(usable);
    } catch (e) {
      // swallow — non-critical optional loader
    } finally {
      setBusy(false);
    }
  };

  if (loading || groups.length === 0) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50"
      >
        <Users className="w-3.5 h-3.5 text-indigo-500" />
        {busy ? "Loading…" : "Add a peer group"}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-64 max-h-72 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => applyGroup(g)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 border-b border-gray-50 last:border-b-0"
            >
              <div className="font-medium text-gray-800 truncate">{g.name}</div>
              <div className="text-xs text-gray-400">
                {(g.member_product_ids?.length || 0)} member product(s)
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}