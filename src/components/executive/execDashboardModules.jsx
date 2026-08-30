import React from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  DollarSign, Building2, Package, Wallet, Globe, TrendingUp,
  Layers, PieChart as PieIcon, BarChart3, Grid3x3, AlertTriangle,
  ClipboardCheck,
  AlertOctagon,
  Briefcase,
  Users,
  Network,
  Clock,
} from "lucide-react";
import ExposureHeatmap from "./ExposureHeatmap";
import FundingBreakdownCharts from "./FundingBreakdownCharts";
import TopFirmsAumTrendChart from "./TopFirmsAumTrendChart";
import FirmBenchmarkComparison from "./FirmBenchmarkComparison";
import StuckDdProcesses from "./StuckDdProcesses";
import DdProcessesByStatus from "./DdProcessesByStatus";
import StalledDdAlertsIndicator from "./StalledDdAlertsIndicator";
import DdApprovalsByTeamMember from "./DdApprovalsByTeamMember";
import DdWorkloadHeatmap from "./DdWorkloadHeatmap";
import AllocatorsByConsultantRole from "./AllocatorsByConsultantRole";
import ConsultantRolesByFirmType from "./ConsultantRolesByFirmType";
import DdAvgStageDuration from "./DdAvgStageDuration";

export const FIRM_TYPES = [
  "Investment Manager", "Allocator", "Investment Consultant",
  "Securities Brokerage", "Trade Organizations",
];

export const TYPE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#94a3b8",
];

