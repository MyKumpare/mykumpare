import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import {
  Building, DollarSign, Package, Users, Award, ArrowLeft,
  TrendingUp, FileBarChart, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import FirmPerformanceTable from "@/components/reports/FirmPerformanceTable";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];
const TYPE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];

const PRODUCT_STATUS_COLORS = {
  "Not Reviewed": "#94a3b8",
  "In-Process": "#6366f1",
  "On-Hold": "#f59e0b",
  "Rejected": "#ef4444",
  "Approved": "#10b981",
  "Removed": "#6b7280",
};

const FUNDING_COLORS = { Funded: "#10b981", Terminated: "#ef4444" };

const formatCurrency = (v) => {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
};

const getLatestAum = (firm) => {
  if (!firm.aum_history?.length) return null;
  const sorted = [...firm.aum_history].sort(
    (a, b) => new Date(b.month_end_date) - new Date(a.month_end_date)
  );
  return sorted[0]?.firm_aum ?? null;
};

const getFirmTypes = (f) =>
  f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];

export default function FirmSummaryReport() {
  const { user } = useAuth();
  const [dataScope, setDataScope] = useState("my");
  const linkedFirmId = user?.data?.linked_firm_id;

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 5000),
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts_summary"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { data: scores = [], isLoading: scoresLoading } = useQuery({
    queryKey: ["scoring_scores_summary"],
    queryFn: () => base44.entities.ScoringMatrixScore.list("-created_date", 5000),
  });

  const scopedFirms = useMemo(() => {
    const active = firms.filter((f) => !f.deleted_at);
    if (dataScope === "all" || !linkedFirmId) return active;
    return active.filter((f) => f.tenant_id === linkedFirmId);
  }, [firms, dataScope, linkedFirmId]);

  const scopedFirmIds = useMemo(
    () => new Set(scopedFirms.map((f) => f.id)),
    [scopedFirms]
  );

  // KPI: Total AUM (sum of latest AUM per firm)
  const totalAum = useMemo(
    () => scopedFirms.reduce((sum, f) => sum + (getLatestAum(f) || 0), 0),
    [scopedFirms]
  );

  // Products scoped to these firms
  const scopedProducts = useMemo(
    () => products.filter((p) => !p.deleted_at && scopedFirmIds.has(p.firm_id)),
    [products, scopedFirmIds]
  );

  // Contacts scoped to these firms
  const scopedContacts = useMemo(
    () => contacts.filter((c) => !c.deleted_at && (c.firm_ids || []).some((fid) => scopedFirmIds.has(fid))),
    [contacts, scopedFirmIds]
  );

  // Finalized scores scoped to these firms
  const scopedScores = useMemo(
    () => scores.filter((s) => s.final_score_finalized && scopedFirmIds.has(s.firm_id)),
    [scores, scopedFirmIds]
  );

  // AUM by firm type
  const aumByType = useMemo(() => {
    const sums = {};
    for (const f of scopedFirms) {
      const aum = getLatestAum(f) || 0;
      const types = getFirmTypes(f);
      if (types.length === 0) {
        sums["Uncategorized"] = (sums["Uncategorized"] || 0) + aum;
      } else {
        for (const t of types) sums[t] = (sums[t] || 0) + aum;
      }
    }
    return Object.entries(sums)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [scopedFirms]);

  // Top 10 firms by AUM
  const topFirmsByAum = useMemo(() => {
    return scopedFirms
      .map((f) => ({ name: f.name, aum: getLatestAum(f) || 0 }))
      .filter((f) => f.aum > 0)
      .sort((a, b) => b.aum - a.aum)
      .slice(0, 10)
      .reverse();
  }, [scopedFirms]);

  // Product status distribution
  const productStatusData = useMemo(() => {
    const counts = {};
    for (const p of scopedProducts) {
      const s = p.product_status || "Not Reviewed";
      counts[s] = (counts[s] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [scopedProducts]);

  // Funding status distribution
  const fundingStatusData = useMemo(() => {
    const counts = {};
    for (const p of scopedProducts) {
      if (p.funding_status) {
        counts[p.funding_status] = (counts[p.funding_status] || 0) + 1;
      }
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [scopedProducts]);

  // Score rating distribution
  const scoreRatingData = useMemo(() => {
    const counts = {};
    for (const s of scopedScores) {
      const r = s.overall_rating || "Unrated";
      counts[r] = (counts[r] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [scopedScores]);

  // Per-firm metrics for the table
  const firmMetrics = useMemo(() => {
    const productCounts = {};
    for (const p of scopedProducts) {
      productCounts[p.firm_id] = (productCounts[p.firm_id] || 0) + 1;
    }
    const contactCounts = {};
    for (const c of scopedContacts) {
      for (const fid of c.firm_ids || []) {
        if (scopedFirmIds.has(fid)) contactCounts[fid] = (contactCounts[fid] || 0) + 1;
      }
    }
    const firmScores = {};
    for (const s of scopedScores) {
      const existing = firmScores[s.firm_id];
      if (!existing || new Date(s.scoring_end_date || s.updated_date) > new Date(existing.scoring_end_date || existing.updated_date)) {
        firmScores[s.firm_id] = s;
      }
    }
    const firmFunding = {};
    for (const p of scopedProducts) {
      if (p.funding_status) {
        firmFunding[p.firm_id] = p.funding_status;
      }
    }
    return scopedFirms.map((f) => ({
      id: f.id,
      name: f.name,
      types: getFirmTypes(f),
      aum: getLatestAum(f),
      productCount: productCounts[f.id] || 0,
      contactCount: contactCounts[f.id] || 0,
      score: firmScores[f.id]?.overall_rating || "",
      passFail: firmScores[f.id]?.overall_pass_fail || "",
      fundingStatus: firmFunding[f.id] || "",
    }));
  }, [scopedFirms, scopedProducts, scopedContacts, scopedScores, scopedFirmIds]);

  const loading = firmsLoading || productsLoading || contactsLoading;
  const firmsWithScores = scopedScores.length;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-5 w-px bg-white/30" />
            <h1 className="text-lg font-bold tracking-tight">Firm Summary Report</h1>
          </div>
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
                dataScope === "my" ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              My Data
            </button>
            <button
              onClick={() => setDataScope("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dataScope === "all" ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              All Data
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="Total Firms" value={scopedFirms.length} icon={Building} color="bg-teal-500" loading={loading} />
          <KpiCard label="Total AUM" value={formatCurrency(totalAum)} icon={DollarSign} color="bg-emerald-500" loading={loading} />
          <KpiCard label="Total Products" value={scopedProducts.length} icon={Package} color="bg-indigo-500" loading={loading} />
          <KpiCard label="Total Contacts" value={scopedContacts.length} icon={Users} color="bg-violet-500" loading={loading} />
          <KpiCard label="Firms with Scores" value={firmsWithScores} icon={Award} color="bg-amber-500" loading={scoresLoading} />
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            {/* AUM charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="AUM by Firm Type" icon={Building}>
                {aumByType.length === 0 ? (
                  <EmptyState message="No AUM data available" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={aumByType} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" height={60} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                      <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} formatter={(v) => formatCurrency(v)} />
                      <Bar dataKey="value" name="AUM" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {aumByType.map((_, idx) => (
                          <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Top 10 Firms by AUM" icon={TrendingUp}>
                {topFirmsByAum.length === 0 ? (
                  <EmptyState message="No AUM data available" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topFirmsByAum} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={120} tickFormatter={(v) => v.length > 18 ? v.substring(0, 16) + "…" : v} />
                      <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} formatter={(v) => formatCurrency(v)} />
                      <Bar dataKey="aum" name="AUM" fill="#14b8a6" radius={[0, 6, 6, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Product & Funding charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Product Status Distribution" icon={Package}>
                {productStatusData.length === 0 ? (
                  <EmptyState message="No product data available" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={productStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
                        {productStatusData.map((entry, idx) => (
                          <Cell key={idx} fill={PRODUCT_STATUS_COLORS[entry.name] || "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                      <Legend layout="horizontal" align="center" verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Funding Status" icon={DollarSign}>
                {fundingStatusData.length === 0 ? (
                  <EmptyState message="No funding data available" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={fundingStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
                        {fundingStatusData.map((entry, idx) => (
                          <Cell key={idx} fill={FUNDING_COLORS[entry.name] || "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                      <Legend layout="horizontal" align="center" verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Score rating distribution */}
            <ChartCard title="Score Rating Distribution" icon={Award}>
              {scoreRatingData.length === 0 ? (
                <EmptyState message="No finalized scores yet — finalize scoring matrices to see rating distribution" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={scoreRatingData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                    <Bar dataKey="value" name="Firms" radius={[6, 6, 0, 0]} maxBarSize={56}>
                      {scoreRatingData.map((_, idx) => (
                        <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Firm performance table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileBarChart className="w-5 h-5 text-teal-600" />
                <h2 className="text-sm font-semibold text-gray-800">Firm Performance Summary</h2>
                <span className="text-xs text-gray-400">({firmMetrics.length} firms)</span>
              </div>
              <FirmPerformanceTable firms={firmMetrics} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, loading }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="w-16 h-6 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="text-xl font-bold text-gray-900 leading-none truncate">{value}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-teal-600" />
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="h-64 flex items-center justify-center text-gray-400 text-sm text-center px-4">
      {message}
    </div>
  );
}