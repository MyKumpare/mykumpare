import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Network, Loader2, Info, Building2, Search, X, Filter } from "lucide-react";
import ContactNetworkGraph from "@/components/network/ContactNetworkGraph";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const FIRM_TYPE_COLORS = {
  "Investment Manager": "#6366f1",
  "Allocator": "#10b981",
  "Investment Consultant": "#f59e0b",
  "Securities Brokerage": "#ef4444",
  "Trade Organizations": "#14b8a6",
  "Multi-Manager": "#8b5cf6",
  "Other": "#64748b",
};

const EDGE_COLORS = {
  sub_manager: "#6366f1",
  consultant: "#f59e0b",
  shared_contact: "#ec4899",
};

const EDGE_LABELS = {
  sub_manager: "Sub-manager",
  consultant: "Consultant",
  shared_contact: "Shared contact",
};

function getFirmTypes(f) {
  return f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
}

function colorFor(f) {
  const types = getFirmTypes(f);
  return FIRM_TYPE_COLORS[types[0]] || "#6366f1";
}

/**
 * FirmNetworkMapPage — global firm-to-firm relationship visualization.
 * Displays every connected firm as a node and draws lines for three
 * relationship types derived from existing data:
 *   1. Sub-manager: multi-manager product → underlying IM firms
 *   2. Consultant: allocator firm ↔ investment consultant firm
 *   3. Shared contact: firms sharing at least one contact in common
 */
