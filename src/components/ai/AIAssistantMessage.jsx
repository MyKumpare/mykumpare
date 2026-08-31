import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { User, Bot, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#14b8a6"];

function DataTable({ table }) {
  const headers = table.headers || [];
  // Column indices whose header is "Address" — render those cells as Google Maps links.
  const addressColIdx = new Set(
    headers.map((h, i) => (typeof h === "string" && h.toLowerCase() === "address" ? i : -1)).filter((i) => i >= 0)
  );
  return (
    <div className="mt-2">
      {table.title && <p className="text-xs font-semibold text-gray-600 mb-1">{table.title}</p>}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {headers.map((h, i) => (
                <th key={i} className="px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(table.rows || []).map((row, ri) => (
              <tr key={ri} className="border-b border-gray-50">
                {(Array.isArray(row) ? row : []).map((cell, ci) => {
                  const text = String(cell ?? "");
                  if (addressColIdx.has(ci) && text && text !== "No address on file") {
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
                    return (
                      <td key={ci} className="px-2 py-1.5 whitespace-nowrap">
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-1"
                          title="Open in Google Maps"
                        >
                          {text}
                        </a>
                      </td>
                    );
                  }
                  return <td key={ci} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{text}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataChart({ chart }) {
  const data = chart.data || [];
  if (data.length === 0) return null;

  const renderChart = () => {
    switch (chart.chart_type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chart.x_key} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey={chart.y_key} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chart.x_key} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line dataKey={chart.y_key} stroke="#6366f1" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data} dataKey={chart.y_key} nameKey={chart.x_key} cx="50%" cy="50%" outerRadius={70} label={{ fontSize: 10 }}>
                {data.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chart.x_key} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area dataKey={chart.y_key} stroke="#6366f1" fill="#a5b4fc" />
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mt-2">
      {chart.title && <p className="text-xs font-semibold text-gray-600 mb-1">{chart.title}</p>}
      {renderChart()}
    </div>
  );
}

function ConflictReview({ conflicts, approved, onToggle }) {
  const fmtVal = (v) => {
    if (v == null) return "—";
    if (Array.isArray(v)) return v.join(", ") || "—";
    if (typeof v === "number") return String(v);
    const s = String(v);
    return s.length > 140 ? s.substring(0, 140) + "…" : s;
  };
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2 space-y-1.5">
      <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
        Fields already have data — review web updates
      </p>
      <p className="text-[11px] text-gray-500">
        These fields already contain information that differs from the web. Select the ones you want to update; unselected fields keep their current value.
      </p>
      {conflicts.map((c, i) => (
        <div key={i} className="rounded-md border border-amber-100 bg-white p-2">
          <div className="flex items-start gap-2">
            <Checkbox checked={approved.includes(c.field)} onCheckedChange={() => onToggle(c.field)} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700">
                {c.label} <span className="text-[10px] font-normal text-amber-600">({c.additive ? "add to existing" : "replace"})</span>
              </p>
              <div className="mt-0.5 text-[11px] text-gray-500 space-y-0.5">
                <p><span className="font-medium text-gray-600">Current:</span> {fmtVal(c.existing)}</p>
                <p><span className="font-medium text-indigo-600">From web:</span> {fmtVal(c.incoming)}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AIAssistantMessage({ message, onSelectOption, onConfirmCreation, onCancelCreation, isLoading }) {
  const isUser = message.role === "user";
  const isUpdateFirm = message.pending_creation?.type === "update_firm";
  const firmConflicts = isUpdateFirm ? (message.pending_creation.conflicts || []) : [];
  const contactUpdates = isUpdateFirm ? (message.pending_creation.contactUpdates || []) : [];
  const [approvedConflicts, setApprovedConflicts] = useState([]);
  // Per-contact conflict approvals: { [contactId]: Set of approved field names }
  const [approvedContactConflicts, setApprovedContactConflicts] = useState({});

  useEffect(() => {
    setApprovedConflicts([]);
    setApprovedContactConflicts({});
  }, [message.pending_creation]);

  const toggleConflict = (field) => {
    setApprovedConflicts((prev) => prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]);
  };

  const toggleContactConflict = (contactId, field) => {
    setApprovedContactConflicts((prev) => {
      const current = prev[contactId] || [];
      const next = current.includes(field) ? current.filter((f) => f !== field) : [...current, field];
      return { ...prev, [contactId]: next };
    });
  };

  const handleApply = () => {
    // Convert Set-based map to plain arrays for the handler
    const plainContactConflicts = {};
    for (const [id, fields] of Object.entries(approvedContactConflicts)) {
      plainContactConflicts[id] = Array.isArray(fields) ? fields : [...fields];
    }
    onConfirmCreation?.(message.pending_creation, { approvedConflicts, approvedContactConflicts: plainContactConflicts });
  };
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? "bg-indigo-100 text-indigo-600" : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser
          ? "bg-indigo-600 text-white rounded-br-md"
          : "bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm"
      }`}>
        {message.content && (
          isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )
        )}
        {!isUser && message.tables?.map((table, i) => (
          <DataTable key={`t-${i}`} table={table} />
        ))}
        {!isUser && message.charts?.map((chart, i) => (
          <DataChart key={`c-${i}`} chart={chart} />
        ))}
        {!isUser && message.options?.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onSelectOption?.(opt)}
                className="w-full text-left px-3 py-2 text-sm rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {!isUser && message.pending_creation && (
          <div className="mt-2">
            {isUpdateFirm && firmConflicts.length > 0 && (
              <ConflictReview conflicts={firmConflicts} approved={approvedConflicts} onToggle={toggleConflict} />
            )}
            {isUpdateFirm && contactUpdates.filter((cu) => cu.conflicts?.length > 0).map((cu) => (
              <div key={cu.id} className="mt-2 rounded-lg border border-blue-200 bg-blue-50/60 p-2 space-y-1.5">
                <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
                  {cu.contactName} — contact field updates
                </p>
                <p className="text-[11px] text-gray-500">
                  These contact fields already have data that differs from the web. Select ones to update.
                </p>
                {cu.conflicts.map((c, i) => {
                  const approved = (approvedContactConflicts[cu.id] || []).includes(c.field);
                  const fmtVal = (v) => {
                    if (v == null) return "—";
                    const s = String(v);
                    return s.length > 200 ? s.substring(0, 200) + "…" : s;
                  };
                  return (
                    <div key={i} className="rounded-md border border-blue-100 bg-white p-2">
                      <div className="flex items-start gap-2">
                        <Checkbox checked={approved} onCheckedChange={() => toggleContactConflict(cu.id, c.field)} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700">{c.label}</p>
                          <div className="mt-0.5 text-[11px] text-gray-500 space-y-0.5">
                            <p><span className="font-medium text-gray-600">Current:</span> {fmtVal(c.existing)}</p>
                            <p><span className="font-medium text-indigo-600">From web:</span> {fmtVal(c.incoming)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleApply}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {isUpdateFirm ? "Apply Updates" : "Confirm & Create"}
              </button>
              <button
                onClick={() => onCancelCreation?.()}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}