export function formatCompactCurrency(n) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function ChartCard({ title, subtitle, icon: Icon, iconColor, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 h-full">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function EmptyChart({ label }) {
  return (
    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">{label}</div>
  );
}

// ── Module Registry ──
// Each module: { id, title, description, icon, width, category, render: (data) => JSX }
export const MODULE_REGISTRY = {
  chart_exposure_by_firm_type: {
    id: "chart_exposure_by_firm_type",
    title: "Exposure by Firm Type",
    description: "Latest AUM distribution by firm type",
    icon: PieIcon,
    width: "half",
    category: "Charts",
    render: (d) => (
      <ChartCard title="Exposure by Firm Type" subtitle="Latest AUM distribution" icon={PieIcon} iconColor="text-indigo-600">
        {d.exposureByFirmType.length === 0 ? (
          <EmptyChart label="No firm AUM data" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={d.exposureByFirmType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                {d.exposureByFirmType.map((_, idx) => (
                  <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCompactCurrency(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
              <Legend layout="horizontal" align="center" verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    ),
  },

  chart_exposure_by_region: {
    id: "chart_exposure_by_region",
    title: "Exposure by Geographic Region",
    description: "AUM distribution by region",
    icon: Globe,
    width: "half",
    category: "Charts",
    render: (d) => (
      <ChartCard title="Exposure by Geographic Region" subtitle="AUM by region" icon={Globe} iconColor="text-emerald-600">
        {d.exposureByRegion.length === 0 ? (
          <EmptyChart label="No region data" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.exposureByRegion} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={120} />
              <Tooltip formatter={(v) => formatCompactCurrency(v)} cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                {d.exposureByRegion.map((_, idx) => (
                  <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    ),
  },

  chart_product_by_asset_class: {
    id: "chart_product_by_asset_class",
    title: "Product AUM by Asset Class",
    description: "Latest product AUM by asset class",
    icon: Layers,
    width: "half",
    category: "Charts",
    render: (d) => (
      <ChartCard title="Product AUM by Asset Class" subtitle="Latest product AUM" icon={Layers} iconColor="text-violet-600">
        {d.productByAssetClass.length === 0 ? (
          <EmptyChart label="No product AUM data" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.productByAssetClass} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" height={60} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
              <Tooltip formatter={(v) => formatCompactCurrency(v)} cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40} fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    ),
  },

  chart_exposure_by_funding: {
    id: "chart_exposure_by_funding",
    title: "Exposure by Funding Status",
    description: "Firm AUM by funding state",
    icon: TrendingUp,
    width: "half",
    category: "Charts",
    render: (d) => (
      <ChartCard title="Exposure by Funding Status" subtitle="Firm AUM by funding state" icon={TrendingUp} iconColor="text-amber-600">
        {d.exposureByFunding.length === 0 ? (
          <EmptyChart label="No funding data" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={d.exposureByFunding} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
                <Cell fill="#94a3b8" />
              </Pie>
              <Tooltip formatter={(v) => formatCompactCurrency(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
              <Legend layout="horizontal" align="center" verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    ),
  },

  chart_committed_capital_by_type: {
    id: "chart_committed_capital_by_type",
    title: "Committed Capital by Advisor Type",
    description: "Portfolio allocations to IM firms",
    icon: Wallet,
    width: "half",
    category: "Charts",
    render: (d) => (
      <ChartCard title="Committed Capital by Advisor Type" subtitle="Portfolio allocations to IM firms" icon={Wallet} iconColor="text-indigo-600">
        {d.portfolioCapitalByType.length === 0 ? (
          <EmptyChart label="No portfolio allocation data" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.portfolioCapitalByType} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={140} />
              <Tooltip formatter={(v) => formatCompactCurrency(v)} cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    ),
  },

  chart_products_by_status: {
    id: "chart_products_by_status",
    title: "Products by Review Status",
    description: "Product pipeline distribution",
    icon: BarChart3,
    width: "half",
    category: "Charts",
    render: (d) => (
      <ChartCard title="Products by Review Status" subtitle="Product pipeline distribution" icon={BarChart3} iconColor="text-cyan-600">
        {d.productByStatus.length === 0 ? (
          <EmptyChart label="No product data" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.productByStatus} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" height={60} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40} fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    ),
  },

  stuck_dd_processes: {
    id: "stuck_dd_processes",
    title: "Stuck Due Diligence Processes",
    description: "Processes in the same stage for 5+ days",
    icon: AlertTriangle,
    width: "full",
    category: "Analytics",
    render: (d) => <StuckDdProcesses ddRecords={d.ddRecords || []} />,
  },

  dd_processes_by_status: {
    id: "dd_processes_by_status",
    title: "DD Processes by Status",
    description: "Active due diligence count by current status",
    icon: ClipboardCheck,
    width: "half",
    category: "Charts",
    render: (d) => <DdProcessesByStatus ddRecords={d.ddRecords || []} />,
  },

  stalled_dd_alerts: {
    id: "stalled_dd_alerts",
    title: "Stalled DD Alerts",
    description: "Processes in the same stage for 6+ months",
    icon: AlertOctagon,
    width: "half",
    category: "Alerts",
    render: () => <StalledDdAlertsIndicator />,
  },

  dd_approvals_by_team_member: {
    id: "dd_approvals_by_team_member",
    title: "DD Approvals by Team Member",
    description: "Stage approvals completed per team member",
    icon: ClipboardCheck,
    width: "half",
    category: "Charts",
    render: (d) => <DdApprovalsByTeamMember ddRecords={d.ddRecords || []} />,
  },

  dd_avg_stage_duration: {
    id: "dd_avg_stage_duration",
    title: "Avg. Time per DD Stage",
    description: "Average days spent on each due diligence stage across active projects",
    icon: Clock,
    width: "half",
    category: "Charts",
    render: (d) => <DdAvgStageDuration ddRecords={d.ddRecords || []} />,
  },

  allocators_by_consultant_role: {
    id: "allocators_by_consultant_role",
    title: "Allocators by Consultant Role",
    description: "Allocator count per investment consultant role type",
    icon: Briefcase,
    width: "half",
    category: "Charts",
    render: () => <AllocatorsByConsultantRole />,
  },

  dd_workload_heatmap: {
    id: "dd_workload_heatmap",
    title: "DD Workload Heatmap",
    description: "Active due diligence assignments per team member by status",
    icon: Users,
    width: "full",
    category: "Analytics",
    render: (d) => <DdWorkloadHeatmap ddRecords={d.ddRecords || []} />,
  },

  consultant_roles_by_firm_type: {
    id: "consultant_roles_by_firm_type",
    title: "Consultant Roles by Firm Type",
    description: "Active consultant role counts aggregated by firm type",
    icon: Network,
    width: "full",
    category: "Analytics",
    render: () => <ConsultantRolesByFirmType />,
  },

  top_firms_aum_trend: {
    id: "top_firms_aum_trend",
    title: "Top Firms AUM Growth Trends",
    description: "Historical AUM growth for top firms",
    icon: TrendingUp,
    width: "full",
    category: "Analytics",
    render: (d) => <TopFirmsAumTrendChart firms={d.scopedFirms} />,
  },

  firm_benchmark_comparison: {
    id: "firm_benchmark_comparison",
    title: "Firm vs. Benchmark Performance",
    description: "Compare firm returns against market benchmarks",
    icon: DollarSign,
    width: "full",
    category: "Analytics",
    render: (d) => (
      <FirmBenchmarkComparison
        firms={d.scopedFirms}
        products={d.scopedProducts}
        portfolios={d.scopedPortfolios}
      />
    ),
  },

  funding_breakdown_charts: {
    id: "funding_breakdown_charts",
    title: "Funding Breakdown",
    description: "Market value and funding status counts",
    icon: TrendingUp,
    width: "full",
    category: "Analytics",
    render: (d) => <FundingBreakdownCharts firms={d.scopedFirms} />,
  },

  exposure_heatmap: {
    id: "exposure_heatmap",
    title: "Exposure Heatmap",
    description: "Firm type × region concentration",
    icon: Grid3x3,
    width: "full",
    category: "Analytics",
    render: (d) => <ExposureHeatmap firms={d.scopedFirms} />,
  },

  firm_type_summary_table: {
    id: "firm_type_summary_table",
    title: "Exposure Summary by Firm Type",
    description: "Detailed breakdown table",
    icon: Building2,
    width: "full",
    category: "Tables",
    render: (d) => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-800">Exposure Summary by Firm Type</h2>
        </div>
        {d.firmTypeSummary.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No firm data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 bg-gray-50/50">
                  <th className="text-left font-medium py-2.5 px-5">Firm Type</th>
                  <th className="text-right font-medium py-2.5 px-3">Firms</th>
                  <th className="text-right font-medium py-2.5 px-3">Total Exposure</th>
                  <th className="text-right font-medium py-2.5 px-5">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {d.firmTypeSummary.map((row, idx) => {
                  const pct = d.totalExposure > 0 ? (row.exposure / d.totalExposure) * 100 : 0;
                  const colorIdx = FIRM_TYPES.indexOf(row.name) >= 0 ? FIRM_TYPES.indexOf(row.name) : idx % TYPE_COLORS.length;
                  return (
                    <tr key={row.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="py-2.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[colorIdx] }} />
                          <span className="font-medium text-gray-800">{row.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-3 text-gray-600">{row.firms}</td>
                      <td className="text-right py-2.5 px-3 font-semibold text-gray-900 whitespace-nowrap">
                        {formatCompactCurrency(row.exposure)}
                      </td>
                      <td className="text-right py-2.5 px-5">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TYPE_COLORS[colorIdx] }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                  <td className="py-2.5 px-5 text-gray-800">Total</td>
                  <td className="text-right py-2.5 px-3 text-gray-700">{d.totalFirms}</td>
                  <td className="text-right py-2.5 px-3 text-gray-900 whitespace-nowrap">
                    {formatCompactCurrency(d.totalExposure)}
                  </td>
                  <td className="text-right py-2.5 px-5 text-gray-500">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    ),
  },
};

export const DEFAULT_MODULE_ORDER = [
  "chart_exposure_by_firm_type",
  "chart_exposure_by_region",
  "chart_product_by_asset_class",
  "chart_exposure_by_funding",
  "chart_committed_capital_by_type",
  "chart_products_by_status",
  "dd_processes_by_status",
  "dd_approvals_by_team_member",
  "dd_avg_stage_duration",
  "allocators_by_consultant_role",
  "consultant_roles_by_firm_type",
  "dd_workload_heatmap",
  "stalled_dd_alerts",
  "stuck_dd_processes",
  "top_firms_aum_trend",
  "firm_benchmark_comparison",
  "funding_breakdown_charts",
  "exposure_heatmap",
  "firm_type_summary_table",
];

const STORAGE_KEY = "exec-dashboard-layout";

/** Load saved module order from localStorage, filtered to valid modules. */
export function loadModuleOrder() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_MODULE_ORDER;
    const ids = JSON.parse(saved);
    if (!Array.isArray(ids)) return DEFAULT_MODULE_ORDER;
    return ids.filter((id) => MODULE_REGISTRY[id]);
  } catch {
    return DEFAULT_MODULE_ORDER;
  }
}

export function saveModuleOrder(order) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch { /* ignore */ }
}