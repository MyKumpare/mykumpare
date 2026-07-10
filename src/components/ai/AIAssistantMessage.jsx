import React from "react";
import ReactMarkdown from "react-markdown";
import { User, Bot } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#14b8a6"];

function DataTable({ table }) {
  return (
    <div className="mt-2">
      {table.title && <p className="text-xs font-semibold text-gray-600 mb-1">{table.title}</p>}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {(table.headers || []).map((h, i) => (
                <th key={i} className="px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(table.rows || []).map((row, ri) => (
              <tr key={ri} className="border-b border-gray-50">
                {(Array.isArray(row) ? row : []).map((cell, ci) => (
                  <td key={ci} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{String(cell ?? "")}</td>
                ))}
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

export default function AIAssistantMessage({ message }) {
  const isUser = message.role === "user";
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
      </div>
    </div>
  );
}