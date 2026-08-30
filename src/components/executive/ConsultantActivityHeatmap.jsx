import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid3x3 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ChartCard, EmptyChart, TYPE_COLORS } from "./execDashboardModules";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const MAX_COLS = 8; // top consultant firms shown; rest grouped as "Other"

/** A consultant relationship is active if it has started and not yet ended. */
function isRelationshipActive(termination_date, inception_date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (inception_date) {
    const start = new Date(inception_date);
    start.setHours(0, 0, 0, 0);
    if (start > today) return false;
  }
  if (termination_date) {
    const end = new Date(termination_date);
    end.setHours(0, 0, 0, 0);
    if (end < today) return false;
  }
  return true;
}

/** A contact assignment within a consultant relationship is active if not yet ended. */
function isContactActive(termination_date) {
  if (!termination_date) return true;
  const end = new Date(termination_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end >= today;
}

function getFirmTypes(f) {
  return f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
}

// Activity intensity color: light teal → dark teal
function getActivityColor(ratio) {
  if (ratio <= 0) return "#f9fafb";
  if (ratio < 0.15) return "#ccfbf1";
  if (ratio < 0.3) return "#5eead4";
  if (ratio < 0.5) return "#2dd4bf";
  if (ratio < 0.7) return "#14b8a6";
  if (ratio < 0.9) return "#0d9488";
  return "#0f766e";
}

export default function ConsultantActivityHeatmap() {
  const [viewMode, setViewMode] = useState("client"); // "client" | "consultant"

  const { data: consultants = [], isLoading: loadingConsultants } = useQuery({
    queryKey: ["firm-consultants-activity-heatmap"],
    queryFn: () => base44.entities.FirmConsultant.list("-created_date", 5000),
  });

  const { data: firms = [], isLoading: loadingFirms } = useQuery({
    queryKey: ["firms-for-consultant-activity-heatmap"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });

  const isLoading = loadingConsultants || loadingFirms;

  // firmId -> name + types
  const firmMap = useMemo(() => {
    const map = new Map();
    for (const f of firms) {
      map.set(f.id, { name: f.name || "—", types: getFirmTypes(f) });
    }
    return map;
  }, [firms]);

  // Build matrix: rowFirmType × consultantFirm → activity score
  // Activity score = relationships + activeContacts (composite engagement metric)
  const { matrix, rowTypes, colFirms, rowTotals, colTotals, maxCell, grandTotal } = useMemo(() => {
    const matrix = {}; // { [rowType]: { [colFirmName]: score } }
    const rowTotals = {};
    const colTotals = {};
    const colFirmSet = new Set();

    for (const c of consultants) {
      if (!isRelationshipActive(c.termination_date, c.inception_date)) continue;

      // Row = type of the grouped firm (client or consultant depending on viewMode)
      const groupFirmId = viewMode === "client" ? c.firm_id : c.consultant_firm_id;
      const groupInfo = firmMap.get(groupFirmId);
      const types = groupInfo?.types?.length ? groupInfo.types : ["Uncategorized"];

      // Column = the OTHER firm (the consultant firm in client mode, the client firm in consultant mode)
      const colFirmId = viewMode === "client" ? c.consultant_firm_id : c.firm_id;
      const colName = firmMap.get(colFirmId)?.name || "Unknown";

      const activeContacts = (c.contacts || []).filter((ct) => isContactActive(ct.termination_date));
      // Composite activity score: 1 per relationship + 1 per active contact
      const score = 1 + activeContacts.length;

      colFirmSet.add(colName);

      for (const ft of types) {
        if (!matrix[ft]) matrix[ft] = {};
        matrix[ft][colName] = (matrix[ft][colName] || 0) + score;
        rowTotals[ft] = (rowTotals[ft] || 0) + score;
        colTotals[colName] = (colTotals[colName] || 0) + score;
      }
    }

    // Determine which firm types to show as rows
    const rowTypes = [...FIRM_TYPES, "Uncategorized"].filter(
      (t) => rowTotals[t] || Object.keys(matrix[t] || {}).length > 0
    );

    // Determine top consultant firms as columns (by total activity)
    const sortedCols = Object.entries(colTotals)
      .sort((a, b) => b[1] - a[1]);
    const topCols = sortedCols.slice(0, MAX_COLS).map(([name]) => name);
    const otherCols = sortedCols.slice(MAX_COLS).map(([name]) => name);

    // Fold "Other" columns into a single column
    if (otherCols.length > 0) {
      for (const ft of rowTypes) {
        let otherSum = 0;
        for (const col of otherCols) {
          otherSum += matrix[ft]?.[col] || 0;
        }
        if (otherSum > 0) {
          if (!matrix[ft]) matrix[ft] = {};
          matrix[ft]["Other"] = (matrix[ft]["Other"] || 0) + otherSum;
        }
      }
      let otherTotal = 0;
      for (const col of otherCols) otherTotal += colTotals[col] || 0;
      colTotals["Other"] = otherTotal;
    }

    const colFirms = [...topCols, ...(otherCols.length > 0 ? ["Other"] : [])];

    let maxCell = 0;
    let grandTotal = 0;
    for (const ft of rowTypes) {
      for (const col of colFirms) {
        const v = matrix[ft]?.[col] || 0;
        if (v > maxCell) maxCell = v;
        grandTotal += v;
      }
    }

    return { matrix, rowTypes, colFirms, rowTotals, colTotals, maxCell, grandTotal };
  }, [consultants, firmMap, viewMode]);

  const totalRelationships = useMemo(
    () => consultants.filter((c) => isRelationshipActive(c.termination_date, c.inception_date)).length,
    [consultants]
  );

  return (
    <ChartCard
      title="Consultant Activity Heatmap"
      subtitle={`${totalRelationships} active relationship${totalRelationships !== 1 ? "s" : ""} · ${colFirms.length} consultant firm${colFirms.length !== 1 ? "s" : ""}`}
      icon={Grid3x3}
      iconColor="text-teal-600"
    >
      {/* View mode toggle */}
      <div className="flex items-center justify-end mb-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {[
            { key: "client", label: "By Client Type" },
            { key: "consultant", label: "By Consultant Type" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setViewMode(opt.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === opt.key
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <EmptyChart label="Loading..." />
      ) : rowTypes.length === 0 || colFirms.length === 0 ? (
        <EmptyChart label="No active consultant relationships" />
      ) : (
        <>
          {/* Color legend */}
          <div className="flex items-center justify-end gap-1.5 text-[10px] text-gray-500 mb-2">
            <span>Less active</span>
            <div className="flex rounded overflow-hidden border border-gray-200">
              <div className="w-5 h-3" style={{ backgroundColor: "#f9fafb" }} />
              <div className="w-5 h-3" style={{ backgroundColor: "#ccfbf1" }} />
              <div className="w-5 h-3" style={{ backgroundColor: "#5eead4" }} />
              <div className="w-5 h-3" style={{ backgroundColor: "#2dd4bf" }} />
              <div className="w-5 h-3" style={{ backgroundColor: "#14b8a6" }} />
              <div className="w-5 h-3" style={{ backgroundColor: "#0d9488" }} />
              <div className="w-5 h-3" style={{ backgroundColor: "#0f766e" }} />
            </div>
            <span>More active</span>
          </div>

          {/* Heatmap table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left font-medium text-gray-500 py-2 pr-3 sticky left-0 bg-white">
                    {viewMode === "client" ? "Client Firm Type" : "Consultant Firm Type"}
                  </th>
                  {colFirms.map((name, idx) => (
                    <th
                      key={name}
                      className="text-center font-medium text-gray-500 py-2 px-1 whitespace-nowrap"
                      style={{ maxWidth: 120 }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: TYPE_COLORS[idx % TYPE_COLORS.length] }}
                        />
                        <span className="truncate max-w-[100px]" title={name}>{name}</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-right font-medium text-gray-700 py-2 pl-3 pr-1 bg-gray-50/50">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rowTypes.map((type, rowIdx) => {
                  const rowTotal = rowTotals[type] || 0;
                  return (
                    <tr key={type}>
                      <td className="text-left font-medium text-gray-700 py-1 pr-3 whitespace-nowrap sticky left-0 bg-white">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: TYPE_COLORS[rowIdx % TYPE_COLORS.length] }}
                          />
                          {type}
                        </div>
                      </td>
                      {colFirms.map((name) => {
                        const value = matrix[type]?.[name] || 0;
                        const ratio = maxCell > 0 ? value / maxCell : 0;
                        return (
                          <td key={name} className="py-1 px-1 text-center">
                            <div
                              className="rounded-md py-2.5 px-1.5 transition-colors"
                              style={{
                                backgroundColor: value > 0 ? getActivityColor(ratio) : "#f9fafb",
                                color: ratio >= 0.7 ? "#ffffff" : "#374151",
                                fontWeight: ratio >= 0.5 ? 600 : 400,
                              }}
                              title={`${type} × ${name}: ${value} activity point${value !== 1 ? "s" : ""}`}
                            >
                              {value > 0 ? value : "—"}
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-right font-semibold text-gray-900 py-1 pl-3 pr-1 whitespace-nowrap bg-gray-50/50">
                        {rowTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td className="text-left font-semibold text-gray-700 py-2 pr-3 sticky left-0 bg-white">
                    Total
                  </td>
                  {colFirms.map((name) => (
                    <td key={name} className="text-center font-semibold text-gray-700 py-2 px-1 whitespace-nowrap">
                      {colTotals[name] || 0}
                    </td>
                  ))}
                  <td className="text-right font-bold text-gray-900 py-2 pl-3 pr-1 whitespace-nowrap bg-gray-50/50">
                    {grandTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-[11px] text-gray-400 mt-3">
            Activity score = active relationships + active contacts. Warmer (darker teal) cells indicate higher consultant engagement for that firm type × consultant firm combination. Top {MAX_COLS} consultant firms shown; remaining grouped as "Other".
          </p>
        </>
      )}
    </ChartCard>
  );
}