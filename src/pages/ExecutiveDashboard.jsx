import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  ArrowLeft, LayoutDashboard, DollarSign, Building2, Package, Wallet, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import ExecDashboardLayout from "@/components/executive/ExecDashboardLayout";
import { formatCompactCurrency } from "@/components/executive/execDashboardModules";

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

  const { data: ddRecords = [] } = useQuery({
    queryKey: ["dd-records-exec"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 500),
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

        <ExecDashboardLayout
          data={{
            scopedFirms, scopedProducts, scopedPortfolios,
            exposureByFirmType, exposureByRegion, exposureByFunding,
            productByAssetClass, productByStatus,
            portfolioCapitalByType, firmTypeSummary,
            totalExposure, totalFirms, totalProducts,
            ddRecords,
          }}
          loading={loading}
          hasData={totalExposure > 0 || totalPortfolioCapital > 0}
        />
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