import React, { useRef, useEffect, useState, useCallback } from "react";
import { Star } from "lucide-react";

/**
 * Force-directed contact-to-contact network graph with strength-based edges
 * and key-node highlighting.
 *
 * Props:
 *   nodes: [{ id, label, title, photo_url, decision_role, degree, totalStrength, importance, isKeyNode }]
 *   edges: [{ source, target, strength, reasons }]
 *   onNodeClick: (node) => void
 *   highlightId: string | null
 *   selectedPathIds: Set<string> | null  — nodes on the current path view
 */

const DECISION_ROLE_COLORS = {
  "Primary Decision Maker": "#f59e0b",
  "Board Member": "#8b5cf6",
  "Key Influencer": "#6366f1",
  "Secondary Contact": "#0ea5e9",
  Other: "#64748b",
};

export default function ContactStrengthGraph({
  nodes,
  edges,
  onNodeClick,
  highlightId,
  selectedPathIds,
}) {
  const svgRef = useRef(null);
  const [simNodes, setSimNodes] = useState([]);
  const [hoverId, setHoverId] = useState(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const animRef = useRef(null);
  const tickRef = useRef(0);

  // Initialize node positions
  useEffect(() => {
    const cx = dims.w / 2;
    const cy = dims.h / 2;
    const r = Math.min(dims.w, dims.h) * 0.35;
    const initialized = nodes.map((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      return {
        ...n,
        x: n.x ?? cx + r * Math.cos(angle),
        y: n.y ?? cy + r * Math.sin(angle),
        vx: 0,
        vy: 0,
      };
    });
    setSimNodes(initialized);
    tickRef.current = 0;
  }, [nodes, dims.w, dims.h]);

  // Observe container size
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Physics simulation
  useEffect(() => {
    if (simNodes.length === 0) return;

    const MAX_TICKS = 500;
    const DAMPING = 0.85;
    const REPULSION = 12000;
    const SPRING_K = 0.03;
    const SPRING_LEN = 100;
    const CENTER_K = 0.004;

    const step = () => {
      setSimNodes((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.map((n) => ({ ...n }));
        const cx = dims.w / 2;
        const cy = dims.h / 2;

        // Repulsion
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            let dx = next[i].x - next[j].x;
            let dy = next[i].y - next[j].y;
            let dist2 = dx * dx + dy * dy;
            if (dist2 < 1) dist2 = 1;
            const dist = Math.sqrt(dist2);
            const force = REPULSION / dist2;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            next[i].vx += fx;
            next[i].vy += fy;
            next[j].vx -= fx;
            next[j].vy -= fy;
          }
        }

        // Spring attraction along edges (stronger for higher strength)
        const nodeMap = new Map(next.map((n) => [n.id, n]));
        for (const e of edges) {
          const s = nodeMap.get(e.source);
          const t = nodeMap.get(e.target);
          if (!s || !t) continue;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const k = SPRING_K * (1 + e.strength * 0.1);
          const force = (dist - SPRING_LEN) * k;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          s.vx += fx;
          s.vy += fy;
          t.vx -= fx;
          t.vy -= fy;
        }

        // Centering + integrate + damping
        for (const n of next) {
          if (dragRef.current?.id === n.id) {
            n.vx = 0;
            n.vy = 0;
            continue;
          }
          n.vx += (cx - n.x) * CENTER_K;
          n.vy += (cy - n.y) * CENTER_K;
          n.vx *= DAMPING;
          n.vy *= DAMPING;
          n.x += n.vx;
          n.y += n.vy;
        }

        return next;
      });

      tickRef.current++;
      if (tickRef.current < MAX_TICKS) {
        animRef.current = requestAnimationFrame(step);
      }
    };

    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [edges, dims.w, dims.h, simNodes.length]);

  useEffect(() => {
    tickRef.current = 0;
    cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges]);

  const handleNodeMouseDown = useCallback(
    (e, node) => {
      e.stopPropagation();
      const rect = svgRef.current.getBoundingClientRect();
      const mx = (e.clientX - rect.left - transform.x) / transform.k;
      const my = (e.clientY - rect.top - transform.y) / transform.k;
      dragRef.current = { id: node.id, offsetX: mx - node.x, offsetY: my - node.y };
      tickRef.current = 0;
      cancelAnimationFrame(animRef.current);
    },
    [transform]
  );

  const handleMouseMove = useCallback(
    (e) => {
      const rect = svgRef.current.getBoundingClientRect();
      const mx = (e.clientX - rect.left - transform.x) / transform.k;
      const my = (e.clientY - rect.top - transform.y) / transform.k;

      if (dragRef.current) {
        setSimNodes((prev) =>
          prev.map((n) =>
            n.id === dragRef.current.id
              ? { ...n, x: mx - dragRef.current.offsetX, y: my - dragRef.current.offsetY }
              : n
          )
        );
      } else if (panRef.current) {
        setTransform((t) => ({
          ...t,
          x: panRef.current.origX + (e.clientX - panRef.current.startX),
          y: panRef.current.origY + (e.clientY - panRef.current.startY),
        }));
      }
    },
    [transform]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    panRef.current = null;
  }, []);

  const handleBgMouseDown = useCallback(
    (e) => {
      if (e.target === e.currentTarget || e.target.tagName === "rect") {
        panRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origX: transform.x,
          origY: transform.y,
        };
      }
    },
    [transform]
  );

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.001;
    setTransform((t) => {
      const newK = Math.max(0.2, Math.min(3, t.k * (1 + delta)));
      const ratio = newK / t.k;
      return {
        k: newK,
        x: mx - (mx - t.x) * ratio,
        y: my - (my - t.y) * ratio,
      };
    });
  }, []);

  // Highlight logic
  const activeId = hoverId || highlightId;
  const connectedIds = new Set();
  if (activeId) {
    connectedIds.add(activeId);
    for (const e of edges) {
      if (e.source === activeId) connectedIds.add(e.target);
      if (e.target === activeId) connectedIds.add(e.source);
    }
  }
  const isDimmed = (id) => activeId && !connectedIds.has(id);
  const isInPath = (id) => selectedPathIds?.has(id);

  // Max strength for edge scaling
  const maxStrength = Math.max(...edges.map((e) => e.strength), 1);

  return (
    <svg
      ref={svgRef}
      width={dims.w}
      height={dims.h}
      className="cursor-grab active:cursor-grabbing select-none"
      onMouseDown={handleBgMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <rect width={dims.w} height={dims.h} fill="transparent" />
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {/* Edges */}
        {edges.map((e, i) => {
          const s = simNodes.find((n) => n.id === e.source);
          const t = simNodes.find((n) => n.id === e.target);
          if (!s || !t) return null;
          const edgeInPath =
            selectedPathIds &&
            selectedPathIds.has(e.source) &&
            selectedPathIds.has(e.target);
          const dim = activeId && !(e.source === activeId || e.target === activeId) && !edgeInPath;
          const widthScale = 1 + (e.strength / maxStrength) * 4;
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={edgeInPath ? "#6366f1" : dim ? "#e5e7eb" : "#94a3b8"}
              strokeWidth={edgeInPath ? 3 : dim ? 0.5 : widthScale}
              opacity={dim ? 0.2 : edgeInPath ? 0.9 : 0.5}
            />
          );
        })}

        {/* Nodes */}
        {simNodes.map((n) => {
          const dim = isDimmed(n.id);
          const inPath = isInPath(n.id);
          const color = DECISION_ROLE_COLORS[n.decision_role] || "#ec4899";
          // Key nodes are larger
          const baseR = n.isKeyNode ? 16 : 10;
          const r = inPath ? baseR + 4 : baseR;
          const initials = n.label
            ?.split(" ")
            .filter((w) => w[0])
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase();

          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              className="cursor-pointer"
              style={{ opacity: dim ? 0.2 : 1, transition: "opacity 0.15s" }}
              onMouseDown={(e) => handleNodeMouseDown(e, n)}
              onMouseEnter={() => setHoverId(n.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (!dragRef.current) onNodeClick?.(n);
              }}
            >
              {/* Key node glow ring */}
              {n.isKeyNode && (
                <circle
                  r={r + 5}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  opacity={dim ? 0.1 : 0.6}
                  className="pointer-events-none"
                />
              )}
              {/* Path highlight ring */}
              {inPath && (
                <circle
                  r={r + 7}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={2}
                  opacity={0.7}
                  className="pointer-events-none"
                />
              )}
              {n.photo_url ? (
                <image
                  href={n.photo_url}
                  x={-r}
                  y={-r}
                  width={r * 2}
                  height={r * 2}
                  clipPath={`circle(${r}px at 0 0)`}
                  className="pointer-events-none"
                />
              ) : (
                <circle
                  r={r}
                  fill={color}
                  stroke={activeId === n.id ? "#fff" : "rgba(255,255,255,0.7)"}
                  strokeWidth={activeId === n.id ? 3 : 1.5}
                  className="pointer-events-none"
                />
              )}
              {!n.photo_url && initials && (
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  className="pointer-events-none fill-white font-semibold"
                  style={{ fontSize: r * 0.6 }}
                >
                  {initials}
                </text>
              )}
              {/* Key node star */}
              {n.isKeyNode && !dim && (
                <g transform={`translate(${r * 0.7},${-r * 0.7})`}>
                  <circle r={6} fill="#fbbf24" className="pointer-events-none" />
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    className="pointer-events-none fill-white"
                    style={{ fontSize: 8, fontWeight: 700 }}
                  >
                    ★
                  </text>
                </g>
              )}
              {/* Label — show for key nodes, hovered, or path nodes */}
              {(n.isKeyNode || hoverId === n.id || inPath) && (
                <text
                  textAnchor="middle"
                  dy={r + 14}
                  className="pointer-events-none fill-gray-800 font-medium"
                  style={{
                    fontSize: 10,
                    paintOrder: "stroke",
                    stroke: "white",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                  }}
                >
                  {n.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}