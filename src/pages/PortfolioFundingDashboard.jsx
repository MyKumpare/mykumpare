import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Briefcase, ArrowLeft, TrendingUp, TrendingDown, Wallet,
  PieChart as PieIcon, Building2, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import FundingStatusBadge from "@/components/products/FundingStatusBadge";

const FUNDING_COLORS = {
  Funded: "#10b981",
  Terminated: "#ef4444",
  "Not Funded": "#94a3b8",
};

const PORTFOLIO_COLORS = {
  Active: "#10b981",
  Terminated: "#ef4444",
};

export default function PortfolioFundingDashboard() {
  const { user } = useAuth();
  const [dataScope, setDataScope] = useState("my"); // "my" | "all"
  const linkedFirmId = user?.data?.linked_firm_id;

  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery({
    queryKey: ["portfolios_funding_dashboard"],
    queryFn: () => base44.entities.Portfolio.list("-created_date", 5000),
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products_funding_dashboard"],
    queryFn: () => base44.entities.Product.list("-created_date", 5000),
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms_funding_dashboard"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });

  const firmNameMap = useMemo(() => {
    const map = new Map();
    for (const f of firms) map.set(f.id, f.name);
    return map;
  }, [firms]);

  const scopedPortfolios = useMemo(() => {
    const active = portfolios.filter((p) => !p.deleted_at);
    if (dataScope === "all" || !linkedFirmId) return active;
    return active.filter((p) => p.tenant_id === linkedFirmId);
  }, [portfolios, dataScope, linkedFirmId]);

  const scopedProducts = useMemo(() => {
    const active = products.filter((p) => !p.deleted_at);
    if (dataScope === "all" || !linkedFirmId) return active;
    return active.filter((p) => p.tenant_id === linkedFirmId);
  }, [products, dataScope, linkedFirmId]);

  // Portfolio summary
  const totalActivePortfolios = scopedPortfolios.filter((p) => p.funding_status === "Active").length;
  const totalTerminatedPortfolios = scopedPortfolios.filter((p) => p.funding_status === "Terminated").length;
  const totalPortfolios = scopedPortfolios.length;

  // Product funding status breakdown
  const productFundingData = useMemo(() => {
    const counts = { Funded: 0, Terminated: 0, "Not Funded": 0 };
    for (const p of scopedProducts) {
      if (p.funding_status === "Funded") counts.Funded += 1;
      else if (p.funding_status === "Terminated") counts.Terminated += 1;
      else counts["Not Funded"] += 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [scopedProducts]);

  const totalProducts = scopedProducts.length;
  const fundedProducts = productFundingData.find((d) => d.name === "Funded")?.value || 0;
  const terminatedProducts = productFundingData.find((d) => d.name === "Terminated")?.value || 0;

  // Active portfolios by allocator firm
  const activeByFirm = useMemo(() => {
    const counts = {};
    for (const p of scopedPortfolios) {
      if (p.funding_status !== "Active") continue;
      const name = p.allocator_name || firmNameMap.get(p.firm_id) || "Unknown Firm";
      counts[name] = (counts[name] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [scopedPortfolios, firmNameMap]);

  // Funded products by firm
  const fundedProductsByFirm = useMemo(() => {
    const counts = {};
    for (const p of scopedProducts) {
      if (p.funding_status !== "Funded") continue;
      const name = p.firm_name || "Unknown Firm";
      counts[name] = (counts[name] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [scopedProducts]);

  // Map each firm to its primary type for grouping
  const firmTypeMap = useMemo(() => {
    const map = new Map();
    for (const f of firms) {
      const type = f.firm_type || (f.firm_types && f.firm_types[0]) || "Unknown";
      map.set(f.id, type);
    }
    return map;
  }, [firms]);

  // Total active capital allocation grouped by allocator firm type
  const fundingByFirmType = useMemo(() => {
    const totals = {};
    for (const p of scopedPortfolios) {
      if (p.funding_status !== "Active") continue;
      const type = firmTypeMap.get(p.firm_id) || "Unknown";
      const amt = Number(p.initial_allocation_amount) || 0;
      totals[type] = (totals[type] || 0) + amt;
    }
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [scopedPortfolios, firmTypeMap]);

  const totalActiveAllocation = useMemo(
    () => fundingByFirmType.reduce((sum, d) => sum + d.value, 0),
    [fundingByFirmType]
  );

  // Summary table: total funding amounts compared across all tracked investment firms.
  // Aggregates active portfolio allocations per firm, with funded/terminated product counts.
  const firmFundingComparison = useMemo(() => {
    const map = new Map();
    // Seed from firms so every tracked firm appears even with zero allocation
    for (const f of firms) {
      if (f.deleted_at) continue;
      map.set(f.id, {
        firmId: f.id,
        firmName: f.name,
        firmType: f.firm_type || (f.firm_types && f.firm_types[0]) || "Unknown",
        activeAllocation: 0,
        terminatedAllocation: 0,
        activePortfolios: 0,
        terminatedPortfolios: 0,
        fundedProducts: 0,
        terminatedProducts: 0,
      });
    }
    // Accumulate portfolio allocations
    for (const p of scopedPortfolios) {
      const entry = map.get(p.firm_id) || {
        firmId: p.firm_id,
        firmName: p.allocator_name || firmNameMap.get(p.firm_id) || "Unknown Firm",
        firmType: firmTypeMap.get(p.firm_id) || "Unknown",
        activeAllocation: 0, terminatedAllocation: 0,
        activePortfolios: 0, terminatedPortfolios: 0,
        fundedProducts: 0, terminatedProducts: 0,
      };
      const amt = Number(p.initial_allocation_amount) || 0;
      if (p.funding_status === "Active") {
        entry.activeAllocation += amt;
        entry.activePortfolios += 1;
      } else if (p.funding_status === "Terminated") {
        entry.terminatedAllocation += amt;
        entry.terminatedPortfolios += 1;
      }
      map.set(p.firm_id, entry);
    }
    // Accumulate product funding counts
    for (const prod of scopedProducts) {
      const entry = map.get(prod.firm_id);
      if (!entry) continue;
      if (prod.funding_status === "Funded") entry.fundedProducts += 1;
      else if (prod.funding_status === "Terminated") entry.terminatedProducts += 1;
    }
    return Array.from(map.values())
      .filter((e) => e.activeAllocation > 0 || e.terminatedAllocation > 0 || e.fundedProducts > 0)
      .sort((a, b) => (b.activeAllocation + b.terminatedAllocation) - (a.activeAllocation + a.terminatedAllocation));
  }, [firms, scopedPortfolios, scopedProducts, firmNameMap, firmTypeMap]);

  const comparisonTotalActive = firmFundingComparison.reduce((s, e) => s + e.activeAllocation, 0);
  const comparisonTotalTerminated = firmFundingComparison.reduce((s, e) => s + e.terminatedAllocation, 0);
  const comparisonGrandTotal = comparisonTotalActive + comparisonTotalTerminated;

  const loading = portfoliosLoading || productsLoading;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-5 w-px bg-white/30" />
            <h1 className="text-lg font-bold tracking-tight">Portfolio & Funding Dashboard</h1>
          </div>
          {user?.full_name && <span className="text-xs text-white/70 hidden sm:block">{user.full_name}</span>}
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
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dataScope === "my" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              My Data
            </button>
            <button
              onClick={() => setDataScope("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dataScope === "all" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              All Data
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Active Portfolios" value={totalActivePortfolios} icon={Briefcase} color="bg-emerald-500" loading={loading} />
          <SummaryCard label="Terminated Portfolios" value={totalTerminatedPortfolios} icon={TrendingDown} color="bg-red-500" loading={loading} />
          <SummaryCard label="Funded Products" value={fundedProducts} icon={TrendingUp} color="bg-indigo-500" loading={loading} />
          <SummaryCard label="Terminated Products" value={terminatedProducts} icon={TrendingDown} color="bg-amber-500" loading={loading} />
        </div>

        {/* Capital allocation by firm type */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-800">Capital Allocation by Firm Type</h2>
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : fundingByFirmType.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No active funding data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(220, fundingByFirmType.length * 46)}>
                <BarChart data={fundingByFirmType} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={150} />
                  <Tooltip
                    cursor={{ fill: "#f9fafb" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                    formatter={(v) => [formatCurrency(v), "Capital Allocation"]}
                  />
                  <Bar dataKey="value" name="Capital Allocation" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-indigo-50/60 px-3 py-2">
                <span className="text-xs font-medium text-gray-600">Total Active Capital Allocation</span>
                <span className="text-base font-bold text-indigo-700">{formatCurrency(totalActiveAllocation)}</span>
              </div>
            </>
          )}
        </div>

        {/* Firm Funding Comparison Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-800">Firm Funding Comparison</h2>
            <span className="ml-auto text-xs text-gray-400">{firmFundingComparison.length} firm{firmFundingComparison.length !== 1 ? "s" : ""}</span>
          </div>
          {loading ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : firmFundingComparison.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No funding data available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="text-left font-semibold text-gray-600 px-4 py-2.5 whitespace-nowrap">Investment Firm</th>
                    <th className="text-left font-semibold text-gray-600 px-3 py-2.5 whitespace-nowrap">Type</th>
                    <th className="text-center font-semibold text-gray-600 px-3 py-2.5 whitespace-nowrap">Active Portfolios</th>
                    <th className="text-center font-semibold text-gray-600 px-3 py-2.5 whitespace-nowrap">Funded Products</th>
                    <th className="text-right font-semibold text-gray-600 px-3 py-2.5 whitespace-nowrap">Active Allocation</th>
                    <th className="text-right font-semibold text-gray-600 px-3 py-2.5 whitespace-nowrap">Terminated</th>
                    <th className="text-right font-semibold text-gray-600 px-4 py-2.5 whitespace-nowrap">Total Funding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {firmFundingComparison.map((row) => {
                    const rowTotal = row.activeAllocation + row.terminatedAllocation;
                    const pct = comparisonGrandTotal > 0 ? (rowTotal / comparisonGrandTotal) * 100 : 0;
                    return (
                      <tr key={row.firmId} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-800 truncate max-w-[200px]" title={row.firmName}>
                          {row.firmName}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{row.firmType}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            {row.activePortfolios}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                            {row.fundedProducts}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-emerald-700 whitespace-nowrap">
                          {formatCurrency(row.activeAllocation)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-red-600 whitespace-nowrap">
                          {row.terminatedAllocation > 0 ? formatCurrency(row.terminatedAllocation) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <div className="hidden sm:block w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(pct, 3)}%` }} />
                            </div>
                            <span className="font-bold text-gray-900">{formatCurrency(rowTotal)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50/60 border-t-2 border-indigo-100 font-semibold">
                    <td className="px-4 py-3 text-gray-800" colSpan={4}>Total Across All Firms</td>
                    <td className="px-3 py-3 text-right text-emerald-700 whitespace-nowrap">{formatCurrency(comparisonTotalActive)}</td>
                    <td className="px-3 py-3 text-right text-red-600 whitespace-nowrap">{comparisonTotalTerminated > 0 ? formatCurrency(comparisonTotalTerminated) : "—"}</td>
                    <td className="px-4 py-3 text-right text-indigo-700 whitespace-nowrap">{formatCurrency(comparisonGrandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product funding status breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-800">Product Funding Status Breakdown</h2>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
            ) : totalProducts === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No product data available</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={productFundingData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      paddingAngle={2}
                    >
                      {productFundingData.map((entry, idx) => (
                        <Cell key={idx} fill={FUNDING_COLORS[entry.name] || "#94a3b8"} />
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
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {productFundingData.map((d) => {
                    const pct = totalProducts > 0 ? Math.round((d.value / totalProducts) * 100) : 0;
                    return (
                      <div key={d.name} className="rounded-lg border border-gray-200 p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FUNDING_COLORS[d.name] }} />
                          <span className="text-[11px] font-medium text-gray-600">{d.name}</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{d.value}</span>
                        <span className="text-[11px] text-gray-400 ml-1">({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Active portfolios by allocator firm */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-semibold text-gray-800">Active Portfolios by Allocator Firm</h2>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
            ) : activeByFirm.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No active portfolios</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activeByFirm} layout="vertical" margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip
                    cursor={{ fill: "#f9fafb" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Bar dataKey="count" name="Active Portfolios" fill="#10b981" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Funded products by firm */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-800">Funded Products by Firm</h2>
          </div>
          {loading ? (
            <div className="h-24 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : fundedProductsByFirm.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-gray-400 text-sm">No funded products</div>
          ) : (
            <div className="space-y-2.5">
              {fundedProductsByFirm.map((entry) => {
                const pct = fundedProducts > 0 ? Math.round((entry.count / fundedProducts) * 100) : 0;
                return (
                  <div key={entry.name} className="flex items-center gap-3">
                    <div className="w-40 sm:w-56 flex-shrink-0 truncate text-xs font-medium text-gray-700" title={entry.name}>
                      {entry.name}
                    </div>
                    <div className="flex-1 h-7 rounded-lg bg-gray-100 overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: "#6366f1" }}
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

        {/* Portfolio funding status legend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-violet-600" />
            <h2 className="text-sm font-semibold text-gray-800">Portfolio Funding Status</h2>
          </div>
          {loading ? (
            <div className="h-16 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatusTile label="Active" count={totalActivePortfolios} total={totalPortfolios} color={PORTFOLIO_COLORS.Active} />
              <StatusTile label="Terminated" count={totalTerminatedPortfolios} total={totalPortfolios} color={PORTFOLIO_COLORS.Terminated} />
              <StatusTile label="Total Portfolios" count={totalPortfolios} total={totalPortfolios} color="#6366f1" hidePct />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCurrency(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatCompactCurrency(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
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

function StatusTile({ label, count, total, color, hidePct }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium text-gray-700">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-gray-900">{count}</span>
        {!hidePct && <span className="text-xs text-gray-400">({pct}%)</span>}
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${hidePct ? 100 : pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}