import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Globe, ShieldCheck, Building2, MapPin, Loader2, Landmark,
  Search, X, Landmark as LandmarkIcon,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useAuth } from "@/lib/AuthContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

export default function FirmGeographicDashboard({ inline = false }) {
  const { user } = useAuth();
  const [dataScope, setDataScope] = useState("my");
  const [cityFilter, setCityFilter] = useState("__all__");
  const [regulatorFilter, setRegulatorFilter] = useState("__all__");
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

  // Extract unique cities from firm addresses
  const cityOptions = useMemo(() => {
    const set = new Set();
    for (const f of scopedFirms) {
      for (const a of f.addresses || []) {
        if (a.city) set.add(a.city);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedFirms]);

  // Extract unique governing regulatory bodies from legal_compliance jurisdictions
  const regulatorOptions = useMemo(() => {
    const set = new Set();
    for (const f of scopedFirms) {
      const jurisdictions = f.legal_compliance?.jurisdictions || [];
      for (const j of jurisdictions) {
        if (j.entityJurisdiction) set.add(j.entityJurisdiction);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedFirms]);

  const hasFilters = cityFilter !== "__all__" || regulatorFilter !== "__all__";

  // Firms matching the selected city and/or regulatory body filters
  const filteredFirms = useMemo(() => {
    if (!hasFilters) return [];
    return scopedFirms.filter((f) => {
      const cityMatch =
        cityFilter === "__all__" ||
        (f.addresses || []).some((a) => a.city === cityFilter);
      const regMatch =
        regulatorFilter === "__all__" ||
        (f.legal_compliance?.jurisdictions || []).some(
          (j) => j.entityJurisdiction === regulatorFilter
        );
      return cityMatch && regMatch;
    });
  }, [scopedFirms, cityFilter, regulatorFilter, hasFilters]);

  // Use filtered firms when filters are active, otherwise all scoped firms
  const displayFirms = hasFilters ? filteredFirms : scopedFirms;

  // Firms by geographic region
  const byRegion = useMemo(() => {
    const map = {};
    for (const f of displayFirms) {
      const region = f.geographic_region || "Undefined";
      map[region] = (map[region] || 0) + 1;
    }
    return REGION_ORDER.filter((r) => map[r]).map((r) => ({ name: r, value: map[r] }));
  }, [displayFirms]);

  // Registration status breakdown
  const byStatus = useMemo(() => {
    const map = { Registered: 0, "Auto-verified": 0, Unregistered: 0 };
    for (const f of displayFirms) {
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
  }, [displayFirms]);

  // Region × registration status (stacked bar)
  const regionByStatus = useMemo(() => {
    const map = {};
    for (const f of displayFirms) {
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
  }, [displayFirms]);

  // Top countries
  const byCountry = useMemo(() => {
    const map = {};
    for (const f of displayFirms) {
      const country = firmCountry(f);
      if (!country) continue;
      map[country] = (map[country] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [displayFirms]);

  // Firms by type
  const byType = useMemo(() => {
    const map = {};
    for (const f of displayFirms) {
      const types = getFirmTypes(f);
      const list = types.length ? types : ["Uncategorized"];
      for (const t of list) map[t] = (map[t] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [displayFirms]);

  const totalFirms = displayFirms.length;
  const registeredCount = displayFirms.filter((f) => f.registration_number).length;
  const registeredPct = totalFirms ? Math.round((registeredCount / totalFirms) * 100) : 0;
  const regionsCovered = byRegion.filter((r) => r.name !== "Undefined").length;
  const countriesCovered = new Set(displayFirms.map(firmCountry).filter(Boolean)).size;

  return (
    <div className={inline ? "" : "min-h-screen bg-gray-50/80"}>
      {/* Header — hidden when rendered inline inside the Monitor page */}
      {!inline && (
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
      )}

      <div className={inline ? "space-y-6" : "max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6"}>
      {inline && (
        <div className="flex items-center justify-end">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              onClick={() => setDataScope("my")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dataScope === "my" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              My Firm
            </button>
            <button
              onClick={() => setDataScope("all")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dataScope === "all" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              All Data
            </button>
          </div>
        </div>
      )}
        {/* Filter bar — search by city or governing regulatory body */}
        {!isLoading && scopedFirms.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-gray-800">Filter Firms</h3>
              {hasFilters && (
                <button
                  onClick={() => { setCityFilter("__all__"); setRegulatorFilter("__all__"); }}
                  className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> City
                </label>
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All cities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All cities</SelectItem>
                    {cityOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <LandmarkIcon className="w-3 h-3" /> Governing Regulatory Body
                </label>
                <Select value={regulatorFilter} onValueChange={setRegulatorFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All regulators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All regulators</SelectItem>
                    {regulatorOptions.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : totalFirms === 0 && !hasFilters ? (
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

            {/* Filtered firm list — shown when city/regulator filters are active */}
            {hasFilters && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-gray-800">
                    Matching Firms ({filteredFirms.length})
                  </h3>
                </div>
                {filteredFirms.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    No firms match the selected filters.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {filteredFirms.map((f) => {
                      const hq = (f.addresses || []).find((a) => a.is_headquarters) || (f.addresses || [])[0];
                      const city = hq?.city || "";
                      const state = hq?.state || "";
                      const country = hq?.country || "";
                      const regulators = (f.legal_compliance?.jurisdictions || [])
                        .map((j) => j.entityJurisdiction)
                        .filter(Boolean);
                      return (
                        <Link
                          key={f.id}
                          to={`/?openFirm=${f.id}`}
                          className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {f.logo_url ? (
                              <img src={f.logo_url} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <Building2 className="w-4 h-4 text-indigo-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              {city && (
                                <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500">
                                  <MapPin className="w-3 h-3" />{city}{state ? `, ${state}` : ""}{country ? `, ${country}` : ""}
                                </span>
                              )}
                              {regulators.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[11px] text-indigo-600">
                                  <LandmarkIcon className="w-3 h-3" />{regulators.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                          {f.registration_number && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-600 flex-shrink-0">
                              <ShieldCheck className="w-3 h-3" />Registered
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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