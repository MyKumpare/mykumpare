import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Network, List, ChevronDown, ChevronRight, Building2, User, ArrowRight } from "lucide-react";
import ContactNetworkGraph from "@/components/network/ContactNetworkGraph";

const DEGREE_COLORS = {
  0: "#2563eb", // source
  1: "#6366f1", // indigo
  2: "#8b5cf6", // violet
  3: "#a855f7", // purple
  4: "#ec4899", // pink
  5: "#9ca3af", // gray
};

const DEGREE_RADII = { 0: 22, 1: 18, 2: 15, 3: 12, 4: 10, 5: 9 };

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "");
}

export default function DegreesOfSeparationPanel({ entityType, sourceId, sourceName, onNodeClick }) {
  const [degree, setDegree] = useState(2);
  const [view, setView] = useState("graph");
  const [expandedId, setExpandedId] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["degreesOfSeparation", entityType, sourceId, degree],
    queryFn: async () => {
      const res = await base44.functions.invoke("computeDegreesOfSeparation", {
        entity_type: entityType,
        source_id: sourceId,
        max_degrees: degree,
      });
      return res.data;
    },
    enabled: !!sourceId && !!entityType,
    staleTime: 60_000,
  });

  const graphData = useMemo(() => {
    if (!data?.graph) return { nodes: [], edges: [] };
    const nodes = data.graph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      degree: n.degree,
      color: DEGREE_COLORS[n.degree] || DEGREE_COLORS[5],
      radius: DEGREE_RADII[n.degree] || 9,
      initials: getInitials(n.label),
    }));
    const edges = data.graph.edges.map((e) => ({ source: e.source, target: e.target }));
    return { nodes, edges };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-gray-500">Computing degrees of separation…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-sm text-red-500">
        Error: {error.message || "Failed to compute degrees of separation"}
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        {data?.error || "No data available"}
      </div>
    );
  }

  const connections = data.connections || [];
  const stats = data.stats || {};

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {/* Degree selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 mr-1">Degrees:</span>
          {[1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              onClick={() => setDegree(d)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                degree === d
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {d}°
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="font-medium">{stats.total || 0} connections</span>
          {Object.entries(stats.by_degree || {}).map(([deg, count]) => (
            <Badge key={deg} variant="outline" className="text-[10px] py-0 px-1.5">
              {deg}°: {count}
            </Badge>
          ))}
        </div>

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 bg-white rounded-md border border-gray-200 p-0.5">
          <button
            onClick={() => setView("graph")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              view === "graph" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Network className="w-3.5 h-3.5" /> Graph
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              view === "list" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
        </div>
      </div>

      {/* Results */}
      {connections.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">
          No connections found within {degree} degree{degree > 1 ? "s" : ""} of separation.
        </div>
      ) : view === "graph" ? (
        <div className="border border-gray-200 rounded-lg bg-white" style={{ height: "500px" }}>
          <ContactNetworkGraph
            nodes={graphData.nodes}
            edges={graphData.edges}
            onNodeClick={(n) => {
              if (n.id !== sourceId && onNodeClick) onNodeClick(n);
            }}
          />
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
          {connections.map((conn) => {
            const isExpanded = expandedId === conn.entity_id;
            return (
              <div
                key={conn.entity_id}
                className="border border-gray-200 rounded-lg bg-white overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : conn.entity_id)}
                  className="w-full flex items-center gap-2.5 p-2.5 hover:bg-gray-50 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
                    style={{ backgroundColor: DEGREE_COLORS[conn.degree] || DEGREE_COLORS[5] }}
                  >
                    {conn.degree}°
                  </div>
                  {entityType === "firm" ? (
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{conn.entity_name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {conn.connection_reasons[conn.connection_reasons.length - 1] || ""}
                    </p>
                  </div>
                  {onNodeClick && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNodeClick(conn);
                      }}
                    >
                      Open
                    </Button>
                  )}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 bg-gray-50 border-t border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1.5 mt-2">
                      Connection Path
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {conn.path.map((node, i) => (
                        <React.Fragment key={node.entity_id}>
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                              style={{
                                backgroundColor:
                                  DEGREE_COLORS[i === 0 ? 0 : i === conn.path.length - 1 ? conn.degree : i] ||
                                  DEGREE_COLORS[5],
                              }}
                            >
                              {i === 0 ? "S" : i}
                            </div>
                            <span className="text-xs text-gray-700 font-medium">{node.entity_name}</span>
                          </div>
                          {i < conn.path.length - 1 && (
                            <div className="flex items-center gap-1">
                              <ArrowRight className="w-3 h-3 text-gray-300" />
                              <span className="text-[10px] text-gray-400 italic max-w-[180px] truncate">
                                {conn.connection_reasons[i] || ""}
                              </span>
                              <ArrowRight className="w-3 h-3 text-gray-300" />
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}