import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Globe, ShieldCheck, Building2, MapPin, Loader2, Landmark,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useAuth } from "@/lib/AuthContext";

const REGION_ORDER = [
  "North America",
  "Europe",
  "Asia-Pacific",
  "Latin America",
  "Middle East & Africa",
  "Global",
  "Undefined",
];

const REGION_COLORS = {
  "North America": "#3b82f6",
  "Europe": "#8b5cf6",
  "Asia-Pacific": "#ec4899",
  "Latin America": "#f59e0b",
  "Middle East & Africa": "#10b981",
  "Global": "#6366f1",
  "Undefined": "#9ca3af",
};

const STATUS_COLORS = {
  Registered: "#10b981",
  "Auto-verified": "#3b82f6",
  Unregistered: "#f59e0b",
};

function getFirmTypes(f) {
  return f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
}

// Derive a firm's primary country from its addresses or location field.
function firmCountry(f) {
  const hq = (f.addresses || []).find((a) => a.is_headquarters) || (f.addresses || [])[0];
  if (hq?.country) return hq.country;
  if (f.location) {
    const parts = f.location.split(",").map((p) => p.trim());
    return parts[parts.length - 1] || "";
  }
  return "";
}

export default function FirmGeographicDashboard() {
  const { user } = useAuth();
  const [dataScope, setDataScope] = useState("my");
  const linkedFirmId = user?.data?.linked_firm_id;

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });

  const scopedFirms = useMemo(() => {
    const active = firms.filter((f) => !f.deleted_at);
    if (dataScope === "all" || !linkedFirmId) return active;
    return active.filter((f) => f.tenant_id === linkedFirmId);
  }, [firms, dataScope, linkedFirmId]);

  // Firms by geographic region
  const byRegion = useMemo(() => {
    const map = {};
    for (const f of scopedFirms) {
      const region = f.geographic_region || "Undefined";
      map[region] = (map[region] || 0) + 1;
    }
    return REGION_ORDER.filter((r) => map[r]).map((r) => ({ name: r, value: map[r] }));
  }, [scopedFirms]);

  // Registration status breakdown
  const byStatus = useMemo(() => {
    const map = { Registered: 0, "Auto-verified": 0, Unregistered: 0 };
    for (const f of scopedFirms) {
      if (f.registration_number) {
        if (f.registration_source_url) map["Auto-verified"] += 1;
        else map["Registered"] += 1;
      } else {
        map["Unregistered"] += 1;
      }
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [scopedFirms]);

  // Region × registration status (stacked bar)
  const regionByStatus = useMemo(() => {
    const map = {};
    for (const f of scopedFirms) {
      const region = f.geographic_region || "Undefined";
      if (!map[region]) map[region] = { region, Registered: 0, "Auto-verified": 0, Unregistered: 0 };
      if (f.registration_number) {
        if (f.registration_source_url) map[region]["Auto-verified"] += 1;
        else map[region].Registered += 1;
      } else {
        map[region].Unregistered += 1;
      }
    }
    return REGION_ORDER.filter((r) => map[r]).map((r) => map[r]);
  }, [scopedFirms]);

  // Top countries
  const byCountry = useMemo(() => {
    const map = {};
    for (const f of scopedFirms) {
      const country = firmCountry(f);
      if (!country) continue;
      map[country] = (map[country] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [scopedFirms]);

  // Firms by type
  const byType = useMemo(() => {
    const map = {};
    for (const f of scopedFirms) {
      const types = getFirmTypes(f);
      const list = types.length ? types : ["Uncategorized"];
      for (const t of list) map[t] = (map[t] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [scopedFirms]);

  const totalFirms = scopedFirms.length;
  const registeredCount = scopedFirms.filter((f) => f.registration_number).length;
  const registeredPct = totalFirms ? Math.round((registeredCount / totalFirms) * 100) : 0;
  const regionsCovered = byRegion.filter((r) => r.name !== "Undefined").length;
  const countriesCovered = new Set(scopedFirms.map(firmCountry).filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-5 w-px bg-white/30" />
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-200" />
              <h1 className="text-lg font-bold tracking-tight">Geographic & Regulatory Dashboard</h1>
            </div>
          </div>
          <div className="inline-flex rounded-lg border border-white/20 bg-white/10 p-0.5">
            <button
              onClick={() => setDataScope("my")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dataScope === "my" ? "bg-white text-indigo-700" : "text-white/70 hover:text-white"
              }`}
            >
              My Firm
            </button>
            <button
              onClick={() => setDataScope("all")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dataScope === "all" ? "bg-white text-indigo-700" : "text-white/70 hover:text-white"
              }`}
            >
              All Data
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : totalFirms === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            No firms found for the selected scope.
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Firms" value={totalFirms} subtext="Active firms tracked" icon={Building2} color="from-indigo-500 to-indigo-600" />
              <KpiCard label="Regions Covered" value={regionsCovered} subtext="Distinct regions" icon={Globe} color="from-violet-500 to-violet-600" />
              <KpiCard label="Countries" value={countriesCovered} subtext="Distinct countries" icon={MapPin} color="from-emerald-500 to-emerald-600" />
              <KpiCard label="Registered" value={`${registeredPct}%`} subtext={`${registeredCount} of ${totalFirms} firms`} icon={ShieldCheck} color="from-amber-500 to-amber-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Firms by Geographic Region — donut */}
              <ChartCard title="Firms by Geographic Region" icon={Globe}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={byRegion}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {byRegion.map((entry) => (
                        <Cell key={entry.name} fill={REGION_COLORS[entry.name] || "#9ca3af"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Registration Status — pie */}
              <ChartCard title="Regulatory Registration Status" icon={ShieldCheck}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={byStatus}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {byStatus.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#9ca3af"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Region × Registration Status — stacked bar */}
              <ChartCard title="Registration Status by Region" icon={Landmark} full>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={regionByStatus} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="region" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Registered" stackId="a" fill={STATUS_COLORS.Registered} />
                    <Bar dataKey="Auto-verified" stackId="a" fill={STATUS_COLORS["Auto-verified"]} />
                    <Bar dataKey="Unregistered" stackId="a" fill={STATUS_COLORS.Unregistered} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Top Countries — horizontal bar */}
              <ChartCard title="Top Countries" icon={MapPin}>
                {byCountry.length === 0 ? (
                  <EmptyChart label="No country data available" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={byCountry} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip />
                      <Bar dataKey="value" name="Firms" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Firms by Type */}
              <ChartCard title="Firms by Type" icon={Building2}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byType} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Firms" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, subtext, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 overflow-hidden relative">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
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

function ChartCard({ title, icon: Icon, children, full }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${full ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ label }) {
  return (
    <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">{label}</div>
  );
}