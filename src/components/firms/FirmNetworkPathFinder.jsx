import React, { useMemo, useState } from "react";
import { Search, X, Route, ArrowRight, Building2, Users, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { bfsShortestPath, getSharedContacts, formatContactName } from "./firmNetworkUtils";

const EDGE_LABELS = {
  sub_manager: "Sub-manager",
  consultant: "Consultant",
  shared_contact: "Shared contact",
};

const EDGE_COLORS = {
  sub_manager: "bg-indigo-100 text-indigo-700",
  consultant: "bg-amber-100 text-amber-700",
  shared_contact: "bg-pink-100 text-pink-700",
};

function FirmSearchSelect({ firms, value, onChange, placeholder, excludeId }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return firms.slice(0, 50);
    const q = query.toLowerCase();
    return firms.filter(f => f.name?.toLowerCase().includes(q)).slice(0, 50);
  }, [firms, query]);

  const selected = firms.find(f => f.id === value);

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center gap-2 border border-gray-200 rounded-md px-2 py-1.5 bg-gray-50">
          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-xs font-medium text-gray-700 truncate flex-1">{selected.name}</span>
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(""); }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            className="h-8 pl-8 text-xs"
          />
          {open && filtered.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
              {filtered.map(f => (
                <button
                  key={f.id}
                  type="button"
                  disabled={f.id === excludeId}
                  onClick={() => { onChange(f.id); setQuery(""); setOpen(false); }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-indigo-50 border-b border-gray-50 last:border-0 flex items-center gap-2 ${
                    f.id === excludeId ? "opacity-40 cursor-not-allowed" : ""
                  }`}
                >
                  <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FirmNetworkPathFinder({ firms, adjacency, relMap, contacts, activeTypes, onPathHighlight }) {
  const [sourceId, setSourceId] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [pathResult, setPathResult] = useState(null);

  const findPath = () => {
    if (!sourceId || !targetId) return;
    const path = bfsShortestPath(adjacency, sourceId, targetId, activeTypes);
    if (!path) {
      setPathResult({ path: null, length: 0 });
      onPathHighlight(null);
      return;
    }
    // Build path details: for each step, show relationship types + shared contacts
    const steps = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const types = relMap[`${a}:${b}`] || new Set();
      const typeList = [...types];
      const shared = typeList.includes("shared_contact")
        ? getSharedContacts(a, b, contacts)
        : [];
      steps.push({
        fromId: a,
        toId: b,
        fromName: firms.find(f => f.id === a)?.name || a,
        toName: firms.find(f => f.id === b)?.name || b,
        types: typeList,
        sharedContacts: shared,
      });
    }
    setPathResult({ path, steps, length: path.length - 1 });
    // Highlight all path firm nodes on the graph
    const nodeIds = new Set(path.map(id => `firm-${id}`));
    onPathHighlight(nodeIds);
  };

  const clearPath = () => {
    setPathResult(null);
    setSourceId(null);
    setTargetId(null);
    onPathHighlight(null);
  };

  const firmMap = useMemo(() => new Map(firms.map(f => [f.id, f])), [firms]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
        <Route className="w-3.5 h-3.5 text-amber-500" />
        Shortest Path Finder
      </div>
      <p className="text-[11px] text-gray-500 leading-snug">
        Select two firms to find the shortest connection path through the firm network. Intermediary firms and the contacts linking them are shown below.
      </p>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">Source firm</label>
          <FirmSearchSelect
            firms={firms}
            value={sourceId}
            onChange={setSourceId}
            placeholder="Search source firm..."
            excludeId={targetId}
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">Target firm</label>
          <FirmSearchSelect
            firms={firms}
            value={targetId}
            onChange={setTargetId}
            placeholder="Search target firm..."
            excludeId={sourceId}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={findPath}
            disabled={!sourceId || !targetId}
            className="h-7 text-xs flex-1 bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Route className="w-3 h-3" /> Find Path
          </Button>
          {(pathResult || sourceId || targetId) && (
            <Button type="button" variant="outline" size="sm" onClick={clearPath} className="h-7 text-xs">
              Clear
            </Button>
          )}
        </div>
      </div>

      {pathResult && (
        <div className="border-t border-gray-100 pt-3">
          {pathResult.path ? (
            <>
              <div className="flex items-center gap-1.5 mb-2">
                <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                  {pathResult.length} hop{pathResult.length !== 1 ? "s" : ""}
                </Badge>
                <span className="text-[11px] text-gray-500">
                  {pathResult.path.length} firms in path
                </span>
              </div>
              <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                {/* Start firm */}
                <div className="flex items-center gap-2 border border-amber-200 bg-amber-50 rounded-md px-2 py-1.5">
                  <div className="w-6 h-6 rounded bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">A</div>
                  <span className="text-xs font-medium text-gray-800 truncate">
                    {firmMap.get(pathResult.path[0])?.name || pathResult.path[0]}
                  </span>
                </div>
                {/* Steps */}
                {pathResult.steps.map((step, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-1.5 pl-3 py-0.5">
                      <Link2 className="w-3 h-3 text-gray-400" />
                      <div className="flex flex-wrap gap-1">
                        {step.types.map(t => (
                          <Badge key={t} className={`text-[9px] ${EDGE_COLORS[t] || "bg-gray-100 text-gray-600"}`}>
                            {EDGE_LABELS[t] || t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {step.sharedContacts.length > 0 && (
                      <div className="pl-7 pb-1">
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-0.5">
                          <Users className="w-2.5 h-2.5" />
                          {step.sharedContacts.length} shared contact{step.sharedContacts.length !== 1 ? "s" : ""}:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {step.sharedContacts.slice(0, 5).map(c => (
                            <span key={c.id} className="text-[10px] bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded">
                              {formatContactName(c)}
                            </span>
                          ))}
                          {step.sharedContacts.length > 5 && (
                            <span className="text-[10px] text-gray-400">
                              +{step.sharedContacts.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Next firm */}
                    <div className={`flex items-center gap-2 border rounded-md px-2 py-1.5 ${
                      i === pathResult.steps.length - 1
                        ? "border-amber-200 bg-amber-50"
                        : "border-gray-200 bg-white"
                    }`}>
                      <div className="w-6 h-6 rounded bg-gray-400 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {i === pathResult.steps.length - 1 ? "B" : String.fromCharCode(66 + i)}
                      </div>
                      <span className="text-xs font-medium text-gray-800 truncate">
                        {step.toName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <X className="w-6 h-6 text-gray-300 mx-auto mb-1" />
              <p className="text-xs text-gray-500">No path found between these firms.</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                They may be in disconnected clusters. Try enabling more relationship types.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}