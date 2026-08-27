import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const INFLUENCE_LEVELS = [
  "Final Decision Maker",
  "Decision Maker",
  "Influencer",
  "Follower",
  "Undetermined",
];

const LEVEL_COLORS = {
  "Final Decision Maker": "#dc2626",
  "Decision Maker": "#f59e0b",
  "Influencer": "#6366f1",
  "Follower": "#0ea5e9",
  "Undetermined": "#94a3b8",
};

function formatContactName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
}

function getFirmTypes(f) {
  return f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
}

export default function ContactNetworkBulkEditList({ firms, contacts, search, firmTypeFilter }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLevel, setBulkLevel] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const activeFirms = useMemo(() => firms.filter((f) => !f.deleted_at), [firms]);
  const firmMap = useMemo(() => new Map(activeFirms.map((f) => [f.id, f])), [activeFirms]);

  // Build the list of contacts with firm info, filtered the same way as the graph
  const listContacts = useMemo(() => {
    const firmIdSet = new Set(
      firmTypeFilter === "All"
        ? activeFirms.map((f) => f.id)
        : activeFirms.filter((f) => getFirmTypes(f).includes(firmTypeFilter)).map((f) => f.id)
    );

    let relevant = contacts
      .filter((c) => !c.deleted_at && c.firm_ids?.length)
      .map((c) => {
        const visibleFirmIds = (c.firm_ids || []).filter((id) => firmIdSet.has(id));
        const firmNames = visibleFirmIds
          .map((id) => firmMap.get(id)?.name)
          .filter(Boolean);
        return { ...c, _firmNames: firmNames, _firmCount: visibleFirmIds.length };
      })
      .filter((c) => c._firmCount > 0);

    if (search.trim()) {
      const q = search.toLowerCase();
      relevant = relevant.filter((c) => {
        const fullName = formatContactName(c).toLowerCase();
        return (
          fullName.includes(q) ||
          (c.title || "").toLowerCase().includes(q) ||
          c._firmNames.some((n) => n.toLowerCase().includes(q))
        );
      });
    }

    // Sort
    relevant.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = formatContactName(a).localeCompare(formatContactName(b));
      } else if (sortKey === "firms") {
        cmp = b._firmCount - a._firmCount;
      } else if (sortKey === "level") {
        const ai = INFLUENCE_LEVELS.indexOf(a.influence_level || "Undetermined");
        const bi = INFLUENCE_LEVELS.indexOf(b.influence_level || "Undetermined");
        cmp = ai - bi;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return relevant;
  }, [contacts, activeFirms, firmMap, firmTypeFilter, search, sortKey, sortDir]);

  const allSelected = listContacts.length > 0 && listContacts.every((c) => selectedIds.has(c.id));
  const someSelected = listContacts.some((c) => selectedIds.has(c.id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(listContacts.map((c) => c.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, level }) => {
      const updates = ids.map((id) => ({ id, influence_level: level }));
      return base44.entities.Contact.bulkUpdate(updates);
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Influence level updated",
        description: `Updated ${variables.ids.length} contact${variables.ids.length !== 1 ? "s" : ""} to "${variables.level}".`,
      });
      setSelectedIds(new Set());
      setBulkLevel("");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contactNetwork"] });
    },
    onError: (err) => {
      toast({
        title: "Update failed",
        description: err?.message || "Could not update influence levels. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleApplyBulk = () => {
    if (!bulkLevel || selectedIds.size === 0) return;
    bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), level: bulkLevel });
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }) =>
    sortKey === col ? (
      sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
    ) : null;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Bulk edit bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.size} selected
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={clearSelection}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={bulkLevel}
            onChange={(e) => setBulkLevel(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            disabled={selectedIds.size === 0}
          >
            <option value="">Choose influence level…</option>
            {INFLUENCE_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleApplyBulk}
            disabled={!bulkLevel || selectedIds.size === 0 || bulkUpdateMutation.isPending}
          >
            {bulkUpdateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            Apply to {selectedIds.size > 0 ? selectedIds.size : "Selected"}
          </Button>
        </div>
        <span className="ml-auto text-xs text-gray-400">
          {listContacts.length} contacts in network
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                />
              </th>
              <th
                className="px-3 py-2 cursor-pointer hover:text-gray-700 select-none"
                onClick={() => handleSort("name")}
              >
                <span className="inline-flex items-center gap-1">Name <SortIcon col="name" /></span>
              </th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Firms</th>
              <th
                className="px-3 py-2 cursor-pointer hover:text-gray-700 select-none"
                onClick={() => handleSort("firms")}
              >
                <span className="inline-flex items-center gap-1"># <SortIcon col="firms" /></span>
              </th>
              <th
                className="px-3 py-2 cursor-pointer hover:text-gray-700 select-none"
                onClick={() => handleSort("level")}
              >
                <span className="inline-flex items-center gap-1">Influence <SortIcon col="level" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {listContacts.map((c) => {
              const isSelected = selectedIds.has(c.id);
              const level = c.influence_level || "Undetermined";
              return (
                <tr
                  key={c.id}
                  className={`border-b border-gray-100 transition-colors ${
                    isSelected ? "bg-indigo-50" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(c.id)}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold bg-pink-500">
                          {[c.first_name?.[0], c.last_name?.[0]].filter(Boolean).join("").toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-gray-800">{formatContactName(c)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate">{c.title || "—"}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[260px]">
                    <div className="flex flex-wrap gap-1">
                      {c._firmNames.slice(0, 3).map((name, i) => (
                        <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-xs text-gray-600 truncate max-w-[120px]">
                          {name}
                        </span>
                      ))}
                      {c._firmNames.length > 3 && (
                        <span className="text-xs text-gray-400">+{c._firmNames.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600 font-medium">{c._firmCount}</td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: `${LEVEL_COLORS[level]}15`,
                        color: LEVEL_COLORS[level],
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: LEVEL_COLORS[level] }} />
                      {level}
                    </span>
                  </td>
                </tr>
              );
            })}
            {listContacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-gray-400 text-sm">
                  No contacts match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}