export default function FirmNetworkMapPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState({
    sub_manager: true,
    consultant: true,
    shared_contact: true,
  });
  const [onlyConnected, setOnlyConnected] = useState(true);

  const { data: allFirms = [], isFetching: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 2000),
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 3000),
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ["firm-consultants"],
    queryFn: () => base44.entities.FirmConsultant.list("-created_date", 3000),
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { nodes, edges, stats, relMap } = useMemo(() => {
    const firmMap = new Map(allFirms.filter(f => !f.deleted_at).map(f => [f.id, f]));
    const liveProducts = allProducts.filter(p => !p.deleted_at);
    const liveConsultants = consultants.filter(c => !c.deleted_at);
    const liveContacts = allContacts.filter(c => !c.deleted_at);

    // adjacency: firmId -> Map<otherFirmId, Set<relType>>
    const adjacency = new Map();

    const addLink = (a, b, type) => {
      if (!a || !b || a === b || !firmMap.has(a) || !firmMap.has(b)) return;
      if (!adjacency.has(a)) adjacency.set(a, new Map());
      if (!adjacency.has(b)) adjacency.set(b, new Map());
      const ab = adjacency.get(a);
      if (!ab.has(b)) ab.set(b, new Set());
      ab.get(b).add(type);
      const ba = adjacency.get(b);
      if (!ba.has(a)) ba.set(a, new Set());
      ba.get(a).add(type);
    };

    // 1. Sub-manager relationships via products
    for (const p of liveProducts) {
      const subIds = p.sub_manager_firm_ids || [];
      subIds.forEach(sid => addLink(p.firm_id, sid, "sub_manager"));
    }

    // 2. Consultant relationships
    for (const c of liveConsultants) {
      addLink(c.firm_id, c.consultant_firm_id, "consultant");
    }

    // 3. Shared contact relationships — firms sharing contacts
    const contactFirms = new Map(); // contactId -> Set<firmId>
    for (const c of liveContacts) {
      (c.firm_ids || []).forEach(fid => {
        if (!firmMap.has(fid)) return;
        if (!contactFirms.has(c.id)) contactFirms.set(c.id, new Set());
        contactFirms.get(c.id).add(fid);
      });
    }
    for (const firmSet of contactFirms.values()) {
      const ids = [...firmSet];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          addLink(ids[i], ids[j], "shared_contact");
        }
      }
    }

    // Determine which firms to include based on filters
    const includeFirm = (firmId) => {
      if (!onlyConnected) return true;
      const neighbors = adjacency.get(firmId);
      if (!neighbors || neighbors.size === 0) return false;
      // has at least one active relationship type
      for (const types of neighbors.values()) {
        if ([...types].some(t => activeTypes[t])) return true;
      }
      return false;
    };

    // Apply search filter
    const matchesSearch = (f) => {
      if (!search.trim()) return true;
      return f.name?.toLowerCase().includes(search.toLowerCase());
    };

    const visibleFirms = allFirms.filter(f => !f.deleted_at && includeFirm(f.id) && matchesSearch(f));

    // Build edges — dedupe pairs, only include if at least one active type
    const edgeSet = new Set();
    const builtEdges = [];
    const builtRelMap = {};

    for (const f of visibleFirms) {
      const neighbors = adjacency.get(f.id);
      if (!neighbors) continue;
      for (const [otherId, types] of neighbors) {
        const other = firmMap.get(otherId);
        if (!other || !visibleFirms.find(vf => vf.id === otherId)) continue;
        const activeRels = [...types].filter(t => activeTypes[t]);
        if (activeRels.length === 0) continue;
        const key = [f.id, otherId].sort().join(":");
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);
        const primary = activeRels[0];
        builtEdges.push({
          source: `firm-${f.id}`,
          target: `firm-${otherId}`,
          color: EDGE_COLORS[primary] || "#94a3b8",
          relType: primary,
        });
        builtRelMap[`${f.id}:${otherId}`] = types;
        builtRelMap[`${otherId}:${f.id}`] = types;
      }
    }

    const builtNodes = visibleFirms.map(f => {
      const neighborCount = adjacency.get(f.id)?.size || 0;
      return {
        id: `firm-${f.id}`,
        label: f.name,
        type: "firm",
        color: colorFor(f),
        radius: 10 + Math.min(12, Math.sqrt(neighborCount) * 2),
        _entity: f,
        _entityType: "firm",
        _degree: neighborCount,
      };
    });

    return {
      nodes: builtNodes,
      edges: builtEdges,
      stats: {
        total: visibleFirms.length,
        sub_manager: [...adjacency.values()].reduce((acc, m) => {
          for (const types of m.values()) if (types.has("sub_manager")) acc++;
          return acc;
        }, 0) / 2,
        consultant: [...adjacency.values()].reduce((acc, m) => {
          for (const types of m.values()) if (types.has("consultant")) acc++;
          return acc;
        }, 0) / 2,
        shared_contact: [...adjacency.values()].reduce((acc, m) => {
          for (const types of m.values()) if (types.has("shared_contact")) acc++;
          return acc;
        }, 0) / 2,
      },
      relMap: builtRelMap,
    };
  }, [allFirms, allProducts, consultants, allContacts, activeTypes, onlyConnected, search]);

  const selectedNode = nodes.find(n => n.id === selectedId);

  const toggleType = (t) => {
    setActiveTypes(prev => ({ ...prev, [t]: !prev[t] }));
    setResetKey(k => k + 1);
  };

  const openFirmProfile = (firm) => {
    navigate(`/?openFirm=${firm.id}`);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Network className="w-6 h-6 text-indigo-600" />
          Firm Network Map
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Visualizes how investment firms are linked to each other through shared contacts, sub-manager products, and consultant relationships.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search firms by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-100 text-indigo-700 font-medium text-xs">
            <Building2 className="w-3 h-3" /> {nodes.length} firm{nodes.length !== 1 ? "s" : ""}
          </span>
          {[
            { key: "sub_manager", label: "Sub-manager", color: "bg-indigo-100 text-indigo-700" },
            { key: "consultant", label: "Consultant", color: "bg-amber-100 text-amber-700" },
            { key: "shared_contact", label: "Shared contact", color: "bg-pink-100 text-pink-700" },
          ].map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => toggleType(t.key)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium border transition-colors text-xs ${
                activeTypes[t.key] ? `${t.color} border-current/20` : "bg-gray-50 text-gray-400 border-gray-200"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: activeTypes[t.key] ? EDGE_COLORS[t.key] : "#cbd5e1" }}
              />
              {t.label}
              <span className="opacity-60">({Math.round(stats[t.key] || 0)})</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setOnlyConnected(prev => !prev); setResetKey(k => k + 1); }}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium border transition-colors text-xs ${
              onlyConnected ? "bg-gray-100 text-gray-700 border-gray-300" : "bg-gray-50 text-gray-400 border-gray-200"
            }`}
            title="Toggle showing firms with no connections"
          >
            <Filter className="w-3 h-3" />
            {onlyConnected ? "Connected only" : "All firms"}
          </button>
        </div>
      </div>

      {/* Graph */}
      {nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-gray-200 rounded-xl">
          <Network className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 font-medium">
            {firmsLoading ? "Loading firms..." : "No firms match the current filters"}
          </p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            Connections appear when firms share sub-manager products, consultants, or contacts with other firms. Try enabling more relationship types or clearing the search.
          </p>
        </div>
      ) : (
        <div className="relative border border-gray-200 rounded-xl bg-white overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
          {firmsLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : (
            <ContactNetworkGraph
              key={resetKey}
              nodes={nodes}
              edges={edges}
              onNodeClick={(n) => setSelectedId(n.id)}
              highlightId={selectedId}
            />
          )}

          {selectedNode && (
            <div className="absolute bottom-3 left-3 max-w-xs bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ background: selectedNode.color }}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-800 truncate">{selectedNode.label}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {getFirmTypes(selectedNode._entity).join(", ") || "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedNode._degree} connection{selectedNode._degree !== 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
              </div>
              <button
                type="button"
                onClick={() => openFirmProfile(selectedNode._entity)}
                className="mt-2 w-full text-xs text-indigo-600 hover:text-indigo-700 font-medium border border-indigo-200 rounded-md py-1.5 hover:bg-indigo-50 transition-colors"
              >
                Open firm profile
              </button>
            </div>
          )}

          <div className="absolute top-3 right-3 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md border border-gray-200 flex items-center gap-1">
            <Info className="w-3 h-3" /> Click a node for details · Drag to rearrange · Scroll to zoom
          </div>
        </div>
      )}
    </div>
  );
}