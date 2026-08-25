import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCoverageData, LIFECYCLE_STAGES } from "@/hooks/useCoverageData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Building2, UserCheck, Users, AlertTriangle, Filter, ClipboardList,
} from "lucide-react";

const LIFECYCLE_STYLES = {
  Pipeline: "bg-blue-50 text-blue-700 border-blue-200",
  "Under Due Diligence": "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Funded: "bg-purple-50 text-purple-700 border-purple-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500 truncate">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CoverageManagement() {
  const navigate = useNavigate();
  const { isLoading, ddRecords, firms, analysts, uncoveredFirms } = useCoverageData();
  const [firmFilter, setFirmFilter] = useState("all");
  const [primaryFilter, setPrimaryFilter] = useState("all");
  const [secondaryFilter, setSecondaryFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all"); // all | Pipeline | Under Due Diligence | Approved | Funded | Rejected

  // Options for the filter dropdowns.
  const firmOptions = useMemo(
    () => [...firms].sort((a, b) => a.name.localeCompare(b.name)),
    [firms]
  );
  const analystOptions = useMemo(
    () => [...analysts].sort((a, b) => a.name.localeCompare(b.name)),
    [analysts]
  );

  // Apply filters to the enriched DD records.
  const filteredDD = useMemo(() => {
    return ddRecords.filter((dd) => {
      if (firmFilter !== "all" && dd.firm_id !== firmFilter) return false;
      if (primaryFilter !== "all" && dd.primaryAnalyst?.id !== primaryFilter) return false;
      if (secondaryFilter !== "all" && dd.secondaryAnalyst?.id !== secondaryFilter) return false;
      if (lifecycleFilter !== "all" && dd.lifecycle !== lifecycleFilter) return false;
      return true;
    });
  }, [ddRecords, firmFilter, primaryFilter, secondaryFilter, lifecycleFilter]);

  // Coverage counts.
  const coveredFirmCount = useMemo(
    () => new Set(filteredDD.map((dd) => dd.firm_id)).size,
    [filteredDD]
  );
  const primaryAnalystCount = useMemo(
    () => new Set(filteredDD.map((dd) => dd.primaryAnalyst?.id).filter(Boolean)).size,
    [filteredDD]
  );
  const secondaryAnalystCount = useMemo(
    () => new Set(filteredDD.map((dd) => dd.secondaryAnalyst?.id).filter(Boolean)).size,
    [filteredDD]
  );

  // Analyst comparison (primary vs secondary firm counts) across the filtered set.
  const comparisonData = useMemo(() => {
    const map = new Map();
    for (const dd of filteredDD) {
      if (dd.primaryAnalyst) {
        if (!map.has(dd.primaryAnalyst.id)) map.set(dd.primaryAnalyst.id, { name: dd.primaryAnalyst.name, primary: 0, secondary: 0 });
        map.get(dd.primaryAnalyst.id).primary += 1;
      }
      if (dd.secondaryAnalyst) {
        if (!map.has(dd.secondaryAnalyst.id)) map.set(dd.secondaryAnalyst.id, { name: dd.secondaryAnalyst.name, primary: 0, secondary: 0 });
        map.get(dd.secondaryAnalyst.id).secondary += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.primary + b.secondary) - (a.primary + a.secondary));
  }, [filteredDD]);

  // Under Due Diligence breakdown by current stage (only meaningful when the
  // Under Due Diligence filter is active, but computed from the filtered set).
  const stageBreakdown = useMemo(() => {
    const map = new Map();
    for (const dd of filteredDD) {
      if (dd.lifecycle !== "Under Due Diligence") continue;
      const stage = dd.currentStage || "Unspecified";
      map.set(stage, (map.get(stage) || 0) + 1);
    }
    return Array.from(map.entries()).map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count);
  }, [filteredDD]);

  const resetFilters = () => {
    setFirmFilter("all");
    setPrimaryFilter("all");
    setSecondaryFilter("all");
    setLifecycleFilter("all");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <ClipboardList className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-gray-800">Coverage Overview</h2>
        <Badge variant="outline" className="text-xs border-emerald-200 bg-emerald-50 text-emerald-700">
          Management View
        </Badge>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select
              value={firmFilter}
              onChange={(e) => setFirmFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:border-indigo-400 max-w-[220px] truncate"
              title="Filter by firm"
            >
              <option value="all">All Firms</option>
              {firmOptions.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <select
              value={primaryFilter}
              onChange={(e) => setPrimaryFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:border-indigo-400 max-w-[200px] truncate"
              title="Filter by primary analyst"
            >
              <option value="all">All Primary Analysts</option>
              {analystOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              value={secondaryFilter}
              onChange={(e) => setSecondaryFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:border-indigo-400 max-w-[200px] truncate"
              title="Filter by secondary analyst"
            >
              <option value="all">All Secondary Analysts</option>
              {analystOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
              Reset
            </Button>
          </div>
          {/* Lifecycle stage tabs */}
          <div className="flex items-center gap-1 flex-wrap mt-2">
            {["all", ...LIFECYCLE_STAGES].map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => setLifecycleFilter(stage)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  lifecycleFilter === stage
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {stage === "all" ? "All Stages" : stage}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={ClipboardList} label="Coverage Records" value={filteredDD.length} color="bg-indigo-600" />
        <StatCard icon={Building2} label="Covered Firms" value={coveredFirmCount} color="bg-emerald-600" />
        <StatCard icon={UserCheck} label="Primary Analysts" value={primaryAnalystCount} color="bg-blue-600" />
        <StatCard icon={Users} label="Secondary Analysts" value={secondaryAnalystCount} color="bg-violet-600" />
      </div>

      {/* Analyst comparison chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" /> Analyst Coverage Comparison
            <span className="text-xs text-gray-400 font-normal">(Primary vs Secondary assignments)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comparisonData.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-8 text-center">No analysts matching the selected filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, comparisonData.length * 32)}>
              <BarChart data={comparisonData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="primary" name="Primary" fill="#6366f1" radius={[0, 4, 4, 0]} />
                <Bar dataKey="secondary" name="Secondary" fill="#a78bfa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Under Due Diligence stage breakdown */}
      {lifecycleFilter === "Under Due Diligence" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-500" /> Under Due Diligence — Stage Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stageBreakdown.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-6 text-center">No in-process due diligence records matching the filters.</p>
            ) : (
              <div className="space-y-1.5">
                {stageBreakdown.map(({ stage, count }) => (
                  <div key={stage} className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 truncate flex-1 min-w-0">{stage}</span>
                    <div className="flex-1 max-w-[300px] bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${Math.min(100, (count / stageBreakdown[0].count) * 100)}%` }}
                      />
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex-shrink-0">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Coverage table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-500" /> Coverage Records
            <span className="text-xs text-gray-400 font-normal">({filteredDD.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDD.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-6 text-center">No coverage records matching the selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3 font-medium">Firm</th>
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="py-2 pr-3 font-medium">Primary Analyst</th>
                    <th className="py-2 pr-3 font-medium">Secondary Analyst</th>
                    <th className="py-2 pr-3 font-medium">Stage</th>
                    <th className="py-2 pr-3 font-medium">Lifecycle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDD
                    .sort((a, b) => (a.firm_name || "").localeCompare(b.firm_name || ""))
                    .map((dd) => (
                      <tr key={dd.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-3 font-medium text-gray-800 truncate max-w-[180px]">{dd.firm_name || "—"}</td>
                        <td className="py-2 pr-3 text-gray-600 truncate max-w-[180px]">{dd.product_name || "—"}</td>
                        <td className="py-2 pr-3 text-gray-600 truncate max-w-[140px]">{dd.primaryAnalyst?.name || "—"}</td>
                        <td className="py-2 pr-3 text-gray-600 truncate max-w-[140px]">{dd.secondaryAnalyst?.name || "—"}</td>
                        <td className="py-2 pr-3 text-gray-500 truncate max-w-[140px]">{dd.currentStage || "—"}</td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className={`text-[10px] ${LIFECYCLE_STYLES[dd.lifecycle] || ""}`}>
                            {dd.lifecycle}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uncovered firms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Firms With No Assigned Coverage
            <span className="text-xs text-gray-400 font-normal">({uncoveredFirms.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uncoveredFirms.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-6 text-center">Every firm has an assigned analyst.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {uncoveredFirms.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2">
                  <Building2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate flex-1 min-w-0">{f.name}</span>
                  <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700 bg-amber-50 flex-shrink-0">No coverage</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          Back to Home
        </Button>
      </div>
    </div>
  );
}