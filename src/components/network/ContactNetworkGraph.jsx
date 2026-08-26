import React, { useRef, useEffect, useState, useCallback } from "react";

/**
 * Force-directed network graph rendered as SVG.
 * Accepts nodes [{id, label, type, color, radius, image, sublabel}] and
 * edges [{source, target}] and runs a lightweight physics simulation
 * (repulsion + spring + centering + damping) to lay them out.
 *
 * Interactions: hover highlights a node and its connections; click fires
 * onNodeClick; nodes are draggable; background drag pans; wheel zooms.
 */
export default function ContactNetworkGraph({ nodes, edges, onNodeClick, highlightId }) {
  const svgRef = useRef(null);
  const [simNodes, setSimNodes] = useState([]);
  const [hoverId, setHoverId] = useState(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const dragRef = useRef(null); // { id, offsetX, offsetY }
  const panRef = useRef(null);  // { startX, startY, origX, origY }
  const animRef = useRef(null);
  const tickRef = useRef(0);

  // Initialize / reinitialize node positions when the node set changes.
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

  // Observe container size.
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

  // Physics simulation loop.
  useEffect(() => {
    if (simNodes.length === 0) return;

    const MAX_TICKS = 400;
    const DAMPING = 0.85;
    const REPULSION = 8000;
    const SPRING_K = 0.04;
    const SPRING_LEN = 120;
    const CENTER_K = 0.005;

    const step = () => {
      setSimNodes((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.map((n) => ({ ...n }));
        const cx = dims.w / 2;
        const cy = dims.h / 2;

        // Repulsion (O(n²) — fine for a few hundred nodes)
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

        // Spring attraction along edges
        const nodeMap = new Map(next.map((n) => [n.id, n]));
        for (const e of edges) {
          const s = nodeMap.get(e.source);
          const t = nodeMap.get(e.target);
          if (!s || !t) continue;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - SPRING_LEN) * SPRING_K;
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

  // Restart simulation when edges change (new filter).
  useEffect(() => {
    tickRef.current = 0;
    cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges]);

  const handleNodeMouseDown = useCallback((e, node) => {
    e.stopPropagation();
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left - transform.x) / transform.k;
    const my = (e.clientY - rect.top - transform.y) / transform.k;
    dragRef.current = { id: node.id, offsetX: mx - node.x, offsetY: my - node.y };
    tickRef.current = 0; // resume simulation while dragging
    cancelAnimationFrame(animRef.current);
  }, [transform]);

  const handleMouseMove = useCallback((e) => {
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
  }, [transform]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    panRef.current = null;
  }, []);

  const handleBgMouseDown = useCallback((e) => {
    if (e.target === e.currentTarget || e.target.tagName === "rect") {
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: transform.x,
        origY: transform.y,
      };
    }
  }, [transform]);

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

  // Determine highlighted set (hover or external highlightId).
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
          const dim = activeId && !(e.source === activeId || e.target === activeId);
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={dim ? "#e5e7eb" : "#cbd5e1"}
              strokeWidth={dim ? 1 : 1.5}
              opacity={dim ? 0.3 : 0.7}
            />
          );
        })}

        {/* Nodes */}
        {simNodes.map((n) => {
          const dim = isDimmed(n.id);
          const isFirm = n.type === "firm";
          const r = n.radius || (isFirm ? 18 : 12);
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              className="cursor-pointer"
              style={{ opacity: dim ? 0.25 : 1, transition: "opacity 0.15s" }}
              onMouseDown={(e) => handleNodeMouseDown(e, n)}
              onMouseEnter={() => setHoverId(n.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (!dragRef.current) onNodeClick?.(n);
              }}
            >
              {n.image ? (
                <image
                  href={n.image}
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
                  fill={n.color || (isFirm ? "#6366f1" : "#ec4899")}
                  stroke={activeId === n.id ? "#fff" : "rgba(255,255,255,0.6)"}
                  strokeWidth={activeId === n.id ? 3 : 1.5}
                  className="pointer-events-none"
                />
              )}
              {!n.image && n.initials && (
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  className="pointer-events-none fill-white font-semibold"
                  style={{ fontSize: r * 0.7 }}
                >
                  {n.initials}
                </text>
              )}
              {/* Label — only show for firms, hovered node, or high-degree contacts */}
              {(isFirm || hoverId === n.id || (n.degree >= 3 && !activeId)) && (
                <text
                  textAnchor="middle"
                  dy={r + 12}
                  className="pointer-events-none fill-gray-700 font-medium"
                  style={{ fontSize: 11, paintOrder: "stroke", stroke: "white", strokeWidth: 3, strokeLinejoin: "round" }}
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