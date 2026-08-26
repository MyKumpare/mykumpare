import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, ComposedChart,
} from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";

/**
 * InfluenceTrendChart — tracks the total network influence score over the
 * past six months so the user can see their progress.
 *
 * The score is computed using the same formula as the Contact Influence
 * Dashboard (firms + boards × 2 + team seats), but evaluated as of each
 * month-end using the created_date of every entity as a proxy for when the
 * relationship became active. This produces a cumulative-growth trend.
 */

function monthEndDates(months = 6) {
  const dates = [];
  const now = new Date();
  for (let i = months; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // last day of the month
    dates.push(d);
  }
  return dates;
}

function fmtLabel(d) {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function InfluenceTrendChart({ contacts = [], firms = [], boardMeetings = [], products = [], isLoading = false }) {
  const chartData = useMemo(() => {
    if (!contacts.length && !firms.length) return [];

    const points = monthEndDates(6);
    const firmMap = new Map(firms.map((f) => [f.id, f]));
    const boardsByFirm = new Map();
    boardMeetings.forEach((b) => {
      if (!b.firm_id) return;
      if (!boardsByFirm.has(b.firm_id)) boardsByFirm.set(b.firm_id, []);
      boardsByFirm.get(b.firm_id).push(b);
    });

    return points.map((date) => {
      const ts = date.getTime();

      // Entities that existed as of this month-end
      const firmsAlive = firms.filter((f) => !f.deleted_at && new Date(f.created_date).getTime() <= ts);
      const contactsAlive = contacts.filter((c) => !c.deleted_at && new Date(c.created_date).getTime() <= ts);
      const boardsAlive = boardMeetings.filter((b) => {
        const created = new Date(b.created_date).getTime();
        return created <= ts;
      });
      const productsAlive = products.filter((p) => !p.deleted_at && new Date(p.created_date).getTime() <= ts);

      const firmIdsAlive = new Set(firmsAlive.map((f) => f.id));
      const boardsByFirmAlive = new Map();
      boardsAlive.forEach((b) => {
        if (!b.firm_id) return;
        if (!boardsByFirmAlive.has(b.firm_id)) boardsByFirmAlive.set(b.firm_id, []);
        boardsByFirmAlive.get(b.firm_id).push(b);
      });

      let totalScore = 0;
      contactsAlive.forEach((c) => {
        const directFirmIds = (Array.isArray(c.firm_ids) ? c.firm_ids : []).filter(
          (fid) => firmIdsAlive.has(fid)
        );
        const teamProducts = productsAlive.filter(
          (p) => Array.isArray(p.investment_team) && p.investment_team.some((m) => m.contact_id === c.id)
        );
        const teamFirmIds = teamProducts.map((p) => p.firm_id).filter((fid) => fid && !directFirmIds.includes(fid) && firmIdsAlive.has(fid));
        const allFirmIds = [...new Set([...directFirmIds, ...teamFirmIds])];
        const boardCount = allFirmIds.reduce((sum, fid) => sum + (boardsByFirmAlive.get(fid) || []).length, 0);
        const firmCount = allFirmIds.length;
        const teamSeatCount = teamProducts.length;
        totalScore += firmCount + boardCount * 2 + teamSeatCount;
      });

      return {
        label: fmtLabel(date),
        score: totalScore,
        contacts: contactsAlive.length,
      };
    });
  }, [contacts, firms, boardMeetings, products]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center justify-center h-[260px]">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  const first = chartData[0]?.score || 0;
  const last = chartData[chartData.length - 1]?.score || 0;
  const delta = last - first;
  const pct = first > 0 ? Math.round((delta / first) * 100) : 0;
  const isUp = delta >= 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Network Influence Trend</h3>
            <p className="text-[11px] text-gray-400">Total influence score over the past 6 months</p>
          </div>
        </div>
        {chartData.length > 1 && (
          <div className="text-right">
            <span className={`text-lg font-bold ${isUp ? "text-emerald-600" : "text-red-500"}`}>
              {isUp ? "+" : ""}{delta}
            </span>
            <span className={`text-xs ml-1 ${isUp ? "text-emerald-500" : "text-red-400"}`}>
              {isUp ? "▲" : "▼"} {Math.abs(pct)}%
            </span>
          </div>
        )}
      </div>
      <div style={{ height: 200 }}>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            No data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="influenceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" width={45} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                formatter={(value, name) => {
                  if (name === "score") return [value, "Total Score"];
                  if (name === "contacts") return [value, "Contacts"];
                  return [value, name];
                }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="score" stroke="none" fill="url(#influenceGrad)" />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}