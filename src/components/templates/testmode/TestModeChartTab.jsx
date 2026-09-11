import React, { useState, useMemo, useEffect } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Legend, Tooltip
} from "recharts";

/**
 * Chart tab for Test Mode — supports Radar, Bar, and Line chart types
 * with clickable series toggles. When exactly two series are selected,
 * the radar chart switches to difference mode (green = increase, red = decrease).
 */
export default function TestModeChartTab({ blocks, columns, visibleColumns }) {
  const [chartType, setChartType] = useState("radar");
  const [visible, setVisible] = useState(() => new Set(visibleColumns.map((c) => c.key)));

  const data = useMemo(() => {
    const criteria = [];
    blocks.forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        const point = { criterion: crit.name || `#${crit.number}` };
        visibleColumns.forEach((col) => {
          point[col.key] = col.getValue(crit) || 0;
        });
        criteria.push(point);
      });
    });
    return criteria;
  }, [blocks, visibleColumns]);

  // Keep the visible set in sync when the available columns change (phase toggles)
  useEffect(() => {
    setVisible((prev) => {
      const valid = new Set(visibleColumns.map((c) => c.key));
      const kept = new Set([...prev].filter((k) => valid.has(k)));
      return kept.size > 0 ? kept : new Set(visibleColumns.map((c) => c.key));
    });
  }, [visibleColumns]);

  const visibleCols = visibleColumns.filter((c) => visible.has(c.key));

  const toggle = (key) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Difference mode: exactly two series selected → show what changed between them
  const diffMode = chartType === "radar" && visibleCols.length === 2;
  const [fromCol, toCol] = visibleCols;

  const diffData = useMemo(() => {
    if (!diffMode) return null;
    return data.map((d) => {
      const diff = (d[toCol.key] || 0) - (d[fromCol.key] || 0);
      return {
        ...d,
        diff,
        diffPos: Math.max(0, diff),
        diffNegAbs: Math.max(0, -diff),
      };
    });
  }, [data, diffMode, fromCol, toCol]);

  if (data.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <p className="text-center text-xs text-gray-400 py-8">No criteria to display.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h4 className="text-sm font-semibold">Score Comparison Chart</h4>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Chart type:</span>
          <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
            {[
              { key: "radar", label: "Radar" },
              { key: "bar", label: "Bar" },
              { key: "line", label: "Line" }
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setChartType(opt.key)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  chartType === opt.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clickable series toggles */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
        {visibleColumns.map((col) => {
          const on = visible.has(col.key);
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => toggle(col.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition ${
                on
                  ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  : "border-gray-200 bg-gray-50 text-gray-400 line-through"
              }`}
              title={on ? `Hide ${col.label}` : `Show ${col.label}`}
            >
              <span className="w-3 h-3 rounded-sm" style={{ background: on ? col.color : "#cbd5e1" }} />
              {col.label}
            </button>
          );
        })}
      </div>

      {diffMode && (
        <div className="flex flex-wrap items-center justify-center gap-4 mb-2 text-xs">
          <span className="text-gray-500">
            Difference ({toCol.label} − {fromCol.label}):
          </span>
          <span className="inline-flex items-center gap-1 text-green-700">
            <span className="w-3 h-3 rounded-sm bg-green-500" /> Increased
          </span>
          <span className="inline-flex items-center gap-1 text-red-700">
            <span className="w-3 h-3 rounded-sm bg-red-500" /> Decreased
          </span>
        </div>
      )}

      {chartType === "radar" ? (
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={diffMode ? diffData : data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 9 }} />
            <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
            {!diffMode && visibleCols.map((col) => (
              <Radar key={col.key} name={col.label} dataKey={col.key} stroke={col.color} fill={col.color} fillOpacity={0.15} />
            ))}
            {diffMode && (
              <>
                <Radar key={fromCol.key} name={fromCol.label} dataKey={fromCol.key} stroke={fromCol.color} fill={fromCol.color} fillOpacity={0.05} strokeOpacity={0.5} />
                <Radar key={toCol.key} name={toCol.label} dataKey={toCol.key} stroke={toCol.color} fill={toCol.color} fillOpacity={0.05} strokeOpacity={0.5} />
                <Radar name="Increase" dataKey="diffPos" stroke="#10b981" fill="#10b981" fillOpacity={0.45} />
                <Radar name="Decrease" dataKey="diffNegAbs" stroke="#ef4444" fill="#ef4444" fillOpacity={0.45} />
              </>
            )}
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      ) : chartType === "bar" ? (
        <ResponsiveContainer width="100%" height={Math.max(350, data.length * 28)}>
          <BarChart data={data} layout="vertical" margin={{ left: 120, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="criterion" tick={{ fontSize: 9 }} width={140} />
            {visibleCols.map((col) => (
              <Bar key={col.key} dataKey={col.key} name={col.label} fill={col.color} />
            ))}
            <Legend />
            <Tooltip />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(350, data.length * 28)}>
          <LineChart data={data} layout="vertical" margin={{ left: 120, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="criterion" tick={{ fontSize: 9 }} width={140} />
            {visibleCols.map((col) => (
              <Line key={col.key} type="monotone" dataKey={col.key} name={col.label} stroke={col.color} strokeWidth={2} dot={{ r: 3 }} />
            ))}
            <Legend />
            <Tooltip />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}