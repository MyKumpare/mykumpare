import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Users, Building2, AlertTriangle, UserCheck, CalendarRange,
} from "lucide-react";
import { formatCoverageDate } from "@/lib/analystHistoryClient";
import ReportDateRangePicker from "@/components/reports/ReportDateRangePicker";

function getQuarterRange(date = new Date()) {
  const month = date.getMonth(); // 0-11
  const qStartMonth = Math.floor(month / 3) * 3;
  const start = new Date(date.getFullYear(), qStartMonth, 1);
  const end = new Date(date.getFullYear(), qStartMonth + 3, 0); // last day of quarter
  return { start, end };
}

function inRange(dateStr, rStart, rEnd) {
  if (!dateStr || !rStart || !rEnd) return false;
  const d = new Date(dateStr + "T00:00:00");
  return d >= rStart && d <= rEnd;
}

function StatCard({ icon: Icon, label, value, sublabel, color }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
            {sublabel && <p className="text-[10px] text-gray-400">{sublabel}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalystCoverageReport() {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["due-diligence-all"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 500),
  });

  const availableRange = useMemo(() => {
    const dates = [];
    for (const rec of records) {
      if (rec.deleted_at) continue;
      for (const e of rec.analyst_history || []) {
        if (e.start_date) dates.push(e.start_date);
        if (e.end_date) dates.push(e.end_date);
      }
    }
    dates.sort();
    return dates.length ? { oldest: dates[0], newest: dates[dates.length - 1] } : null;
  }, [records]);

  const [dateRange, setDateRange] = useState(() => {
    const { start, end } = getQuarterRange();
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  });
  const rangeStart = useMemo(() => (dateRange.start ? new Date(dateRange.start + "T00:00:00") : null), [dateRange.start]);
  const rangeEnd = useMemo(() => (dateRange.end ? new Date(dateRange.end + "T23:59:59") : null), [dateRange.end]);
  const quarterLabel = dateRange.start && dateRange.end
    ? `${new Date(dateRange.start + "T00:00:00").toLocaleDateString("en-US")} – ${new Date(dateRange.end + "T00:00:00").toLocaleDateString("en-US")}`
    : "All time";

  const analysis = useMemo(() => {
    const active = records.filter((r) => !r.deleted_at);

    // Analyst → set of firm_ids they currently cover (active assignment, no end_date)
    const analystFirms = {}; // contact_id -> { name, firmIds: Set, firmNames: Set }
    // Firms with inactive coverage this quarter (any entry with end_date in quarter)
    const inactiveFirms = []; // { firm_name, product_name, analyst_name, analyst_type, end_date }
    let quarterAssignments = 0; // new assignments started this quarter
    let activeAnalystsCount = 0;

    for (const rec of active) {
      const history = rec.analyst_history || [];
      for (const entry of history) {
        // Currently active assignment
        if (!entry.end_date && entry.contact_id) {
          if (!analystFirms[entry.contact_id]) {
            analystFirms[entry.contact_id] = {
              name: entry.contact_name || "—",
              firmIds: new Set(),
              firmNames: new Set(),
            };
          }
          analystFirms[entry.contact_id].firmIds.add(rec.firm_id);
          analystFirms[entry.contact_id].firmNames.add(rec.firm_name || "Unknown");
        }
        // Inactive coverage ended within selected range
        if (entry.end_date && inRange(entry.end_date, rangeStart, rangeEnd)) {
          inactiveFirms.push({
            firm_name: rec.firm_name || "—",
            product_name: rec.product_name || "—",
            analyst_name: entry.contact_name || "—",
            analyst_type: entry.analyst_type,
            end_date: entry.end_date,
          });
        }
        // New assignment started within selected range
        if (entry.start_date && inRange(entry.start_date, rangeStart, rangeEnd)) {
          quarterAssignments += 1;
        }
      }
    }

    const analystFirmCounts = Object.entries(analystFirms).map(([id, info]) => ({
      id,
      name: info.name,
      firmCount: info.firmIds.size,
      firmNames: Array.from(info.firmNames),
    }));
    analystFirmCounts.sort((a, b) => b.firmCount - a.firmCount);
    activeAnalystsCount = analystFirmCounts.length;

    inactiveFirms.sort((a, b) => (b.end_date || "").localeCompare(a.end_date || ""));

    return {
      activeAnalystsCount,
      quarterAssignments,
      inactiveFirms,
      analystFirmCounts,
      totalFirmsCovered: new Set(active.map((r) => r.firm_id).filter(Boolean)).size,
    };
  }, [records, rangeStart, rangeEnd]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const chartData = analysis.analystFirmCounts.slice(0, 15);

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Users className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-gray-800">Analyst Coverage Report</h2>
        <Badge variant="outline" className="text-xs border-indigo-200 bg-indigo-50 text-indigo-700">
          <CalendarRange className="w-3 h-3 mr-1" />
          {quarterLabel}
        </Badge>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <ReportDateRangePicker value={dateRange} onChange={setDateRange} availableRange={availableRange} label="Filter analyst coverage by assignment start/end dates" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={UserCheck}
          label="Active Analysts"
          value={analysis.activeAnalystsCount}
          sublabel="currently covering firms"
          color="bg-indigo-600"
        />
        <StatCard
          icon={Building2}
          label="Firms Covered"
          value={analysis.totalFirmsCovered}
          sublabel="with DD records"
          color="bg-emerald-600"
        />
        <StatCard
          icon={CalendarRange}
          label="New Assignments"
          value={analysis.quarterAssignments}
          sublabel={`started in ${quarterLabel}`}
          color="bg-purple-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Inactive Coverage"
          value={analysis.inactiveFirms.length}
          sublabel={`ended in ${quarterLabel}`}
          color="bg-amber-500"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Firms per analyst chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-500" /> Firms per Active Analyst (Top 15)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-8 text-center">No active analysts</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 28)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    width={120}
                  />
                  <Tooltip
                    formatter={(v) => [`${v} firm${v === 1 ? "" : "s"}`, "Covers"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="firmCount" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Analyst firm list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" /> Active Analyst Firm Counts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.analystFirmCounts.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-8 text-center">No active analysts</p>
            ) : (
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                {analysis.analystFirmCounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {a.firmNames.join(", ")}
                      </p>
                    </div>
                    <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-200 flex-shrink-0">
                      {a.firmCount} {a.firmCount === 1 ? "firm" : "firms"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inactive coverage this quarter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Firms with Inactive Coverage
            <span className="text-xs text-gray-400 font-normal">({quarterLabel})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.inactiveFirms.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-8 text-center">
              No coverage ended during {quarterLabel}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3 font-medium">Firm</th>
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="py-2 pr-3 font-medium">Analyst</th>
                    <th className="py-2 pr-3 font-medium">Role</th>
                    <th className="py-2 pr-3 font-medium">Coverage Ended</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.inactiveFirms.map((f, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-gray-800">{f.firm_name}</td>
                      <td className="py-2 pr-3 text-gray-600">{f.product_name}</td>
                      <td className="py-2 pr-3 text-gray-600">{f.analyst_name}</td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            f.analyst_type === "primary"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-violet-200 bg-violet-50 text-violet-700"
                          }`}
                        >
                          {f.analyst_type === "primary" ? "Primary" : "Secondary"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {formatCoverageDate(f.end_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}