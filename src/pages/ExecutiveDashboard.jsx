import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  ArrowLeft, LayoutDashboard, DollarSign, Building2, Package, Wallet,
  Globe, TrendingUp, Layers, PieChart as PieIcon, BarChart3, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import ExposureHeatmap from "@/components/executive/ExposureHeatmap";
import FundingBreakdownCharts from "@/components/executive/FundingBreakdownCharts";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const REGIONS = [
  "Undefined", "North America", "Europe", "Asia-Pacific",
  "Latin America", "Middle East & Africa", "Global",
];

const TYPE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#94a3b8",
];

function formatCompactCurrency(n) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

// Get the latest AUM history entry for a firm/product
function getLatestAum(record) {
  const history = record.aum_history || [];
  if (!history.length) return 0;
  const latest = [...history].sort(
    (a, b) => (b.month_end_date || "").localeCompare(a.month_end_date || "")
  )[0];
  return Number(latest?.firm_aum) || 0;
}

function getFirmTypes(f) {
  return f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
}

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const [dataScope, setDataScope] = useState("my");
  const linkedFirmId = user?.data?.linked_firm_id;

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });

  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery({
    queryKey: ["portfolios"],
    queryFn: () => base44.entities.Portfolio.list("-created_date"),
  });

  const scopedFirms = useMemo(() => {
    const active = firms.filter((f) => !f.deleted_at);
    if (dataScope === "all" || !linkedFirmId) return active;
    return active.filter((f) => f.tenant_id === linkedFirmId);
  }, [firms, dataScope, linkedFirmId]);

  const scopedProducts = useMemo(() => {
    const active = products.filter((p) => !p.deleted_at);
    if (dataScope === "all" || !linkedFirmId) return active;
    return active.filter((p) => p.tenant_id === linkedFirmId);
  }, [products, dataScope, linkedFirmId]);

  const scopedPortfolios = useMemo(() => {
    if (dataScope === "all" || !linkedFirmId) return portfolios;
    return portfolios.filter((p) => p.firm_id === linkedFirmId || p.advisor_firm_id === linkedFirmId);
  }, [portfolios, dataScope, linkedFirmId]);

  // ── Total Exposure = sum of latest firm AUM ──
  const totalExposure = useMemo(
    () => scopedFirms.reduce((sum, f) => sum + getLatestAum(f), 0),
    [scopedFirms]
  );

  // ── Exposure by Firm Type ──
  const exposureByFirmType = useMemo(() => {
    const map = {};
    for (const f of scopedFirms) {
      const aum = getLatestAum(f);
      if (!aum) continue;
      const types = getFirmTypes(f);
      const typeList = types.length ? types : ["Uncategorized"];
      for (const t of typeList) {
        map[t] = (map[t] || 0) + aum;
      }
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [scopedFirms]);

  // ── Exposure by Geographic Region ──
  const exposureByRegion = useMemo(() => {
    const map = {};
    for (const f of scopedFirms) {
      const aum = getLatestAum(f);
      if (!aum) continue;
      const region = f.geographic_region || "Undefined";
      map[region] = (map[region] || 0) + aum;
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [scopedFirms]);

  // ── Exposure by Funding Status ──
  const exposureByFunding = useMemo(() => {
    const map = { Funded: 0, Terminated: 0, Unset: 0 };
    for (const f of scopedFirms) {
      const aum = getLatestAum(f);
      if (!aum) continue;
      const status = f.funding_status || "Unset";
      map[status] = (map[status] || 0) + aum;
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [scopedFirms]);

  // ── Product AUM by Asset Class ──
  const productByAssetClass = useMemo(() => {
    const map = {};
    for (const p of scopedProducts) {
      const aum = getLatestAum(p);
      const key = p.asset_class || "Unclassified";
      map[key] = (map[key] || 0) + (aum || 0);
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [scopedProducts]);

  // ── Product AUM by Product Type ──
  const productByType = useMemo(() => {
    const map = {};
    for (const p of scopedProducts) {
      const aum = getLatestAum(p);
      const key = p.product_type || "Unclassified";
      map[key] = (map[key] || 0) + (aum || 0);
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [scopedProducts]);

  // ── Product count by Status ──
  const productByStatus = useMemo(() => {
    const map = {};
    for (const p of scopedProducts) {
      const key = p.product_status || "Not Reviewed";
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [scopedProducts]);

  // ── Portfolio committed capital by advisor firm type ──
  const portfolioCapitalByType = useMemo(() => {
    const firmMap = new Map(scopedFirms.map((f) => [f.id, f]));
    const map = {};
    for (const p of scopedPortfolios) {
      const amount = Number(p.initial_allocation_amount) || 0;
      if (!amount) continue;
      const advisorFirm = firmMap.get(p.advisor_firm_id);
      const types = advisorFirm ? getFirmTypes(advisorFirm) : [];
      const typeList = types.length ? types : ["Uncategorized"];
      for (const t of typeList) {
        map[t] = (map[t] || 0) + amount;
      }
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [scopedPortfolios, scopedFirms]);

  const totalPortfolioCapital = useMemo(
    () => scopedPortfolios.reduce((sum, p) => sum + (Number(p.initial_allocation_amount) || 0), 0),
    [scopedPortfolios]
  );

  // ── Firm-type summary table ──
  const firmTypeSummary = useMemo(() => {
    const map = {};
    for (const f of scopedFirms) {
      const aum = getLatestAum(f);
      const types = getFirmTypes(f);
      const typeList = types.length ? types : ["Uncategorized"];
      for (const t of typeList) {
        if (!map[t]) map[t] = { firms: 0, exposure: 0 };
        map[t].firms += 1;
        map[t].exposure += aum;
      }
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.exposure - a.exposure);
  }, [scopedFirms]);

  const totalFirms = scopedFirms.length;
  const totalProducts = scopedProducts.length;
  const totalPortfolios = scopedPortfolios.length;
  const loading = firmsLoading || productsLoading || portfoliosLoading;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-5 w-px bg-white/30" />
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-indigo-300" />
              <h1 className="text-lg font-bold tracking-tight">Executive Dashboard</h1>
            </div>
          </div>
          <div className="inline-flex rounded-lg border border-white/20 bg-white/10 p-0.5">
            <button
              onClick={() => setDataScope("my")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dataScope === "my" ? "bg-white text-slate-800" : "text-white/70 hover:text-white"
              }`}
            >
              My Firm
            </button>
            <button
              onClick={() => setDataScope("all")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dataScope === "all" ? "bg-white text-slate-800" : "text-white/70 hover:text-white"
              }`}
            >
              All Data
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top-line KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Exposure"
            value={formatCompactCurrency(totalExposure)}
            subtext="Latest firm AUM"
            icon={DollarSign}
            color="from-indigo-500 to-indigo-600"
            loading={firmsLoading}
          />
          <KpiCard
            label="Total Firms"
            value={totalFirms}
            subtext="Active firms tracked"
            icon={Building2}
            color="from-violet-500 to-violet-600"
            loading={firmsLoading}
          />
          <KpiCard
            label="Total Products"
            value={totalProducts}
            subtext="Investment products"
            icon={Package}
            color="from-emerald-500 to-emerald-600"
            loading={productsLoading}
          />
          <KpiCard
            label="Committed Capital"
            value={formatCompactCurrency(totalPortfolioCapital)}
            subtext="Across portfolios"
            icon={Wallet}
            color="from-amber-500 to-amber-600"
            loading={portfoliosLoading}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : totalExposure === 0 && totalPortfolioCapital === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <LayoutDashboard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No exposure data available yet.</p>
            <p className="text-xs text-gray-400 mt-1">Add AUM history to your firms and products to see exposure summaries here.</p>
          </div>
        ) : (
          <>
            {/* Charts row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Exposure by Firm Type — Donut */}
              <ChartCard
                title="Exposure by Firm Type"
                subtitle="Latest AUM distribution"
                icon={PieIcon}
                iconColor="text-indigo-600"
              >
                {exposureByFirmType.length === 0 ? (
                  <EmptyChart label="No firm AUM data" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={exposureByFirmType}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={2}
                      >
                        {exposureByFirmType.map((_, idx) => (
                          <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => formatCompactCurrency(v)}
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
              </ChartCard>

              {/* Exposure by Geographic Region — Horizontal Bar */}
              <ChartCard
                title="Exposure by Geographic Region"
                subtitle="AUM by region"
                icon={Globe}
                iconColor="text-emerald-600"
              >
                {exposureByRegion.length === 0 ? (
                  <EmptyChart label="No region data" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={exposureByRegion}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatCompactCurrency(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        width={120}
                      />
                      <Tooltip
                        formatter={(v) => formatCompactCurrency(v)}
                        cursor={{ fill: "#f9fafb" }}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                        {exposureByRegion.map((_, idx) => (
                          <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Charts row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product AUM by Asset Class */}
              <ChartCard
                title="Product AUM by Asset Class"
                subtitle="Latest product AUM"
                icon={Layers}
                iconColor="text-violet-600"
              >
                {productByAssetClass.length === 0 ? (
                  <EmptyChart label="No product AUM data" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={productByAssetClass} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        angle={-15}
                        textAnchor="end"
                        height={60}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatCompactCurrency(v)}
                      />
                      <Tooltip
                        formatter={(v) => formatCompactCurrency(v)}
                        cursor={{ fill: "#f9fafb" }}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40} fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Exposure by Funding Status — Donut */}
              <ChartCard
                title="Exposure by Funding Status"
                subtitle="Firm AUM by funding state"
                icon={TrendingUp}
                iconColor="text-amber-600"
              >
                {exposureByFunding.length === 0 ? (
                  <EmptyChart label="No funding data" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={exposureByFunding}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={2}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                        <Cell fill="#94a3b8" />
                      </Pie>
                      <Tooltip
                        formatter={(v) => formatCompactCurrency(v)}
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
              </ChartCard>
            </div>

            {/* Charts row 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Committed Capital by Advisor Firm Type */}
              <ChartCard
                title="Committed Capital by Advisor Type"
                subtitle="Portfolio allocations to IM firms"
                icon={Wallet}
                iconColor="text-indigo-600"
              >
                {portfolioCapitalByType.length === 0 ? (
                  <EmptyChart label="No portfolio allocation data" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={portfolioCapitalByType}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatCompactCurrency(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        width={140}
                      />
                      <Tooltip
                        formatter={(v) => formatCompactCurrency(v)}
                        cursor={{ fill: "#f9fafb" }}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28} fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Product count by Status */}
              <ChartCard
                title="Products by Review Status"
                subtitle="Product pipeline distribution"
                icon={BarChart3}
                iconColor="text-cyan-600"
              >
                {productByStatus.length === 0 ? (
                  <EmptyChart label="No product data" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={productByStatus} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        angle={-15}
                        textAnchor="end"
                        height={60}
                        interval={0}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "#f9fafb" }}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40} fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Interactive funding breakdown — market value + funding counts */}
            <FundingBreakdownCharts firms={scopedFirms} />

            {/* Exposure Heatmap */}
            <ExposureHeatmap firms={scopedFirms} />

            {/* Firm Type Summary Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-sm font-semibold text-gray-800">Exposure Summary by Firm Type</h2>
              </div>
              {firmTypeSummary.length === 0 ? (
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
                      {firmTypeSummary.map((row, idx) => {
                        const pct = totalExposure > 0 ? (row.exposure / totalExposure) * 100 : 0;
                        return (
                          <tr key={row.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                            <td className="py-2.5 px-5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: TYPE_COLORS[FIRM_TYPES.indexOf(row.name) >= 0 ? FIRM_TYPES.indexOf(row.name) : idx % TYPE_COLORS.length] }}
                                />
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
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: TYPE_COLORS[FIRM_TYPES.indexOf(row.name) >= 0 ? FIRM_TYPES.indexOf(row.name) : idx % TYPE_COLORS.length],
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                        <td className="py-2.5 px-5 text-gray-800">Total</td>
                        <td className="text-right py-2.5 px-3 text-gray-700">{totalFirms}</td>
                        <td className="text-right py-2.5 px-3 text-gray-900 whitespace-nowrap">
                          {formatCompactCurrency(totalExposure)}
                        </td>
                        <td className="text-right py-2.5 px-5 text-gray-500">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, subtext, icon: Icon, color, loading }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 overflow-hidden relative">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          {loading ? (
            <div className="w-16 h-7 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
          )}
          <p className="text-xs font-medium text-gray-700 mt-2">{label}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{subtext}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, iconColor, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
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

function EmptyChart({ label }) {
  return (
    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">{label}</div>
  );
}