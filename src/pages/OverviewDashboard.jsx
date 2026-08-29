import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from "recharts";
import {
  Building, ListChecks, ArrowLeft, TrendingUp, Clock,
  CheckCircle2, XCircle, Loader2, UserCircle, Globe,
  ShieldCheck, AlertCircle, Activity, FileText, CalendarRange, GitBranch,
} from "lucide-react";
import AumAllocationSummary from "@/components/analytics/AumAllocationSummary";
import NewsSentimentTrendChart from "@/components/analytics/NewsSentimentTrendChart";
import ScoringThresholdAlertsPanel from "@/components/scoring/ScoringThresholdAlertsPanel";
import OverviewKpiConfigDialog from "@/components/dashboard/OverviewKpiConfigDialog";
import { resolveVisibleKpis } from "@/components/dashboard/overviewKpis";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { SlidersHorizontal } from "lucide-react";

function formatCompactCurrency(n) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const TYPE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4",
];

const TASK_STATUS_META = {
  "Not Started": { color: "#94a3b8", icon: Clock },
  "In-process": { color: "#6366f1", icon: Loader2 },
  "Completed": { color: "#10b981", icon: CheckCircle2 },
  "Cancelled": { color: "#ef4444", icon: XCircle },
};

const TASK_STATUSES = Object.keys(TASK_STATUS_META);

