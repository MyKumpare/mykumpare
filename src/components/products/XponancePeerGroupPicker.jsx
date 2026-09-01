import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, ChevronDown, Check, X, Settings2 } from "lucide-react";

/**
 * Dropdown picker for assigning an Xponance Peer Group to an Investment Manager
 * product. Lists all peer groups for the tenant; selecting one stores both the
 * id and denormalized name on the product. Includes a clear option and a quick
 * link to open the Peer Group manager (utility module).
 *
 * Props:
 *  - value: { id, name }
 *  - onChange: (value) => void  — called with { id, name } or { id: "", name: "" }
 *  - isEditing: boolean
 *  - onManage: optional callback to open the Peer Group manager
 */
export default function XponancePeerGroupPicker({ value, onChange, isEditing, onManage }) {
  const [open, setOpen] = useState(false);

  const { data: peerGroups = [], isLoading } = useQuery({
    queryKey: ["xponancePeerGroups"],
    queryFn: () => base44.entities.XponancePeerGroup.list("name"),
  });

  const sorted = useMemo(
    () => [...peerGroups].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [peerGroups]
  );

  if (!isEditing) {
    return (
      <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm">
        {value?.name ? (
          <span className="inline-flex items-center gap-1.5 text-gray-800">
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            {value.name}
            <span className="text-gray-400 text-xs">
              ({(sorted.find((g) => g.id === value.id)?.member_product_ids || []).length} members)
            </span>
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 text-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          {value?.name ? (
            <span className="truncate text-gray-800">{value.name}</span>
          ) : (
            <span className="text-gray-400">Select peer group…</span>
          )}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto">
            {isLoading ? (
              <div className="p-3 text-center text-xs text-gray-400">Loading…</div>
            ) : sorted.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">
                No peer groups yet.
                {onManage && (
                  <button
                    type="button"
                    onClick={() => { setOpen(false); onManage(); }}
                    className="block mx-auto mt-1 text-indigo-600 hover:underline"
                  >
                    Create one in Peer Groups
                  </button>
                )}
              </div>
            ) : (
              <>
                {value?.id && (
                  <button
                    type="button"
                    onClick={() => { onChange({ id: "", name: "" }); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50 border-b"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear assignment
                  </button>
                )}
                {sorted.map((g) => {
                  const selected = g.id === value?.id;
                  const count = (g.member_product_ids || []).length;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { onChange({ id: g.id, name: g.name }); setOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-indigo-50 ${selected ? "bg-indigo-50/60" : ""}`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <span className="truncate">
                          <span className="font-medium text-gray-800">{g.name}</span>
                          {g.description && <span className="text-gray-400 block truncate">{g.description}</span>}
                        </span>
                      </span>
                      <span className="text-gray-400 text-[10px] shrink-0 ml-2">{count} member{count === 1 ? "" : "s"}</span>
                    </button>
                  );
                })}
                {onManage && (
                  <button
                    type="button"
                    onClick={() => { setOpen(false); onManage(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-indigo-600 hover:bg-indigo-50 border-t"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Manage Peer Groups…
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}