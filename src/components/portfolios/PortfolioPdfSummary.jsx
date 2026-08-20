import React, { useMemo, forwardRef } from "react";
import { format, parseISO } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function formatCurrencyFull(v) {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatCurrencyShort(v) {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

const SERIES_COLORS = ["#4f46e5", "#0891b2", "#16a34a", "#ea580c", "#db2777", "#7c3aed"];

const PortfolioPdfSummary = forwardRef(function PortfolioPdfSummary({ portfolio }, ref) {
  const historicalAum = portfolio.historical_aum || [];
  const allocationHistory = portfolio.allocation_history || [];

  // Build series definitions
  const seriesDefs = useMemo(() => {
    const defs = [];
    const hasPortfolioData = historicalAum.some((a) => a.level === "portfolio");
    if (hasPortfolioData) {
      defs.push({ key: "portfolio", label: "Portfolio Total", level: "portfolio", refId: "" });
    }
    if (portfolio.advisor_type && portfolio.advisor_firm_id) {
      const hasAdvisorData = historicalAum.some(
        (a) => a.level === "advisor" && (a.reference_id || "") === portfolio.advisor_firm_id
      );
      if (hasAdvisorData) {
        defs.push({
          key: "advisor",
          label: `IM: ${portfolio.advisor_firm_name || ""}`,
          level: "advisor",
          refId: portfolio.advisor_firm_id,
        });
      }
    }
    (portfolio.sub_managers || []).forEach((sm) => {
      const hasData = historicalAum.some(
        (a) => a.level === "sub_manager" && (a.reference_id || "") === sm.product_id
      );
      if (hasData) {
        defs.push({
          key: `sm_${sm.product_id}`,
          label: `SM: ${sm.product_name}`,
          level: "sub_manager",
          refId: sm.product_id,
        });
      }
    });
    return defs;
  }, [historicalAum, portfolio]);

  // Merge AUM data by date
  const chartData = useMemo(() => {
    if (seriesDefs.length === 0) return [];
    const dateSet = new Set();
    historicalAum.forEach((a) => { if (a.date) dateSet.add(a.date); });
    const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));
    return sortedDates.map((date) => {
      const row = { date };
      seriesDefs.forEach((def) => {
        const entry = historicalAum.find(
          (a) => a.date === date && a.level === def.level && (a.reference_id || "") === (def.refId || "")
        );
        row[def.key] = entry ? entry.value : null;
      });
      return row;
    });
  }, [historicalAum, seriesDefs]);

  // Sort allocation history by date descending
  const sortedAllocations = useMemo(() => {
    return [...allocationHistory].sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date));
  }, [allocationHistory]);

  const guidelines = [
    { label: "Investment Guidelines", html: portfolio.guidelines_investments },
    { label: "Program Guidelines", html: portfolio.guidelines_program },
    { label: "Compliance Guidelines", html: portfolio.guidelines_compliance },
  ];

  return (
    <div ref={ref} style={{ width: "800px", padding: "32px", background: "white", fontFamily: "Arial, Helvetica, sans-serif", color: "#1f2937" }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #4f46e5", paddingBottom: "12px", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", margin: 0 }}>
          {portfolio.portfolio_name || "Portfolio"} — Summary Report
        </h1>
        <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
          Generated {format(new Date(), "MM/dd/yyyy")}
        </p>
      </div>

      {/* Portfolio details */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "8px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
          Portfolio Details
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontSize: "12px" }}>
          <div><span style={{ color: "#6b7280" }}>Allocator:</span> <span style={{ fontWeight: 600 }}>{portfolio.allocator_name || "—"}</span></div>
          <div><span style={{ color: "#6b7280" }}>Inception Date:</span> <span style={{ fontWeight: 600 }}>{portfolio.inception_date ? format(parseISO(portfolio.inception_date), "MM/dd/yyyy") : "—"}</span></div>
          <div><span style={{ color: "#6b7280" }}>Funding Status:</span> <span style={{ fontWeight: 600 }}>{portfolio.funding_status || "Active"}</span></div>
          <div><span style={{ color: "#6b7280" }}>Termination Date:</span> <span style={{ fontWeight: 600 }}>{portfolio.termination_date ? format(parseISO(portfolio.termination_date), "MM/dd/yyyy") : "—"}</span></div>
          {portfolio.advisor_type && (
            <div><span style={{ color: "#6b7280" }}>Advisor Type:</span> <span style={{ fontWeight: 600 }}>{portfolio.advisor_type}</span></div>
          )}
          {portfolio.advisor_firm_name && (
            <div><span style={{ color: "#6b7280" }}>Advisor Firm:</span> <span style={{ fontWeight: 600 }}>{portfolio.advisor_firm_name}</span></div>
          )}
          {portfolio.primary_benchmark_name && (
            <div><span style={{ color: "#6b7280" }}>Primary Benchmark:</span> <span style={{ fontWeight: 600 }}>{portfolio.primary_benchmark_name}</span></div>
          )}
        </div>
      </div>

      {/* Guidelines */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "8px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
          Guidelines
        </h2>
        {guidelines.map((g) => {
          const text = stripHtml(g.html);
          return (
            <div key={g.label} style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#4f46e5", marginBottom: "3px" }}>{g.label}</p>
              <p style={{ fontSize: "11px", color: "#4b5563", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {text || "No guidelines provided."}
              </p>
            </div>
          );
        })}
      </div>

      {/* Historical AUM Chart */}
      {chartData.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "8px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
            Historical AUM — Growth Over Time
          </h2>
          <div style={{ width: "100%", height: "240px" }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => (d ? format(parseISO(d), "MM/dd/yy") : "")}
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  height={30}
                />
                <YAxis
                  tickFormatter={(v) => formatCurrencyShort(v)}
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  width={60}
                />
                <Tooltip
                  labelFormatter={(d) => (d ? format(parseISO(d), "MM/dd/yyyy") : "")}
                  formatter={(v) => [formatCurrencyFull(v), ""]}
                  contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                />
                {seriesDefs.map((def, i) => (
                  <Line
                    key={def.key}
                    type="monotone"
                    dataKey={def.key}
                    name={def.label}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={def.key === "portfolio" ? 2.5 : 1.5}
                    dot={{ r: 1.5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: "6px" }}>
            {seriesDefs.map((def, i) => (
              <div key={def.key} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#4b5563" }}>
                <span style={{ width: "10px", height: "3px", backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length], display: "inline-block" }} />
                {def.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Allocation History Table */}
      <div style={{ marginBottom: "16px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "8px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
          Allocation History
        </h2>
        {sortedAllocations.length === 0 ? (
          <p style={{ fontSize: "11px", color: "#9ca3af", fontStyle: "italic" }}>No allocation records.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb" }}>
                <th style={{ textAlign: "left", padding: "5px 6px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>Date</th>
                <th style={{ textAlign: "left", padding: "5px 6px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>Type</th>
                <th style={{ textAlign: "left", padding: "5px 6px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>Level</th>
                <th style={{ textAlign: "left", padding: "5px 6px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>Reference</th>
                <th style={{ textAlign: "right", padding: "5px 6px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>Amount</th>
                <th style={{ textAlign: "left", padding: "5px 6px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#374151" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedAllocations.map((rec, i) => (
                <tr key={rec.id || i} style={{ backgroundColor: i % 2 === 0 ? "white" : "#fafafa" }}>
                  <td style={{ padding: "4px 6px", border: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                    {rec.activity_date ? format(parseISO(rec.activity_date), "MM/dd/yyyy") : "—"}
                  </td>
                  <td style={{ padding: "4px 6px", border: "1px solid #e5e7eb" }}>{rec.activity_type || "—"}</td>
                  <td style={{ padding: "4px 6px", border: "1px solid #e5e7eb" }}>{rec.level || "—"}</td>
                  <td style={{ padding: "4px 6px", border: "1px solid #e5e7eb" }}>{rec.reference_name || "—"}</td>
                  <td style={{ padding: "4px 6px", border: "1px solid #e5e7eb", textAlign: "right", whiteSpace: "nowrap" }}>
                    {rec.amount != null ? formatCurrencyFull(rec.amount) : "—"}
                  </td>
                  <td style={{ padding: "4px 6px", border: "1px solid #e5e7eb", color: "#6b7280", maxWidth: "200px" }}>
                    {rec.notes ? stripHtml(rec.notes).slice(0, 80) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "8px", marginTop: "16px" }}>
        <p style={{ fontSize: "9px", color: "#9ca3af", textAlign: "center" }}>
          MyKumpare Portfolio Report — {portfolio.portfolio_name} — Generated {format(new Date(), "MM/dd/yyyy h:mm a")}
        </p>
      </div>
    </div>
  );
});

export default PortfolioPdfSummary;