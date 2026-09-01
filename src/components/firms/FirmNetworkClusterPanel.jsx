import React, { useMemo, useState } from "react";
import { Layers, Building2, ChevronDown, ChevronRight, Link2, Star, Focus, Users } from "lucide-react";
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

const EDGE_DOT_COLORS = {
  sub_manager: "#6366f1",
  consultant: "#f59e0b",
  shared_contact: "#ec4899",
};

export default function FirmNetworkClusterPanel({ firms, adjacency, centralityMap, relMap, activeTypes, onClusterFocus }) {
  const [expandedClusters, setExpandedClusters] = useState(new Set([0]));
  const [focusedFirmId, setFocusedFirmId] = useState(null);
  const [highlightedClusterIdx, setHighlightedClusterIdx] = useState(null);

  const clusters = useMemo(() => {
    const result = findClusters(adjacency, firms.map(f => f.id), activeTypes);

    return result.map(cluster => {
      // Rank members by centrality
      const ranked = cluster.memberIds
        .map(id => {
          const firm = firms.find(f => f.id === id);
          const neighbors = adjacency.get(id);
          let connectionCount = 0;
          if (neighbors) {
            for (const [otherId, types] of neighbors) {
              if (!cluster.memberIds.includes(otherId)) continue;
              if ([...types].some(t => activeTypes[t])) connectionCount++;
            }
          }
          return {
            id,
            name: firm?.name || id,
            centrality: centralityMap.get(id) || 0,
            types: getFirmTypes(firm),
            connectionCount,
          };
        })
        .sort((a, b) => b.centrality - a.centrality);

      const maxCentrality = ranked[0]?.centrality || 1;

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
              centrality: centralityMap.get(otherId) || 0,
            });
          }
        }
        // Sort connections by centrality (strongest first)
        connections.sort((a, b) => b.centrality - a.centrality);
        return { ...firm, connections, centralityPct: maxCentrality > 0 ? (firm.centrality / maxCentrality) * 100 : 0 };
      });

      // Cluster-level stats
      const totalConnections = ranked.reduce((acc, f) => acc + f.connectionCount, 0) / 2;
      const relTypeCounts = { sub_manager: 0, consultant: 0, shared_contact: 0 };
      for (const id of cluster.memberIds) {
        const neighbors = adjacency.get(id);
        if (!neighbors) continue;
        for (const [otherId, types] of neighbors) {
          if (!cluster.memberIds.includes(otherId)) continue;
          for (const t of types) {
            if (activeTypes[t]) relTypeCounts[t]++;
          }
        }
      }
      // Each edge counted twice (once from each end)
      Object.keys(relTypeCounts).forEach(k => { relTypeCounts[k] = Math.round(relTypeCounts[k] / 2); });
      const dominantRel = Object.entries(relTypeCounts).sort((a, b) => b[1] - a[1])[0];

      return {
        ...cluster,
        size: cluster.memberIds.length,
        topFirms,
        allMembers: ranked,
        totalConnections: Math.round(totalConnections),
        relTypeCounts,
        dominantRel: dominantRel?.[1] > 0 ? dominantRel[0] : null,
        maxCentrality,
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

  const highlightCluster = (idx, cluster) => {
    if (highlightedClusterIdx === idx) {
      setHighlightedClusterIdx(null);
      onClusterFocus?.(null);
    } else {
      setHighlightedClusterIdx(idx);
      setFocusedFirmId(null);
      // Highlight all firms in the cluster by focusing the top firm
      onClusterFocus?.(`firm-${cluster.topFirms[0]?.id}`);
    }
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

      <div className="space-y-2 pr-1">
        {clusters.map((cluster, idx) => {
          const expanded = expandedClusters.has(idx);
          const isHighlighted = highlightedClusterIdx === idx;
          return (
            <div
              key={cluster.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                isHighlighted ? "border-violet-400 shadow-sm" : "border-gray-200"
              }`}
            >
              {/* Cluster header */}
              <div className="bg-violet-50">
                <button
                  type="button"
                  onClick={() => toggleCluster(idx)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-violet-100 transition-colors"
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
                  <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-300">
                    {cluster.totalConnections} link{cluster.totalConnections !== 1 ? "s" : ""}
                  </Badge>
                </button>
                {/* Cluster quick stats + highlight button */}
                <div className="flex items-center gap-2 px-2.5 pb-2 flex-wrap">
                  {cluster.dominantRel && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${EDGE_COLORS[cluster.dominantRel]}`}>
                      Mostly {EDGE_LABELS[cluster.dominantRel]}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => highlightCluster(idx, cluster)}
                    className={`ml-auto inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                      isHighlighted
                        ? "bg-violet-600 text-white"
                        : "bg-white text-violet-600 border border-violet-200 hover:bg-violet-100"
                    }`}
                  >
                    <Focus className="w-2.5 h-2.5" />
                    {isHighlighted ? "Highlighted" : "Highlight"}
                  </button>
                </div>
              </div>

              {/* Cluster body — top firms + connections */}
              {expanded && (
                <div className="p-2.5 space-y-2 bg-white">
                  {cluster.topFirms.map((firm, fi) => (
                    <div
                      key={firm.id}
                      className={`border rounded-md p-2 transition-colors ${
                        focusedFirmId === firm.id ? "border-violet-300 bg-violet-50" : "border-gray-100"
                      }`}
                    >
                      {/* Firm header with rank + centrality bar */}
                      <button
                        type="button"
                        onClick={() => focusFirm(firm.id)}
                        className="w-full flex items-center gap-2 mb-1 text-left"
                      >
                        <div className="w-5 h-5 rounded bg-violet-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                          {fi + 1}
                        </div>
                        <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="text-xs font-medium text-gray-800 truncate flex-1">
                          {firm.name}
                        </span>
                        {fi === 0 && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                        )}
                      </button>

                      {/* Centrality bar */}
                      <div className="flex items-center gap-1.5 mb-1.5 pl-7">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-300 to-violet-600 rounded-full"
                            style={{ width: `${firm.centralityPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-gray-500 font-medium tabular-nums">
                          {Math.round(firm.centrality)} pts
                        </span>
                      </div>

                      {/* Core connections */}
                      {firm.connections.length > 0 ? (
                        <div className="pl-7 space-y-0.5">
                          <div className="flex items-center gap-1 text-[9px] text-gray-400 mb-0.5">
                            <Link2 className="w-2.5 h-2.5" />
                            <span>{firm.connections.length} core connection{firm.connections.length !== 1 ? "s" : ""}</span>
                          </div>
                          {firm.connections.slice(0, 6).map(conn => (
                            <div key={conn.firmId} className="flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{
                                  background: conn.types.map(t => EDGE_DOT_COLORS[t]).join(",") || "#cbd5e1",
                                }}
                              />
                              <span className="text-[10px] text-gray-600 truncate flex-1">
                                {conn.firmName}
                              </span>
                              <div className="flex gap-0.5 shrink-0">
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
                            <div className="pl-3 text-[10px] text-gray-400">
                              +{firm.connections.length - 6} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="pl-7 text-[10px] text-gray-400">No active connections</p>
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