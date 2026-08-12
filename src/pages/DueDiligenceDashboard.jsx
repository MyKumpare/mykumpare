import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { CheckCircle2, Clock, Building2, TrendingUp, ClipboardCheck, AlertCircle } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function daysBetween(startStr, endStr) {
  if (!startStr) return 0;
  try {
    const start = parseISO(startStr);
    const end = endStr ? parseISO(endStr) : new Date();
    return Math.max(0, differenceInDays(end, start));
  } catch {
    return 0;
  }
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

export default function DueDiligenceDashboard() {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["due-diligence-all"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 500),
  });

  const stats = useMemo(() => {
    const active = records.filter((r) => !r.deleted_at);
    let totalStages = 0;
    let completedStages = 0;
    let pendingApproval = 0;
    const firmTimes = []; // { firm_name, days, record_count }
    const statusBreakdown = {};

    const firmMap = {}; // firm_name → { totalDays, count }

    for (const rec of active) {
      const stages = rec.stages || [];
      totalStages += stages.length;
      const completed = stages.filter((s) => s.completed || (s.supervisor_status === "approved"));
      completedStages += completed.length;

      const awaiting = stages.filter(
        (s) => (s.supervisor_status || "pending") === "pending" && s.supervisor_contact_id
      ).length;
      pendingApproval += awaiting;

      // Time per firm: from DD start_date to latest stage completed_date (or today)
      const start = rec.start_date;
      let end = null;
      for (const s of stages) {
        if (s.completed_date && (!end || s.completed_date > end)) end = s.completed_date;
      }
      const days = daysBetween(start, end);

      const firmName = rec.firm_name || "Unknown";
      if (!firmMap[firmName]) firmMap[firmName] = { totalDays: 0, count: 0 };
      firmMap[firmName].totalDays += days;
      firmMap[firmName].count += 1;

      const status = rec.status || "Pipeline";
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    }

    for (const [name, info] of Object.entries(firmMap)) {
      firmTimes.push({ firm_name: name, days: Math.round(info.totalDays / info.count), record_count: info.count });
    }
    firmTimes.sort((a, b) => b.days - a.days);

    const totalDays = active.reduce((sum, r) => {
      let end = null;
      for (const s of (r.stages || [])) {
        if (s.completed_date && (!end || s.completed_date > end)) end = s.completed_date;
      }
      return sum + daysBetween(r.start_date, end);
    }, 0);
    const avgDays = active.length > 0 ? Math.round(totalDays / active.length) : 0;

    return {
      totalRecords: active.length,
      totalStages,
      completedStages,
      pendingApproval,
      avgDays,
      firmTimes: firmTimes.slice(0, 10),
      statusBreakdown: Object.entries(statusBreakdown).map(([name, value]) => ({ name, value })),
    };
  }, [records]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const completionPct = stats.totalStages > 0 ? Math.round((stats.completedStages / stats.totalStages) * 100) : 0;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-gray-800">Due Diligence Analytics</h2>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={ClipboardCheck} label="Total DD Records" value={stats.totalRecords} color="bg-indigo-600" />
        <StatCard icon={CheckCircle2} label="Stages Completed" value={stats.completedStages} sublabel={`of ${stats.totalStages} total (${completionPct}%)`} color="bg-emerald-600" />
        <StatCard icon={AlertCircle} label="Awaiting Approval" value={stats.pendingApproval} sublabel="stages pending supervisor" color="bg-amber-500" />
        <StatCard icon={Clock} label="Avg. Time per DD" value={`${stats.avgDays}d`} sublabel="from start to latest completion" color="bg-purple-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Avg time per firm */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" /> Avg. Days per Firm (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.firmTimes.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.firmTimes} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="firm_name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip
                    formatter={(v) => [`${v} days`, "Avg Time"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="days" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-indigo-500" /> Records by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.statusBreakdown.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.statusBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {stats.statusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}