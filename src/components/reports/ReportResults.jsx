import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer, FileText } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { DATA_SOURCES } from "./reportConfig";
import { buildTableRows, sortData, runComputations, generateCSV, downloadCSV } from "./reportEngine";
import { useFirmOwner } from "@/components/admin/useFirmOwner";

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#14b8a6"];

function ReportTable({ rows, fields, dataSourceKey }) {
  const fieldDefs = DATA_SOURCES[dataSourceKey]?.fields || [];
  const visibleFields = fields.map((key) => fieldDefs.find((f) => f.key === key)).filter(Boolean);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm" style={{ tableLayout: "auto" }}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {visibleFields.map((f) => (
              <th key={f.key} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={visibleFields.length} className="px-3 py-8 text-center text-gray-400">
                No data found
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                {fields.map((key) => (
                  <td key={key} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate">
                    {row[key] ?? ""}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ComputationChart({ computation, chartType }) {
  const data = Object.entries(computation.results).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line dataKey="value" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
                {data.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area dataKey="value" stroke="#3b82f6" fill="#93c5fd" />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "scatter":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis dataKey="value" tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={data} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">{computation.label}</p>
      {renderChart()}
    </div>
  );
}

function ComputationTable({ computation }) {
  const entries = Object.entries(computation.results).sort((a, b) => b[1] - a[1]);
  const isPercent = computation.type === "percentage";

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
        <p className="text-sm font-semibold text-gray-700">{computation.label}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-3 py-1.5 text-left font-medium text-gray-600">
              {computation.group_by || "Category"}
            </th>
            <th className="px-3 py-1.5 text-right font-medium text-gray-600">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, val]) => (
            <tr key={key} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-3 py-1.5 text-gray-700">{key}</td>
              <td className="px-3 py-1.5 text-right text-gray-700 font-medium">
                {isPercent ? `${val.toFixed(1)}%` : typeof val === "number" ? val.toLocaleString() : val}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportResults({ config, data, onBack }) {
  const firmOwner = useFirmOwner();
  const fieldDefs = DATA_SOURCES[config.data_source]?.fields || [];

  const sortedData = useMemo(
    () => sortData(data, config.sort_by, config.sort_order),
    [data, config.sort_by, config.sort_order]
  );

  const tableRows = useMemo(
    () => buildTableRows(sortedData, config.selected_fields, config.data_source),
    [sortedData, config.selected_fields, config.data_source]
  );

  const computations = useMemo(
    () => runComputations(sortedData, config.computations),
    [sortedData, config.computations]
  );

  const showTable = config.format_type === "table" || config.format_type === "mixed";
  const showChart = config.format_type === "chart" || config.format_type === "mixed";

  const handleDownloadCSV = () => {
    const headers = config.selected_fields.map((key) => {
      const f = fieldDefs.find((fd) => fd.key === key);
      return f?.label || key;
    });
    const csv = generateCSV(tableRows, config.selected_fields);
    downloadCSV(csv, `${config.name || "report"}.csv`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 pdf-block">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" /> Back to Editor
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {config.output_formats?.includes("csv") && (
            <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          )}
          {config.output_formats?.includes("pdf") && (
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <FileText className="w-3.5 h-3.5" /> PDF
            </Button>
          )}
          {config.output_formats?.includes("print") && (
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          )}
        </div>
      </div>

      {/* Report title */}
      <div className="pdf-block">
        {(firmOwner?.logo_url || firmOwner?.name) && (
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200">
            {firmOwner.logo_url && (
              <img src={firmOwner.logo_url} alt={firmOwner.name || "logo"} className="w-12 h-12 object-contain" />
            )}
            <div>
              {firmOwner.name && <p className="text-sm font-bold text-gray-800">{firmOwner.name}</p>}
              {firmOwner.primary_contact_name && <p className="text-[11px] text-gray-500">{firmOwner.primary_contact_name}</p>}
            </div>
          </div>
        )}
        <h2 className="text-lg font-bold text-gray-800">{config.name}</h2>
        {config.description && <p className="text-sm text-gray-500">{config.description}</p>}
        <p className="text-xs text-gray-400 mt-1">
          Data source: {DATA_SOURCES[config.data_source]?.label || config.data_source} · {sortedData.length} records
        </p>
      </div>

      {/* Summary section */}
      {config.include_summary && (
        <div className="pdf-block grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-[10px] uppercase text-blue-500 font-semibold">Total Records</p>
            <p className="text-xl font-bold text-blue-700">{sortedData.length}</p>
          </div>
          {computations.slice(0, 3).map((comp, idx) => {
            const total = Object.values(comp.results).reduce((sum, v) => sum + (Number(v) || 0), 0);
            return (
              <div key={idx} className="rounded-lg bg-violet-50 p-3">
                <p className="text-[10px] uppercase text-violet-500 font-semibold truncate">{comp.label}</p>
                <p className="text-xl font-bold text-violet-700">
                  {comp.type === "percentage" ? "—" : typeof total === "number" ? total.toLocaleString() : total}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Computation results — charts */}
      {showChart && computations.length > 0 && (
        <div className="space-y-4">
          {computations.map((comp, idx) => (
            <div key={idx} className="pdf-block rounded-lg border border-gray-200 p-4 bg-white">
              <ComputationChart computation={comp} chartType={config.chart_type} />
            </div>
          ))}
        </div>
      )}

      {/* Computation results — tables */}
      {computations.length > 0 && (
        <div className="space-y-3">
          {computations.map((comp, idx) => (
            <div key={idx} className="pdf-block">
              <ComputationTable computation={comp} />
            </div>
          ))}
        </div>
      )}

      {/* Data table */}
      {showTable && config.selected_fields.length > 0 && (
        <div className="pdf-block">
          {showChart && <p className="text-sm font-semibold text-gray-700 mb-2">Detailed Records</p>}
          <ReportTable rows={tableRows} fields={config.selected_fields} dataSourceKey={config.data_source} />
        </div>
      )}
    </div>
  );
}