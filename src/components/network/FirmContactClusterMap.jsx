import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Building2, ZoomIn, ZoomOut, Maximize } from "lucide-react";

const ROLE_COLORS = {
  "Primary Decision Maker": "#f59e0b",
  "Board Member": "#8b5cf6",
  "Key Influencer": "#6366f1",
  "Secondary Contact": "#0ea5e9",
  "Other": "#64748b",
};

const FIRM_COLOR = "#1e40af";
const EDGE_COLOR = "#cbd5e1";
const EDGE_COLOR_HIGHLIGHT = "#6366f1";

// Max contacts to render for performance
const MAX_CONTACTS = 250;

export default function FirmContactClusterMap({ highlightId, onNodeClick }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // Fetch firms
  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firmsForCluster"],
    queryFn: async () => {
      const res = await base44.entities.Firm.list("-updated_date", 200);
      return (res || []).filter((f) => !f.deleted_at);
    },
    staleTime: 60_000,
  });

  // Fetch contacts with firm associations
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["contactsForCluster"],
    queryFn: async () => {
      const res = await base44.entities.Contact.list("-updated_date", 500);
      return (res || []).filter((c) => !c.deleted_at && c.contact_status !== "Inactive");
    },
    staleTime: 60_000,
  });

  // Fetch network data for degree/importance metrics
  const { data: networkData } = useQuery({
    queryKey: ["contactNetwork"],
    queryFn: async () => {
      const res = await base44.functions.invoke("computeContactNetwork", {});
      return res;
    },
    staleTime: 60_000,
  });

  // Build graph data: firm nodes + contact nodes + membership edges
  const graphData = useMemo(() => {
    if (!firms.length || !contacts.length) return { nodes: [], edges: [] };

    // Build a degree map from network data (contact-to-contact connections)
    const degreeMap = new Map();
    const importanceMap = new Map();
    if (networkData?.nodes) {
      networkData.nodes.forEach((n) => {
        degreeMap.set(n.id, n.degree || 0);
        importanceMap.set(n.id, n.importance || 0);
      });
    }
    // Also count firm associations as degree if no network data
    const firmCountMap = new Map();
    contacts.forEach((c) => {
      const fids = c.firm_ids || [];
      fids.forEach(() => {
        firmCountMap.set(c.id, (firmCountMap.get(c.id) || 0) + 1);
      });
    });

    // Only include contacts that have at least one firm association
    const linkedContacts = contacts.filter((c) => (c.firm_ids || []).length > 0);
    // Limit for performance — keep the most connected
    const sortedContacts = [...linkedContacts]
      .sort((a, b) => {
        const da = degreeMap.get(a.id) || firmCountMap.get(a.id) || 0;
        const db = degreeMap.get(b.id) || firmCountMap.get(b.id) || 0;
        return db - da;
      })
      .slice(0, MAX_CONTACTS);

    // Only include firms that have at least one linked contact in our subset
    const contactIds = new Set(sortedContacts.map((c) => c.id));
    const linkedFirmIds = new Set();
    sortedContacts.forEach((c) => {
      (c.firm_ids || []).forEach((fid) => linkedFirmIds.add(fid));
    });
    const linkedFirms = firms.filter((f) => linkedFirmIds.has(f.id));

    const nodes = [
      ...linkedFirms.map((f) => ({
        id: f.id,
        label: f.name,
        type: "firm",
        firmType: (f.firm_types || [])[0] || f.firm_type || "Firm",
        degree: 0, // will be computed from edges
      })),
      ...sortedContacts.map((c) => {
        const netDegree = degreeMap.get(c.id) || 0;
        const firmDegree = firmCountMap.get(c.id) || 0;
        const totalDegree = netDegree + firmDegree;
        const fullName = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        return {
          id: c.id,
          label: fullName || `${c.first_name || ""} ${c.last_name || ""}`.trim(),
          type: "contact",
          title: c.title || "",
          decisionRole: c.decision_role || "Other",
          photoUrl: c.photo_url || "",
          degree: totalDegree,
          netDegree,
          importance: importanceMap.get(c.id) || 0,
        };
      }),
    ];

    // Build edges: firm → contact
    const edges = [];
    const nodeIds = new Set(nodes.map((n) => n.id));
    sortedContacts.forEach((c) => {
      (c.firm_ids || []).forEach((fid) => {
        if (nodeIds.has(fid) && nodeIds.has(c.id)) {
          edges.push({ source: fid, target: c.id });
        }
      });
    });

    // Compute firm degree (number of linked contacts)
    const firmDegreeMap = new Map();
    edges.forEach((e) => {
      firmDegreeMap.set(e.source, (firmDegreeMap.get(e.source) || 0) + 1);
    });
    nodes.forEach((n) => {
      if (n.type === "firm") {
        n.degree = firmDegreeMap.get(n.id) || 0;
      }
    });

    return { nodes, edges };
  }, [firms, contacts, networkData]);

  // Node sizing: contacts sized by degree, firms sized by contact count
  const nodeRadius = useCallback((node) => {
    if (node.type === "firm") {
      return Math.max(18, Math.min(32, 14 + node.degree * 0.8));
    }
    // Contact: scale by degree — most connected = largest
    const maxDegree = Math.max(...graphData.nodes.filter((n) => n.type === "contact").map((n) => n.degree), 1);
    const minR = 5;
    const maxR = 16;
    return Math.max(minR, Math.min(maxR, minR + (node.degree / maxDegree) * (maxR - minR)));
  }, [graphData.nodes]);

  // Force simulation
  const positionsRef = useRef(new Map());
  const [tick, setTick] = useState(0);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!graphData.nodes.length) return;

    // Initialize positions
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const firmNodes = graphData.nodes.filter((n) => n.type === "firm");
    const contactNodes = graphData.nodes.filter((n) => n.type === "contact");

    // Place firms in a circle
    firmNodes.forEach((n, i) => {
      const angle = (i / firmNodes.length) * Math.PI * 2;
      const r = Math.min(dimensions.width, dimensions.height) * 0.3;
      positionsRef.current.set(n.id, {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      });
    });

    // Place contacts near their first firm
    contactNodes.forEach((n) => {
      const firstEdge = graphData.edges.find((e) => e.target === n.id);
      const firmPos = firstEdge ? positionsRef.current.get(firstEdge.source) : null;
      if (firmPos) {
        positionsRef.current.set(n.id, {
          x: firmPos.x + (Math.random() - 0.5) * 60,
          y: firmPos.y + (Math.random() - 0.5) * 60,
          vx: 0,
          vy: 0,
        });
      } else {
        positionsRef.current.set(n.id, {
          x: cx + (Math.random() - 0.5) * 200,
          y: cy + (Math.random() - 0.5) * 200,
          vx: 0,
          vy: 0,
        });
      }
    });

    // Build adjacency for repulsion
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    const edgePairs = graphData.edges.map((e) => ({
      source: positionsRef.current.get(e.source),
      target: positionsRef.current.get(e.target),
    }));

    let frame = 0;
    const maxFrames = 300;
    const damping = 0.85;
    const kRepel = 1200; // repulsion strength
    const kSpring = 0.04; // spring strength
    const kCenter = 0.005; // centering force
    const restLength = 70; // spring rest length

    const simulate = () => {
      if (frame >= maxFrames) {
        animationRef.current = null;
        setTick((t) => t + 1);
        return;
      }
      frame++;

      const positions = graphData.nodes.map((n) => positionsRef.current.get(n.id)).filter(Boolean);

      // Repulsion (all pairs)
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i];
          const b = positions[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let distSq = dx * dx + dy * dy;
          if (distSq < 1) distSq = 1;
          const dist = Math.sqrt(distSq);
          const force = kRepel / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Spring attraction (edges)
      edgePairs.forEach(({ source, target }) => {
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = kSpring * (dist - restLength);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      });

      // Centering + velocity damping + apply
      positions.forEach((p) => {
        p.vx += (cx - p.x) * kCenter;
        p.vy += (cy - p.y) * kCenter;
        p.vx *= damping;
        p.vy *= damping;
        p.x += p.vx;
        p.y += p.vy;
      });

      // Update every few frames for rendering
      if (frame % 5 === 0) {
        setTick((t) => t + 1);
      }

      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, dimensions]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Pan & zoom handlers
  const handleMouseDown = (e) => {
    if (e.target === svgRef.current || e.target.tagName === "rect") {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform((t) => ({ ...t, x: panStartRef.current.tx + dx, y: panStartRef.current.ty + dy }));
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setTransform((t) => {
      const newScale = Math.max(0.3, Math.min(3, t.scale + delta));
      return { ...t, scale: newScale };
    });
  };

  const zoomIn = () => setTransform((t) => ({ ...t, scale: Math.min(3, t.scale * 1.2) }));
  const zoomOut = () => setTransform((t) => ({ ...t, scale: Math.max(0.3, t.scale / 1.2) }));
  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });

  const isLoading = firmsLoading || contactsLoading;

  // Determine highlighted connections
  const highlightedEdgeSet = useMemo(() => {
    if (!highlightId) return null;
    const set = new Set();
    graphData.edges.forEach((e, i) => {
      if (e.source === highlightId || e.target === highlightId) {
        set.add(i);
      }
    });
    return set;
  }, [highlightId, graphData.edges]);

  const connectedNodeIds = useMemo(() => {
    if (!highlightId) return null;
    const set = new Set([highlightId]);
    graphData.edges.forEach((e) => {
      if (e.source === highlightId) set.add(e.target);
      if (e.target === highlightId) set.add(e.source);
    });
    return set;
  }, [highlightId, graphData.edges]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-sm text-gray-500">Loading firms and contacts…</p>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
        No firm-contact associations to display.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-gray-50/50">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {graphData.edges.map((edge, i) => {
            const source = positionsRef.current.get(edge.source);
            const target = positionsRef.current.get(edge.target);
            if (!source || !target) return null;
            const isHighlighted = highlightedEdgeSet?.has(i);
            const isDimmed = highlightedEdgeSet && !isHighlighted;
            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isHighlighted ? EDGE_COLOR_HIGHLIGHT : EDGE_COLOR}
                strokeWidth={isHighlighted ? 2 : 1}
                opacity={isDimmed ? 0.15 : 0.5}
              />
            );
          })}

          {/* Nodes */}
          {graphData.nodes.map((node) => {
            const pos = positionsRef.current.get(node.id);
            if (!pos) return null;
            const r = nodeRadius(node);
            const isHovered = hoveredNode?.id === node.id;
            const isHighlighted = highlightId === node.id;
            const isConnected = connectedNodeIds?.has(node.id);
            const isDimmed = connectedNodeIds && !isConnected;
            const color = node.type === "firm" ? FIRM_COLOR : (ROLE_COLORS[node.decisionRole] || "#64748b");

            if (node.type === "firm") {
              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: "pointer", opacity: isDimmed ? 0.25 : 1 }}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => onNodeClick?.(node)}
                >
                  {/* Glow ring for large firms */}
                  {node.degree >= 5 && (
                    <circle r={r + 6} fill="none" stroke={FIRM_COLOR} strokeWidth={1.5} opacity={0.3} />
                  )}
                  <rect
                    x={-r}
                    y={-r}
                    width={r * 2}
                    height={r * 2}
                    rx={4}
                    fill={isHighlighted ? "#312e81" : FIRM_COLOR}
                    stroke={isHighlighted ? "#fbbf24" : "#1e3a8a"}
                    strokeWidth={isHighlighted ? 3 : 1.5}
                  />
                  {/* Building icon mark */}
                  <text textAnchor="middle" dy="0.35em" fill="white" fontSize={r * 0.7} fontWeight="bold">
                    {node.degree}
                  </text>
                  {/* Label */}
                  {(isHovered || r >= 22) && (
                    <text
                      textAnchor="middle"
                      y={r + 14}
                      fill="#1e3a8a"
                      fontSize={11}
                      fontWeight={600}
                      pointerEvents="none"
                    >
                      {node.label.length > 25 ? node.label.slice(0, 23) + "…" : node.label}
                    </text>
                  )}
                </g>
              );
            }

            // Contact node
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: "pointer", opacity: isDimmed ? 0.25 : 1 }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onNodeClick?.(node)}
              >
                {/* Key node ring (top connected) */}
                {node.degree >= 5 && (
                  <circle r={r + 4} fill="none" stroke="#fbbf24" strokeWidth={2} opacity={0.6} />
                )}
                {node.photoUrl ? (
                  <clipPath id={`clip-${node.id}`}>
                    <circle r={r} />
                  </clipPath>
                ) : null}
                {node.photoUrl ? (
                  <image
                    href={node.photoUrl}
                    x={-r}
                    y={-r}
                    width={r * 2}
                    height={r * 2}
                    clipPath={`url(#clip-${node.id})`}
                    preserveAspectRatio="xMidYMidSlice"
                  />
                ) : (
                  <circle
                    r={r}
                    fill={isHighlighted ? "#4f46e5" : color}
                    stroke={isHighlighted ? "#fbbf24" : "white"}
                    strokeWidth={isHighlighted ? 3 : 1.5}
                  />
                )}
                {!node.photoUrl && (
                  <text textAnchor="middle" dy="0.35em" fill="white" fontSize={r * 0.8} fontWeight="600" pointerEvents="none">
                    {node.label?.[0]?.toUpperCase() || "?"}
                  </text>
                )}
                {/* Label on hover or for large nodes */}
                {(isHovered || r >= 12) && (
                  <text
                    textAnchor="middle"
                    y={r + 13}
                    fill="#374151"
                    fontSize={10}
                    fontWeight={node.degree >= 5 ? 600 : 400}
                    pointerEvents="none"
                  >
                    {node.label.length > 22 ? node.label.slice(0, 20) + "…" : node.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button onClick={zoomIn} className="w-8 h-8 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50" title="Zoom in">
          <ZoomIn className="w-4 h-4 text-gray-600" />
        </button>
        <button onClick={zoomOut} className="w-8 h-8 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50" title="Zoom out">
          <ZoomOut className="w-4 h-4 text-gray-600" />
        </button>
        <button onClick={resetView} className="w-8 h-8 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50" title="Reset view">
          <Maximize className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (
        <div
          className="absolute pointer-events-none bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs max-w-[240px] z-10"
          style={{
            left: Math.min(hoveredNode ? 12 : 0, dimensions.width - 250),
            top: 12,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            {hoveredNode.type === "firm" ? (
              <Building2 className="w-4 h-4 text-blue-700" />
            ) : (
              <span className="w-3 h-3 rounded-full" style={{ background: ROLE_COLORS[hoveredNode.decisionRole] || "#64748b" }} />
            )}
            <span className="font-semibold text-gray-800">{hoveredNode.label}</span>
          </div>
          {hoveredNode.type === "firm" ? (
            <p className="text-gray-500">{hoveredNode.degree} linked contacts · {hoveredNode.firmType}</p>
          ) : (
            <>
              {hoveredNode.title && <p className="text-gray-500 mb-0.5">{hoveredNode.title}</p>}
              <p className="text-gray-500">
                {hoveredNode.degree} total connections
                {hoveredNode.netDegree > 0 && ` (${hoveredNode.netDegree} network)`}
              </p>
              {hoveredNode.decisionRole && (
                <p className="text-gray-400">{hoveredNode.decisionRole}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-3 left-3 bg-white/90 border border-gray-200 rounded-lg px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-gray-700 mb-1">
          <Building2 className="w-3.5 h-3.5 text-blue-700" /> Firm
          <span className="text-gray-400 font-normal ml-1">sized by # contacts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-gray-600">Contact (sized by connections)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-amber-400 bg-transparent" />
          <span className="text-gray-600">Most connected (5+ links)</span>
        </div>
      </div>
    </div>
  );
}