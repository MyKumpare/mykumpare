import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Network, Loader2, Info, Building2 } from "lucide-react";
import ContactNetworkGraph from "@/components/network/ContactNetworkGraph";

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
 * FirmNetworkMap — firm-to-firm relationship map centered on the current firm.
 * Surfaces three relationship types from existing data:
 *   1. Sub-manager: multi-manager product → underlying IM firms (and reverse)
 *   2. Consultant: allocator firm ↔ investment consultant firm (FirmConsultant)
 *   3. Shared contact: firms sharing at least one contact in common
 *
 * Reuses the force-directed ContactNetworkGraph for rendering.
 */
export default function FirmNetworkMap({ firmId, onFirmClick }) {
  const [selectedId, setSelectedId] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [activeTypes, setActiveTypes] = useState({
    sub_manager: true,
    consultant: true,
    shared_contact: true,
  });

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
    const center = firmMap.get(firmId);
    if (!center) return { nodes: [], edges: [], stats: {}, relMap: {} };

    // connectedFirmId -> Set of relationship types
    const connected = new Map();
    const relMap = {}; // `${centerId}->otherId` -> Set of types

    const addLink = (otherId, type) => {
      if (!otherId || otherId === firmId || !firmMap.has(otherId)) return;
      if (!connected.has(otherId)) connected.set(otherId, new Set());
      connected.get(otherId).add(type);
      const key = `${firmId}:${otherId}`;
      if (!relMap[key]) relMap[key] = new Set();
      relMap[key].add(type);
    };

    // 1. Sub-manager relationships via products
    const liveProducts = allProducts.filter(p => !p.deleted_at);
    for (const p of liveProducts) {
      const subIds = p.sub_manager_firm_ids || [];
      // This firm is the MM parent → its sub-managers
      if (p.firm_id === firmId) {
        subIds.forEach(sid => addLink(sid, "sub_manager"));
      }
      // This firm is a sub-manager → the MM parent
      if (subIds.includes(firmId)) {
        addLink(p.firm_id, "sub_manager");
      }
    }

    // 2. Consultant relationships
    for (const c of consultants) {
      if (!c.deleted_at) {
        if (c.firm_id === firmId) addLink(c.consultant_firm_id, "consultant");
        if (c.consultant_firm_id === firmId) addLink(c.firm_id, "consultant");
      }
    }

    // 3. Shared contact relationships — firms sharing a contact with the center
    const centerContacts = allContacts.filter(c => !c.deleted_at && (c.firm_ids || []).includes(firmId));
    const otherFirmCounts = {};
    centerContacts.forEach(c => {
      (c.firm_ids || []).forEach(fid => {
        if (fid !== firmId && firmMap.has(fid)) {
          otherFirmCounts[fid] = (otherFirmCounts[fid] || 0) + 1;
        }
      });
    });
    Object.entries(otherFirmCounts).forEach(([fid, count]) => {
      if (count >= 1) addLink(fid, "shared_contact");
    });

    // Filter by active relationship types
    const filteredIds = [...connected.entries()]
      .filter(([, types]) => [...types].some(t => activeTypes[t]))
      .map(([id]) => id);

    // Build nodes
    const centerNode = {
      id: `firm-${center.id}`,
      label: center.name,
      type: "firm",
      color: colorFor(center),
      radius: 20,
      _entity: center,
      _entityType: "firm",
      _isCenter: true,
    };

    const otherNodes = filteredIds.map(id => {
      const f = firmMap.get(id);
      return {
        id: `firm-${id}`,
        label: f.name,
        type: "firm",
        color: colorFor(f),
        radius: 14,
        _entity: f,
        _entityType: "firm",
      };
    });

    // Build edges with the primary (first active) relationship type for coloring
    const allEdges = filteredIds.map(id => {
      const types = [...connected.get(id)].filter(t => activeTypes[t]);
      const primary = types[0];
      return {
        source: `firm-${firmId}`,
        target: `firm-${id}`,
        color: EDGE_COLORS[primary] || "#94a3b8",
        relType: primary,
      };
    });

    return {
      nodes: [centerNode, ...otherNodes],
      edges: allEdges,
      stats: {
        total: filteredIds.length,
        sub_manager: [...connected.values()].filter(s => s.has("sub_manager")).length,
        consultant: [...connected.values()].filter(s => s.has("consultant")).length,
        shared_contact: [...connected.values()].filter(s => s.has("shared_contact")).length,
      },
      relMap,
    };
  }, [allFirms, allProducts, consultants, allContacts, firmId, activeTypes]);

  const selectedNode = nodes.find(n => n.id === selectedId);

  const toggleType = (t) => {
    setActiveTypes(prev => ({ ...prev, [t]: !prev[t] }));
    setResetKey(k => k + 1);
  };

  return (
    <div className="space-y-3">
      {/* Summary + filters */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-100 text-indigo-700 font-medium">
          <Building2 className="w-3 h-3" /> {nodes.length - 1} connected firm{(nodes.length - 1) !== 1 ? "s" : ""}
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
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium border transition-colors ${
              activeTypes[t.key] ? `${t.color} border-current/20` : "bg-gray-50 text-gray-400 border-gray-200"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: activeTypes[t.key] ? EDGE_COLORS[t.key] : "#cbd5e1" }}
            />
            {t.label}
            <span className="opacity-60">({stats[t.key] || 0})</span>
          </button>
        ))}
      </div>

      {nodes.length <= 1 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-200 rounded-xl">
          <Network className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 font-medium">No firm connections found</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Connections appear when this firm shares sub-manager products, consultants, or contacts with other firms in your network.
          </p>
        </div>
      ) : (
        <div className="relative border border-gray-200 rounded-xl bg-white overflow-hidden" style={{ height: "460px" }}>
          {firmsLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : (
            <ContactNetworkGraph
              key={resetKey}
              nodes={nodes}
              edges={edges}
              onNodeClick={(n) => {
                if (n._isCenter) return;
                setSelectedId(n.id);
              }}
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
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[...(relMap[`${firmId}:${selectedNode._entity.id}`] || [])].map(t => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: `${EDGE_COLORS[t]}20`, color: EDGE_COLORS[t] }}
                      >
                        {EDGE_LABELS[t]}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
              </div>
              {onFirmClick && (
                <button
                  type="button"
                  onClick={() => onFirmClick(selectedNode._entity)}
                  className="mt-2 w-full text-xs text-indigo-600 hover:text-indigo-700 font-medium border border-indigo-200 rounded-md py-1 hover:bg-indigo-50"
                >
                  Open firm profile
                </button>
              )}
            </div>
          )}

          <div className="absolute top-3 right-3 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md border border-gray-200 flex items-center gap-1">
            <Info className="w-3 h-3" /> Firm-to-firm connections
          </div>
        </div>
      )}
    </div>
  );
}