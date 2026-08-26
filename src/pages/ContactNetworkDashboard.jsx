import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Share2, Loader2, Star, Crown, Users, Lightbulb, UserCheck,
  Filter, ArrowRight, Trophy, Network, ZoomIn, Search, X,
} from "lucide-react";
import ContactStrengthGraph from "@/components/network/ContactStrengthGraph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecisionRoleBadge, DECISION_ROLES } from "@/components/contacts/ContactDecisionRolePicker";

const ROLE_COLORS = {
  "Primary Decision Maker": "#f59e0b",
  "Board Member": "#8b5cf6",
  "Key Influencer": "#6366f1",
  "Secondary Contact": "#0ea5e9",
  "Other": "#64748b",
};

const ROLE_ICONS = {
  "Primary Decision Maker": Crown,
  "Board Member": Users,
  "Key Influencer": Lightbulb,
  "Secondary Contact": UserCheck,
  "Other": Star,
};

export default function ContactNetworkDashboard() {
  const [search, setSearch] = useState("");
  const [minStrength, setMinStrength] = useState(0);
  const [roleFilter, setRoleFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [pathTargetId, setPathTargetId] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [view, setView] = useState("graph"); // graph | list

  const { data: networkData, isLoading, isFetching } = useQuery({
    queryKey: ["contactNetwork"],
    queryFn: async () => {
      const res = await base44.functions.invoke("computeContactNetwork", {});
      return res;
    },
    staleTime: 60_000,
  });

  // Path query (when both source and target selected)
  const { data: pathData, isFetching: pathLoading } = useQuery({
    queryKey: ["contactPath", selectedId, pathTargetId],
    queryFn: async () => {
      if (!selectedId || !pathTargetId) return null;
      const res = await base44.functions.invoke("computeContactNetwork", {
        sourceId: selectedId,
        targetId: pathTargetId,
      });
      return res;
    },
    enabled: !!selectedId && !!pathTargetId,
    staleTime: 60_000,
  });

  // Filter nodes and edges
  const { filteredNodes, filteredEdges, filteredKeyNodes, stats } = useMemo(() => {
    if (!networkData) return { filteredNodes: [], filteredEdges: [], filteredKeyNodes: [], stats: null };

    let nodes = networkData.nodes || [];
    let edges = networkData.edges || [];

    // Role filter
    if (roleFilter !== "All") {
      const roleNodeIds = new Set(
        nodes.filter((n) => n.decision_role === roleFilter).map((n) => n.id)
      );
      nodes = nodes.filter((n) => roleNodeIds.has(n.id));
      edges = edges.filter((e) => roleNodeIds.has(e.source) && roleNodeIds.has(e.target));
    }

    // Min strength filter
    if (minStrength > 0) {
      edges = edges.filter((e) => e.strength >= minStrength);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchingIds = new Set(
        nodes
          .filter((n) => n.label.toLowerCase().includes(q) || (n.title || "").toLowerCase().includes(q))
          .map((n) => n.id)
      );
      nodes = nodes.filter((n) => matchingIds.has(n.id));
      edges = edges.filter((e) => matchingIds.has(e.source) && matchingIds.has(e.target));
    }

    // Only keep nodes that have at least one edge after filtering
    const connectedIds = new Set();
    edges.forEach((e) => {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    });
    // Keep key nodes even if they lost all edges (they're still interesting)
    nodes = nodes.filter((n) => connectedIds.has(n.id) || n.isKeyNode);

    const keyNodes = (networkData.keyNodes || []).filter((kn) =>
      nodes.some((n) => n.id === kn.id)
    );

    return {
      filteredNodes: nodes,
      filteredEdges: edges,
      filteredKeyNodes: keyNodes,
      stats: networkData.stats,
    };
  }, [networkData, search, minStrength, roleFilter, resetKey]);

  // Path node IDs for highlighting
  const pathNodeIds = useMemo(() => {
    if (!pathData?.path) return null;
    return new Set(pathData.path.map((p) => p.id));
  }, [pathData]);

  const handleNodeClick = useCallback((node) => {
    if (!selectedId) {
      setSelectedId(node.id);
    } else if (selectedId === node.id) {
      setSelectedId(null);
      setPathTargetId(null);
    } else if (!pathTargetId) {
      setPathTargetId(node.id);
    } else {
      // Reset and start new selection
      setSelectedId(node.id);
      setPathTargetId(null);
    }
  }, [selectedId, pathTargetId]);

  const selectedNode = filteredNodes.find((n) => n.id === selectedId);
  const targetNode = filteredNodes.find((n) => n.id === pathTargetId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Network className="w-6 h-6 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold">Contact Network Dashboard</h1>
            <p className="text-xs text-white/70">
              Connection strength, paths, and key influencers across your contact graph
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Min strength:</label>
            <select
              value={minStrength}
              onChange={(e) => setMinStrength(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={0}>All</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={5}>5+</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Role:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="All">All Roles</option>
              {DECISION_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.value}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant={view === "graph" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("graph")}
            >
              <Network className="w-4 h-4 mr-1" /> Graph
            </Button>
            <Button
              variant={view === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("list")}
            >
              <Trophy className="w-4 h-4 mr-1" /> Key Nodes
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setResetKey((k) => k + 1); setSelectedId(null); setPathTargetId(null); }}
          >
            Reset
          </Button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-pink-50 text-pink-700 font-medium">
              <Users className="w-3.5 h-3.5" /> {stats.connectedContacts} connected contacts
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-medium">
              <Share2 className="w-3.5 h-3.5" /> {stats.totalEdges} connections
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-medium">
              <Star className="w-3.5 h-3.5" /> {stats.keyNodeCount} key nodes
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
              Avg strength: {stats.avgStrength}
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-gray-600">
          <span className="font-medium">Decision roles:</span>
          {DECISION_ROLES.map((r) => (
            <span key={r.value} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: ROLE_COLORS[r.value] }} />
              {r.value}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 ml-2">
            <span className="w-3 h-3 rounded-full border-2 border-amber-400 bg-transparent" />
            Key node (top 15)
          </span>
        </div>

        {/* Selection / Path bar */}
        {(selectedNode || pathTargetId) && (
          <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
            <span className="text-xs font-medium text-indigo-700">Path:</span>
            {selectedNode ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border border-indigo-200 text-xs">
                {selectedNode.photo_url ? (
                  <img src={selectedNode.photo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ background: ROLE_COLORS[selectedNode.decision_role] || "#ec4899" }}>
                    {selectedNode.label?.[0]}
                  </span>
                )}
                {selectedNode.label}
                {selectedNode.decision_role && <DecisionRoleBadge role={selectedNode.decision_role} size="xs" />}
                <button onClick={() => { setSelectedId(null); setPathTargetId(null); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ) : (
              <span className="text-xs text-gray-500 italic">Click a node to start</span>
            )}
            {pathTargetId && (
              <>
                <ArrowRight className="w-4 h-4 text-indigo-400" />
                {targetNode ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border border-indigo-200 text-xs">
                    {targetNode.photo_url ? (
                      <img src={targetNode.photo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ background: ROLE_COLORS[targetNode.decision_role] || "#ec4899" }}>
                        {targetNode.label?.[0]}
                      </span>
                    )}
                    {targetNode.label}
                    <button onClick={() => setPathTargetId(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null}
              </>
            )}
            {!pathTargetId && selectedNode && (
              <span className="text-xs text-indigo-500 italic">Click another node to find the path</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          {/* Main graph / list */}
          <div className="relative border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden" style={{ height: "calc(100vh - 360px)", minHeight: "450px" }}>
            {isLoading || isFetching ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-sm text-gray-500">Computing network…</p>
              </div>
            ) : filteredNodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                No contacts match the current filters.
              </div>
            ) : view === "graph" ? (
              <ContactStrengthGraph
                key={resetKey}
                nodes={filteredNodes}
                edges={filteredEdges}
                onNodeClick={handleNodeClick}
                highlightId={selectedId}
                selectedPathIds={pathNodeIds}
              />
            ) : (
              /* Key Nodes list view */
              <div className="absolute inset-0 overflow-y-auto p-3 space-y-2">
                {filteredKeyNodes.map((kn) => {
                  const Icon = ROLE_ICONS[kn.decision_role] || Star;
                  return (
                    <div
                      key={kn.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedId === kn.id ? "border-indigo-300 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedId(selectedId === kn.id ? null : kn.id)}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex-shrink-0">
                        #{kn.rank}
                      </div>
                      {kn.photo_url ? (
                        <img src={kn.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: ROLE_COLORS[kn.decision_role] || "#ec4899" }}>
                          {kn.label?.[0]}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-800 truncate">{kn.label}</p>
                        {kn.title && <p className="text-xs text-gray-500 truncate">{kn.title}</p>}
                        {kn.decision_role && <DecisionRoleBadge role={kn.decision_role} size="xs" />}
                      </div>
                      <div className="flex flex-col items-end gap-0.5 text-xs text-gray-500 flex-shrink-0">
                        <span><strong className="text-gray-700">{kn.degree}</strong> connections</span>
                        <span>Strength: <strong className="text-gray-700">{kn.totalStrength}</strong></span>
                        <span>Importance: <strong className="text-indigo-600">{kn.importance}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Help hint */}
            <div className="absolute top-3 right-3 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md border border-gray-200">
              {selectedId ? "Click another node to find path" : "Click a node to start"}
            </div>
          </div>

          {/* Side panel: Key Nodes + Path */}
          <div className="space-y-3">
            {/* Path result */}
            {pathData?.path && (
              <div className="border border-indigo-200 rounded-xl bg-indigo-50/50 p-3">
                <h3 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-1.5">
                  <ArrowRight className="w-4 h-4" /> Connection Path
                </h3>
                <div className="space-y-1.5">
                  {pathData.path.map((node, i) => (
                    <React.Fragment key={node.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-indigo-500 flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{node.label}</p>
                          {node.title && <p className="text-xs text-gray-500 truncate">{node.title}</p>}
                        </div>
                      </div>
                      {i < pathData.path.length - 1 && pathData.edges[i] && (
                        <div className="ml-3 pl-3 border-l-2 border-indigo-200 py-1">
                          <p className="text-xs text-indigo-600">
                            {pathData.edges[i].reasons.map((r) => r.detail).join(", ")}
                          </p>
                          <p className="text-[10px] text-gray-400">Strength: {pathData.edges[i].strength}</p>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-indigo-200 text-xs text-indigo-600">
                  {pathData.length} {pathData.length === 1 ? "hop" : "hops"} apart
                </div>
              </div>
            )}

            {/* Selected node details */}
            {selectedNode && !pathData?.path && (
              <div className="border border-gray-200 rounded-xl bg-white p-3 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Selected Contact</h3>
                <div className="flex items-center gap-3 mb-2">
                  {selectedNode.photo_url ? (
                    <img src={selectedNode.photo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: ROLE_COLORS[selectedNode.decision_role] || "#ec4899" }}>
                      {selectedNode.label?.[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">{selectedNode.label}</p>
                    {selectedNode.title && <p className="text-xs text-gray-500 truncate">{selectedNode.title}</p>}
                    {selectedNode.decision_role && <DecisionRoleBadge role={selectedNode.decision_role} size="xs" />}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-gray-50 p-2">
                    <p className="text-lg font-bold text-gray-800">{selectedNode.degree}</p>
                    <p className="text-[10px] text-gray-500">Connections</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <p className="text-lg font-bold text-gray-800">{selectedNode.totalStrength}</p>
                    <p className="text-[10px] text-gray-500">Strength</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <p className="text-lg font-bold text-indigo-600">{selectedNode.importance}</p>
                    <p className="text-[10px] text-gray-500">Importance</p>
                  </div>
                </div>
                {selectedNode.isKeyNode && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                    <Star className="w-3 h-3" /> Key Node
                  </div>
                )}
              </div>
            )}

            {/* Top key nodes panel */}
            <div className="border border-gray-200 rounded-xl bg-white p-3 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" /> Top Key Nodes
              </h3>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {(filteredKeyNodes || []).slice(0, 10).map((kn) => (
                  <button
                    key={kn.id}
                    onClick={() => setSelectedId(selectedId === kn.id ? null : kn.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                      selectedId === kn.id ? "bg-indigo-50 border border-indigo-200" : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-amber-700 bg-amber-100 flex-shrink-0">
                      {kn.rank}
                    </span>
                    {kn.photo_url ? (
                      <img src={kn.photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ background: ROLE_COLORS[kn.decision_role] || "#ec4899" }}>
                        {kn.label?.[0]}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-800 truncate">{kn.label}</p>
                      <p className="text-[10px] text-gray-400">{kn.degree} connections · {kn.totalStrength} strength</p>
                    </div>
                  </button>
                ))}
                {(!filteredKeyNodes || filteredKeyNodes.length === 0) && (
                  <p className="text-xs text-gray-400 italic text-center py-4">No key nodes match filters</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}