export default function OverviewDashboard() {
  const { user } = useAuth();
  const [dataScope, setDataScope] = useState("my"); // "my" | "all"
  const linkedFirmId = user?.data?.linked_firm_id;

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["follow_up_tasks_search"],
    queryFn: () => base44.entities.FollowUpTask.list("-due_date"),
  });

  const { data: dueDiligences = [], isLoading: ddLoading } = useQuery({
    queryKey: ["due-diligence-search"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 5000),
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["overview_activities"],
    queryFn: () => base44.entities.ContactActivity.list("-activity_date", 5000),
  });

  const { data: questionnaires = [], isLoading: questionnairesLoading } = useQuery({
    queryKey: ["overview_questionnaires"],
    queryFn: () => base44.entities.Questionnaire.list("-created_date", 5000),
  });

  const { data: allContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["overview_contacts_pipeline"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { data: pipelineStages = [] } = useQuery({
    queryKey: ["contact_pipeline_stages"],
    queryFn: () => base44.entities.ContactPipelineStage.list("order", 500),
  });

  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["overview_products"],
    queryFn: () => base44.entities.Product.list("-created_date", 5000),
  });

  const [kpiConfigOpen, setKpiConfigOpen] = useState(false);
  const [kpiConfig, setKpiConfig] = useState(null);
  const [kpiConfigLoading, setKpiConfigLoading] = useState(true);

  // Load the user's saved KPI configuration from their profile data.
  useEffect(() => {
    setKpiConfigLoading(true);
    base44.auth.me().then((me) => {
      setKpiConfig(me?.data?.overview_kpis || null);
      setKpiConfigLoading(false);
    }).catch(() => setKpiConfigLoading(false));
  }, []);

  const handleSaveKpiConfig = async (visibleKeys) => {
    setKpiConfig(visibleKeys);
    try {
      await base44.auth.updateMe({ overview_kpis: visibleKeys });
      toast({ title: "Dashboard KPIs updated" });
    } catch {
      toast({ title: "Could not save KPI configuration", variant: "destructive" });
    }
  };

  const scopedFirms = useMemo(() => {
    if (dataScope === "all" || !linkedFirmId) return firms.filter((f) => !f.deleted_at);
    return firms.filter((f) => !f.deleted_at && f.tenant_id === linkedFirmId);
  }, [firms, dataScope, linkedFirmId]);

  const scopedTasks = useMemo(() => {
    if (dataScope === "all" || !linkedFirmId) return tasks.filter((t) => !t.deleted_at);
    return tasks.filter(
      (t) => !t.deleted_at && (
        t.originator_firm_id === linkedFirmId ||
        t.assigned_to_firm_id === linkedFirmId ||
        t.created_by_id === user?.id
      )
    );
  }, [tasks, dataScope, linkedFirmId, user?.id]);

  const firmTypeData = useMemo(() => {
    const active = scopedFirms;
    const counts = {};
    FIRM_TYPES.forEach((t) => (counts[t] = 0));
    for (const f of active) {
      const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
      if (types.length === 0) {
        counts["Uncategorized"] = (counts["Uncategorized"] || 0) + 1;
      } else {
        for (const t of types) {
          counts[t] = (counts[t] || 0) + 1;
        }
      }
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [firms]);

  const taskStatusData = useMemo(() => {
    const active = scopedTasks;
    return TASK_STATUSES.map((status) => ({
      name: status,
      count: active.filter((t) => t.status === status).length,
    }));
  }, [tasks]);

  const scopedDueDiligences = useMemo(() => {
    if (dataScope === "all" || !linkedFirmId) return dueDiligences;
    return dueDiligences.filter((dd) => dd.tenant_id === linkedFirmId);
  }, [dueDiligences, dataScope, linkedFirmId]);

  // Count stages pending supervisor approval, grouped by firm.
  // A stage is "pending approval" when a supervisor has been assigned
  // (supervisor_contact_id set) and the status is still "pending".
  const ddPendingByFirm = useMemo(() => {
    const counts = {};
    for (const dd of scopedDueDiligences) {
      const stages = dd.stages || [];
      const pendingCount = stages.filter(
        (s) => s.supervisor_status === "pending" && s.supervisor_contact_id
      ).length;
      if (pendingCount > 0) {
        const key = dd.firm_name || "Unknown Firm";
        counts[key] = (counts[key] || 0) + pendingCount;
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [scopedDueDiligences]);

  const totalPendingApprovals = ddPendingByFirm.reduce((sum, f) => sum + f.count, 0);

  // Firm lookup map: firm_id → firm_types array
  const firmTypeMap = useMemo(() => {
    const map = new Map();
    for (const f of firms) {
      const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
      map.set(f.id, types);
    }
    return map;
  }, [firms]);

  // Firm engagement trend over the last 30 days
  const engagementTrendData = useMemo(() => {
    const today = new Date();
    const start = subDays(today, 29);
    const days = eachDayOfInterval({ start, end: today });

    const activityCounts = {};
    const taskCounts = {};
    const questionnaireCounts = {};

    for (const a of activities) {
      const d = a.activity_date?.substring(0, 10);
      if (d) activityCounts[d] = (activityCounts[d] || 0) + 1;
    }
    for (const t of tasks) {
      const d = t.due_date?.substring(0, 10);
      if (d) taskCounts[d] = (taskCounts[d] || 0) + 1;
    }
    for (const q of questionnaires) {
      const d = q.request_date?.substring(0, 10);
      if (d) questionnaireCounts[d] = (questionnaireCounts[d] || 0) + 1;
    }

    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      return {
        date: format(day, "MM/dd"),
        Activities: activityCounts[key] || 0,
        Tasks: taskCounts[key] || 0,
        Questionnaires: questionnaireCounts[key] || 0,
      };
    });
  }, [activities, tasks, questionnaires]);

  // Active questionnaires and logged activities per firm type
  const ACTIVE_Q_STATUSES = ["Draft", "Sent", "In Progress", "Under Review"];

  const engagementByFirmType = useMemo(() => {
    const scopedActivityIds = new Set(scopedFirms.map((f) => f.id));
    const scopedFirmIds = new Set(scopedFirms.map((f) => f.id));

    const counts = {};
    FIRM_TYPES.forEach((t) => (counts[t] = { questionnaires: 0, activities: 0 }));

    // Active questionnaires by firm type
    for (const q of questionnaires) {
      if (!ACTIVE_Q_STATUSES.includes(q.status)) continue;
      if (dataScope === "my" && linkedFirmId && q.tenant_id !== linkedFirmId) continue;
      const types = firmTypeMap.get(q.firm_id) || [];
      if (types.length === 0) {
        if (!counts["Uncategorized"]) counts["Uncategorized"] = { questionnaires: 0, activities: 0 };
        counts["Uncategorized"].questionnaires += 1;
      } else {
        for (const t of types) {
          if (!counts[t]) counts[t] = { questionnaires: 0, activities: 0 };
          counts[t].questionnaires += 1;
        }
      }
    }

    // Logged activities by firm type (via associated_firms_contacts)
    for (const a of activities) {
      const firmEntries = a.associated_firms_contacts || [];
      if (firmEntries.length === 0) continue;
      const countedTypes = new Set();
      for (const fe of firmEntries) {
        if (dataScope === "my" && linkedFirmId && !scopedFirmIds.has(fe.firm_id)) continue;
        const types = firmTypeMap.get(fe.firm_id) || [];
        for (const t of types) countedTypes.add(t);
      }
      if (countedTypes.size === 0 && firmEntries.length > 0) {
        if (!counts["Uncategorized"]) counts["Uncategorized"] = { questionnaires: 0, activities: 0 };
        counts["Uncategorized"].activities += 1;
      } else {
        for (const t of countedTypes) {
          if (!counts[t]) counts[t] = { questionnaires: 0, activities: 0 };
          counts[t].activities += 1;
        }
      }
    }

    return Object.entries(counts)
      .filter(([, v]) => v.questionnaires > 0 || v.activities > 0)
      .map(([name, v]) => ({ name, ...v }));
  }, [questionnaires, activities, firmTypeMap, scopedFirms, dataScope, linkedFirmId]);

  // Firms by pipeline stage, broken down by firm type.
  // For each pipeline stage, counts the distinct firms that have at least one
  // contact in that stage, grouped by the firm's firm type(s).
  const pipelineStageByFirmType = useMemo(() => {
    const scopedFirmIds = new Set(scopedFirms.map((f) => f.id));
    const activeContacts = allContacts.filter((c) => !c.deleted_at && c.pipeline_stage);

    // Ordered stage names from ContactPipelineStage records
    const stageOrder = {};
    pipelineStages.forEach((s) => { stageOrder[s.name] = s.order ?? 0; });

    // stage -> { firmType -> Set(firmId) }
    const stageFirmTypeFirms = {};
    for (const c of activeContacts) {
      const stage = c.pipeline_stage;
      const firmIds = (c.firm_ids || []).filter((fid) => scopedFirmIds.has(fid));
      for (const fid of firmIds) {
        const types = firmTypeMap.get(fid) || [];
        if (!stageFirmTypeFirms[stage]) stageFirmTypeFirms[stage] = {};
        const typeList = types.length ? types : ["Uncategorized"];
        for (const t of typeList) {
          if (!stageFirmTypeFirms[stage][t]) stageFirmTypeFirms[stage][t] = new Set();
          stageFirmTypeFirms[stage][t].add(fid);
        }
      }
    }

    // Determine which firm types have data (ordered)
    const activeTypes = new Set();
    for (const stage of Object.values(stageFirmTypeFirms)) {
      for (const t of Object.keys(stage)) activeTypes.add(t);
    }
    const orderedTypes = [
      ...FIRM_TYPES.filter((t) => activeTypes.has(t)),
      ...(activeTypes.has("Uncategorized") ? ["Uncategorized"] : []),
    ];

    const stages = Object.keys(stageFirmTypeFirms)
      .sort((a, b) => (stageOrder[a] ?? 9999) - (stageOrder[b] ?? 9999));

    const data = stages.map((stage) => {
      const row = { stage };
      for (const t of orderedTypes) row[t] = stageFirmTypeFirms[stage][t]?.size || 0;
      return row;
    });

    return { data, types: orderedTypes };
  }, [allContacts, pipelineStages, scopedFirms, firmTypeMap]);

  const totalFirms = scopedFirms.length;
  const totalTasks = scopedTasks.length;
  const overdueTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return scopedTasks.filter(
      (t) => t.status !== "Completed" && t.status !== "Cancelled" && t.due_date < today
    ).length;
  }, [scopedTasks]);

  const scopedProducts = useMemo(() => {
    if (dataScope === "all" || !linkedFirmId) return allProducts.filter((p) => !p.deleted_at);
    return allProducts.filter((p) => !p.deleted_at && p.tenant_id === linkedFirmId);
  }, [allProducts, dataScope, linkedFirmId]);

  const scopedContacts = useMemo(() => {
    if (dataScope === "all" || !linkedFirmId) return allContacts.filter((c) => !c.deleted_at);
    return allContacts.filter((c) => !c.deleted_at && (c.tenant_id === linkedFirmId || (c.firm_ids || []).some((fid) => scopedFirms.some((f) => f.id === fid))));
  }, [allContacts, dataScope, linkedFirmId, scopedFirms]);

  const visibleKpis = kpiConfigLoading ? [] : resolveVisibleKpis(kpiConfig);

  const kpiValues = {
    scopedFirms,
    scopedTasks,
    overdueTasks,
    taskStatusData,
    totalPendingApprovals,
    scopedProducts,
    scopedContacts,
  };

  const userName = user?.full_name || user?.email || "";

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-5 w-px bg-white/30" />
            <h1 className="text-lg font-bold tracking-tight">Overview Dashboard</h1>
          </div>
          {userName && <span className="text-xs text-white/70 hidden sm:block">{userName}</span>}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Data scope toggle */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-gray-500">
            {dataScope === "my" ? "Showing data associated with your firm" : "Showing all firm data"}
          </p>
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            <button
              onClick={() => setDataScope("my")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dataScope === "my" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <UserCircle className="w-3.5 h-3.5" />
              My Data
            </button>
            <button
              onClick={() => setDataScope("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dataScope === "all" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              All Data
            </button>
          </div>
        </div>

        {/* Summary cards — configurable KPIs */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setKpiConfigOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-indigo-600 shadow-sm transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Configure KPIs
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiConfigLoading ? (
            <>
              <SummaryCard label="Loading…" value="" icon={Building} color="bg-gray-300" loading />
              <SummaryCard label="Loading…" value="" icon={ListChecks} color="bg-gray-300" loading />
              <SummaryCard label="Loading…" value="" icon={Clock} color="bg-gray-300" loading />
              <SummaryCard label="Loading…" value="" icon={TrendingUp} color="bg-gray-300" loading />
            </>
          ) : visibleKpis.length === 0 ? (
            <div className="col-span-full text-center py-8 border border-dashed border-gray-200 rounded-xl">
              <p className="text-sm text-gray-400 mb-2">No KPIs selected for your dashboard.</p>
              <button
                type="button"
                onClick={() => setKpiConfigOpen(true)}
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                Configure KPIs to show metrics here
              </button>
            </div>
          ) : (
            visibleKpis.map((kpi) => {
              const Icon = kpi.icon;
              const raw = kpi.compute(kpiValues);
              const value = kpi.format === "currency" ? formatCompactCurrency(raw) : raw;
              return (
                <SummaryCard
                  key={kpi.key}
                  label={kpi.label}
                  value={value}
                  icon={Icon}
                  color={kpi.color}
                  loading={firmsLoading || tasksLoading || productsLoading}
                />
              );
            })
          )}
        </div>

        <OverviewKpiConfigDialog
          open={kpiConfigOpen}
          onOpenChange={setKpiConfigOpen}
          currentConfig={kpiConfig}
          onSave={handleSaveKpiConfig}
        />

        {/* Below-threshold scoring alerts */}
        <ScoringThresholdAlertsPanel linkedFirmId={linkedFirmId} />

        {/* AUM Allocation Reconciliation */}
        <AumAllocationSummary firms={scopedFirms} loading={firmsLoading} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Firm type breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-800">Firms by Type</h2>
            </div>
            {firmsLoading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
            ) : firmTypeData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No firm data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={firmTypeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {firmTypeData.map((_, idx) => (
                      <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Follow-up task status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ListChecks className="w-5 h-5 text-violet-600" />
              <h2 className="text-sm font-semibold text-gray-800">Follow-Up Tasks by Status</h2>
            </div>
            {tasksLoading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
            ) : totalTasks === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No task data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={taskStatusData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f9fafb" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={48}>
                    {taskStatusData.map((entry, idx) => (
                      <Cell key={idx} fill={TASK_STATUS_META[entry.name]?.color || "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Firms by Pipeline Stage across Firm Types */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-800">Firms by Pipeline Stage (by Firm Type)</h2>
          </div>
          {contactsLoading ? (
            <div className="h-72 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : pipelineStageByFirmType.data.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
              No pipeline stage data — assign contacts to pipeline stages to see this chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={pipelineStageByFirmType.data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#f9fafb" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                {pipelineStageByFirmType.types.map((t, idx) => {
                  const isLast = idx === pipelineStageByFirmType.types.length - 1;
                  const color = t === "Uncategorized" ? "#94a3b8" : TYPE_COLORS[FIRM_TYPES.indexOf(t) % TYPE_COLORS.length];
                  return (
                    <Bar
                      key={t}
                      dataKey={t}
                      stackId="a"
                      fill={color}
                      radius={isLast ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                      maxBarSize={64}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Firm Engagement Trend — Last 30 Days */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarRange className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-800">Firm Engagement Trend — Last 30 Days</h2>
          </div>
          {activitiesLoading || tasksLoading || questionnairesLoading ? (
            <div className="h-72 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={engagementTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradActivities" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradQuestionnaires" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} interval={3} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="Activities" stroke="#6366f1" strokeWidth={2} fill="url(#gradActivities)" />
                <Area type="monotone" dataKey="Tasks" stroke="#f59e0b" strokeWidth={2} fill="url(#gradTasks)" />
                <Area type="monotone" dataKey="Questionnaires" stroke="#10b981" strokeWidth={2} fill="url(#gradQuestionnaires)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* News Sentiment Trend — Last 30 Days */}
        <NewsSentimentTrendChart scope={dataScope} linkedFirmId={linkedFirmId} />

        {/* Active Questionnaires & Logged Activities by Firm Type */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-800">
              Active Questionnaires & Logged Activities by Firm Type
            </h2>
          </div>
          {activitiesLoading || questionnairesLoading ? (
            <div className="h-72 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : engagementByFirmType.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
              No engagement data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={engagementByFirmType} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#f9fafb" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="questionnaires" name="Active Questionnaires" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32} />
                <Bar dataKey="activities" name="Logged Activities" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* DD Pending Approval by Firm */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <h2 className="text-sm font-semibold text-gray-800">Due Diligence Pending Supervisor Approval by Firm</h2>
            </div>
            {totalPendingApprovals > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {totalPendingApprovals} pending
              </span>
            )}
          </div>
          {ddLoading ? (
            <div className="h-24 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : ddPendingByFirm.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
              No due diligence tasks pending supervisor approval
            </div>
          ) : (
            <div className="space-y-2.5">
              {ddPendingByFirm.map((entry) => {
                const pct = totalPendingApprovals > 0 ? Math.round((entry.count / totalPendingApprovals) * 100) : 0;
                return (
                  <div key={entry.name} className="flex items-center gap-3">
                    <div className="w-40 sm:w-56 flex-shrink-0 truncate text-xs font-medium text-gray-700" title={entry.name}>
                      {entry.name}
                    </div>
                    <div className="flex-1 h-7 rounded-lg bg-gray-100 overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: "#f59e0b" }}
                      >
                        <span className="text-[10px] font-bold text-white">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-8 flex-shrink-0 text-right">
                      <span className="text-sm font-bold text-gray-900">{entry.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Task status breakdown list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-semibold text-gray-800">Task Status Breakdown</h2>
          </div>
          {tasksLoading ? (
            <div className="h-24 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {taskStatusData.map((s) => {
                const meta = TASK_STATUS_META[s.name];
                const Icon = meta?.icon || Clock;
                const pct = totalTasks > 0 ? Math.round((s.count / totalTasks) * 100) : 0;
                return (
                  <div key={s.name} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className="w-3.5 h-3.5" style={{ color: meta?.color }} />
                      <span className="text-xs font-medium text-gray-700">{s.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-gray-900">{s.count}</span>
                      <span className="text-xs text-gray-400">({pct}%)</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: meta?.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color, loading }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        {loading ? (
          <div className="w-12 h-6 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}