import React, { useMemo, useState } from "react";
import { Layers, Building2, ChevronDown, ChevronRight, Users, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { findClusters } from "./firmNetworkUtils";

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

export default function FirmNetworkClusterPanel({ firms, adjacency, centralityMap, relMap, activeTypes, onClusterFocus }) {
  const [expandedClusters, setExpandedClusters] = useState(new Set([0])); // first cluster expanded by default
  const [focusedFirmId, setFocusedFirmId] = useState(null);

  const clusters = useMemo(() => {
    const result = findClusters(adjacency, firms.map(f => f.id), activeTypes);
    // For each cluster, rank members by centrality and compute top firms with their connections
    return result.map(cluster => {
      const ranked = cluster.memberIds
        .map(id => ({
          id,
          name: firms.find(f => f.id === id)?.name || id,
          centrality: centralityMap.get(id) || 0,
          types: getFirmTypes(firms.find(f => f.id === id)),
        }))
        .sort((a, b) => b.centrality - a.centrality);

      // For each top firm, get its connections within the cluster
      const topFirms = ranked.slice(0, 5).map(firm => {
        const neighbors = adjacency.get(firm.id);
        const connections = [];
        if (neighbors) {
          for (const [otherId, types] of neighbors) {
            if (!cluster.memberIds.includes(otherId)) continue;
            const activeRels = [...types].filter(t => activeTypes[t]);
            if (activeRels.length === 0) continue;
            connections.push({
              firmId: otherId,
              firmName: firms.find(f => f.id === otherId)?.name || otherId,
              types: activeRels,
            });
          }
        }
        return { ...firm, connections };
      });

      return {
        ...cluster,
        size: cluster.memberIds.length,
        topFirms,
        allMembers: ranked,
      };
    });
  }, [firms, adjacency, centralityMap, activeTypes]);

  const toggleCluster = (idx) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const focusFirm = (firmId) => {
    setFocusedFirmId(firmId === focusedFirmId ? null : firmId);
    onClusterFocus?.(firmId === focusedFirmId ? null : `firm-${firmId}`);
  };

  if (clusters.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
          <Layers className="w-3.5 h-3.5 text-violet-500" />
          Cluster Centrality
        </div>
        <p className="text-[11px] text-gray-400 text-center py-4">
          No clusters detected. Clusters form when firms are connected through shared contacts, sub-manager products, or consultants.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
        <Layers className="w-3.5 h-3.5 text-violet-500" />
        Cluster Centrality
      </div>
      <p className="text-[11px] text-gray-500 leading-snug mb-2">
        {clusters.length} cluster{clusters.length !== 1 ? "s" : ""} detected. Each cluster is a group of firms connected through shared relationships. Top central firms and their core connections are listed below.
      </p>

      <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
        {clusters.map((cluster, idx) => {
          const expanded = expandedClusters.has(idx);
          return (
            <div key={cluster.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCluster(idx)}
                className="w-full flex items-center gap-2 px-2.5 py-2 bg-violet-50 hover:bg-violet-100 transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-violet-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-violet-500" />
                )}
                <span className="text-xs font-semibold text-violet-800">
                  Cluster {idx + 1}
                </span>
                <Badge className="bg-violet-100 text-violet-700 text-[10px]">
                  {cluster.size} firm{cluster.size !== 1 ? "s" : ""}
                </Badge>
              </button>

              {expanded && (
                <div className="p-2.5 space-y-2 bg-white">
                  {cluster.topFirms.map((firm, fi) => (
                    <div key={firm.id} className="border border-gray-100 rounded-md p-2">
                      <button
                        type="button"
                        onClick={() => focusFirm(firm.id)}
                        className={`w-full flex items-center gap-2 mb-1.5 text-left ${
                          focusedFirmId === firm.id ? "bg-violet-50 rounded p-1 -m-1" : ""
                        }`}
                      >
                        <div className="w-5 h-5 rounded bg-violet-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                          {fi + 1}
                        </div>
                        <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="text-xs font-medium text-gray-800 truncate flex-1">
                          {firm.name}
                        </span>
                        <Badge variant="outline" className="text-[9px] text-gray-500">
                          {Math.round(firm.centrality)} pts
                        </Badge>
                      </button>
                      {firm.connections.length > 0 && (
                        <div className="pl-7 space-y-0.5">
                          {firm.connections.slice(0, 6).map(conn => (
                            <div key={conn.firmId} className="flex items-center gap-1.5">
                              <Link2 className="w-2.5 h-2.5 text-gray-300" />
                              <span className="text-[10px] text-gray-600 truncate flex-1">
                                {conn.firmName}
                              </span>
                              <div className="flex gap-0.5">
                                {conn.types.map(t => (
                                  <span
                                    key={t}
                                    className={`text-[8px] px-1 py-0 rounded ${EDGE_COLORS[t] || "bg-gray-100 text-gray-500"}`}
                                  >
                                    {EDGE_LABELS[t]?.split(" ")[0] || t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                          {firm.connections.length > 6 && (
                            <div className="pl-5 text-[10px] text-gray-400">
                              +{firm.connections.length - 6} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {cluster.allMembers.length > 5 && (
                    <p className="text-[10px] text-gray-400 text-center pt-1">
                      +{cluster.allMembers.length - 5} more firm{cluster.allMembers.length - 5 !== 1 ? "s" : ""} in this cluster
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getFirmTypes(f) {
  if (!f) return [];
  return f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
}