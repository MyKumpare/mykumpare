import React, { useState, useMemo } from "react";
import { Calculator, Info, X, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { toNumber, compactCurrency, getLatestAum, getFirstAum, calcGrowthPct, getFirmProducts, FIRM_COLORS } from "./firmPerfUtils";

const VARIABLES = [
  { key: "aum", label: "Latest AUM", desc: "Most recent month-end firm AUM" },
  { key: "first_aum", label: "First AUM", desc: "Earliest recorded firm AUM" },
  { key: "net_flow", label: "Net Flow", desc: "Latest month net asset flows (gained - loss)" },
  { key: "gained", label: "Assets Gained", desc: "Latest month inflows" },
  { key: "loss", label: "Assets Loss", desc: "Latest month outflows (negative)" },
  { key: "growth_pct", label: "Growth %", desc: "AUM growth % from first to latest" },
  { key: "products", label: "Products", desc: "Number of products" },
  { key: "contacts", label: "Contacts", desc: "Number of contacts" },
  { key: "year_founded", label: "Year Founded", desc: "Year the firm was founded" },
  { key: "data_points", label: "Data Points", desc: "AUM history entries count" },
];

const FUNCTIONS = ["abs", "min", "max", "round", "sqrt", "pow"];

const ALLOWED = new Set([...VARIABLES.map((v) => v.key), ...FUNCTIONS]);

const PRESETS = [
  { label: "Net Flow Ratio", formula: "net_flow / aum * 100" },
  { label: "AUM Growth Ratio", formula: "(aum - first_aum) / first_aum * 100" },
  { label: "Flow / Products", formula: "net_flow / products" },
  { label: "AUM per Product", formula: "aum / products" },
];

function getFirmVars(firm, products, contacts) {
  const latest = getLatestAum(firm);
  const first = getFirstAum(firm);
  return {
    aum: toNumber(latest.aum),
    first_aum: toNumber(first.aum),
    net_flow: toNumber(latest.netFlow),
    gained: toNumber(latest.gained),
    loss: toNumber(latest.loss),
    growth_pct: calcGrowthPct(firm) ?? 0,
    products: getFirmProducts(firm, products).length,
    contacts: contacts.filter((c) => (c.firm_ids || []).includes(firm.id) && !c.deleted_at).length,
    year_founded: firm.year_founded || 0,
    data_points: (firm.aum_history || []).length,
  };
}

function validateFormula(formula) {
  if (!formula.trim()) return { ok: false, error: "Enter a formula" };
  // Only allow safe characters
  if (!/^[\w\s+\-*/%().,]+$/.test(formula)) {
    return { ok: false, error: "Only letters, numbers, +, -, *, /, %, (, ), and commas allowed" };
  }
  // Extract identifiers and verify they're all known
  const ids = formula.match(/[a-zA-Z_]\w*/g) || [];
  for (const id of ids) {
    if (!ALLOWED.has(id)) {
      return { ok: false, error: `Unknown variable or function: "${id}"` };
    }
  }
  return { ok: true };
}

function evalFormula(formula, vars) {
  try {
    const varNames = Object.keys(vars);
    const varValues = varNames.map((k) => vars[k]);
    const fn = new Function(...varNames, ...FUNCTIONS, `"use strict"; return (${formula});`);
    const result = fn(...varValues, Math.abs, Math.min, Math.max, Math.round, Math.sqrt, Math.pow);
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function fmtResult(v) {
  if (v === null || v === undefined) return "—";
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "K";
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toFixed(2);
}

export default function FirmPerfFormulaBuilder({ firms = [], products = [], contacts = [] }) {
  const [formula, setFormula] = useState("net_flow / aum * 100");
  const [label, setLabel] = useState("Net Flow Ratio");

  const validation = useMemo(() => validateFormula(formula), [formula]);

  const results = useMemo(() => {
    if (!validation.ok || !firms.length) return [];
    return firms.map((firm, i) => {
      const vars = getFirmVars(firm, products, contacts);
      const value = evalFormula(formula, vars);
      return { firm, value, color: FIRM_COLORS[i % FIRM_COLORS.length] };
    });
  }, [firms, products, contacts, formula, validation.ok]);

  const bestValue = useMemo(() => {
    const valid = results.filter((r) => r.value !== null);
    if (!valid.length) return null;
    return Math.max(...valid.map((r) => r.value));
  }, [results]);

  const worstValue = useMemo(() => {
    const valid = results.filter((r) => r.value !== null);
    if (!valid.length) return null;
    return Math.min(...valid.map((r) => r.value));
  }, [results]);

  const insertVar = (key) => {
    setFormula((f) => f + (f && !f.endsWith(" ") ? " " : "") + key);
  };

  const applyPreset = (preset) => {
    setFormula(preset.formula);
    setLabel(preset.label);
  };

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">Custom Formula</h3>
        <span className="text-[10px] text-gray-400 ml-auto">Define & compare calculated metrics</span>
      </div>

      {/* Label + Formula input */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Metric label…"
          className="h-9 px-3 text-sm rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
        />
        <input
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="e.g. net_flow / aum * 100"
          className={`h-9 px-3 text-sm font-mono rounded-lg border outline-none focus:border-indigo-400 bg-gray-50 md:col-span-2 ${
            validation.ok ? "border-gray-200" : "border-rose-300 bg-rose-50"
          }`}
        />
      </div>

      {/* Error */}
      {!validation.ok && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 mb-2">
          <AlertCircle className="w-3.5 h-3.5" />
          {validation.error}
        </div>
      )}

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className="px-2 py-1 text-[11px] rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Variable chips */}
      <div className="flex flex-wrap gap-1 mb-3">
        {VARIABLES.map((v) => (
          <button
            key={v.key}
            onClick={() => insertVar(v.key)}
            title={v.desc}
            className="px-2 py-0.5 text-[11px] rounded bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors font-mono"
          >
            {v.key}
          </button>
        ))}
      </div>

      {/* Results */}
      {validation.ok && results.length > 0 && (
        <>
          {/* Table */}
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Firm</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{label || "Result"}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const isBest = bestValue !== null && r.value === bestValue && bestValue !== worstValue;
                  const isWorst = worstValue !== null && r.value === worstValue && bestValue !== worstValue;
                  return (
                    <tr key={r.firm.id} className="border-b border-gray-100">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-6 rounded-full" style={{ backgroundColor: r.color }} />
                          <span className="text-sm text-gray-700 truncate">{r.firm.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-semibold ${isBest ? "text-emerald-700" : isWorst ? "text-rose-600" : "text-gray-700"}`}>
                          {fmtResult(r.value)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bar chart */}
          {results.some((r) => r.value !== null) && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={results.map((r) => ({ name: (r.firm.name || "").slice(0, 18), fullName: r.firm.name, value: r.value || 0, color: r.color }))} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={55} interval={0} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtResult} />
                <Tooltip
                  formatter={(v) => [fmtResult(v), label || "Result"]}
                  labelFormatter={(l) => results.find((r) => (r.firm.name || "").slice(0, 18) === l)?.firm.name || l}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name={label || "Result"}>
                  {results.map((r, i) => (
                    <Cell key={i} fill={r.value >= 0 ? r.color : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </>
      )}

      {validation.ok && results.length === 0 && (
        <p className="text-sm text-gray-400 italic text-center py-4">Select firms to see calculated results.</p>
      )}
    </div>
  );
}