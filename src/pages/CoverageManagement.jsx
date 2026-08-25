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
  Building2, UserCheck, Users, AlertTriangle, Filter, ClipboardList, FileDown, Loader2, Scale, Gauge,
} from "lucide-react";
import { generateWeeklyCoverageReportPdf } from "@/components/coverage/weeklyCoverageReportPdf";
import { DEFAULT_ANALYST_CAPACITY_TARGET } from "@/components/firms/geographicRegions";

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
  const { isLoading, ddRecords, firms, analysts, uncoveredFirms, contacts } = useCoverageData();
  const [firmFilter, setFirmFilter] = useState("all");
  const [primaryFilter, setPrimaryFilter] = useState("all");
  const [secondaryFilter, setSecondaryFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all"); // all | Pipeline | Under Due Diligence | Approved | Funded | Rejected
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [capacityTarget, setCapacityTarget] = useState(DEFAULT_ANALYST_CAPACITY_TARGET);

  const handleDownloadReport = () => {
    setDownloadingReport(true);
    try {
      generateWeeklyCoverageReportPdf({ analysts, uncoveredFirms, firms, ddRecords, contacts: contacts || [] });
    } catch (e) {
      console.error("Failed to generate coverage report", e);
    } finally {
      setDownloadingReport(false);
    }
  };

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

  // Workload data: total unique firms each analyst is currently covering
  // (union of primary + secondary firm sets), sorted by workload descending.
  const workloadData = useMemo(() => {
    return analysts
      .map((a) => {
        const allFirms = new Set([...a.primaryFirms, ...a.secondaryFirms]);
        return {
          name: a.name,
          firms: allFirms.size,
          primary: a.primaryFirms.size,
          secondary: a.secondaryFirms.size,
        };
      })
      .sort((a, b) => b.firms - a.firms);
  }, [analysts]);

  const workloadStats = useMemo(() => {
    if (workloadData.length === 0) return null;
    const counts = workloadData.map((d) => d.firms);
    return {
      max: Math.max(...counts),
      min: Math.min(...counts),
      avg: (counts.reduce((s, c) => s + c, 0) / counts.length).toFixed(1),
    };
  }, [workloadData]);

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
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={handleDownloadReport}
          disabled={downloadingReport || isLoading}
        >
          {downloadingReport ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileDown className="w-3.5 h-3.5" />
          )}
          {downloadingReport ? "Generating…" : "Weekly Report"}
        </Button>
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

      {/* Analyst workload chart — total firms per analyst */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-500" /> Analyst Workload — Firms Covered
            <span className="text-xs text-gray-400 font-normal">(total unique firms per analyst)</span>
            {workloadStats && (
              <span className="text-xs text-gray-400 font-normal ml-auto">
                Avg {workloadStats.avg} · Max {workloadStats.max} · Min {workloadStats.min}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workloadData.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-8 text-center">No analyst assignments to display.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, workloadData.length * 36)}>
              <BarChart data={workloadData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value, name) => [`${value} ${name === "firms" ? "firms" : name}`, name === "firms" ? "Total Firms" : name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="firms" name="Total Firms" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Analyst capacity indicator — workload vs target */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-rose-500" /> Analyst Capacity
            <span className="text-xs text-gray-400 font-normal">(workload vs target — red bars exceed capacity)</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <label className="text-xs text-gray-500 font-normal">Target:</label>
              <input
                type="number"
                min={1}
                value={capacityTarget}
                onChange={(e) => setCapacityTarget(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:border-indigo-400"
                title="Target firm count per analyst"
              />
              <span className="text-xs text-gray-400">firms</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workloadData.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-6 text-center">No analyst assignments to display.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3 text-xs">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-emerald-400" /> Within capacity
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-400" /> Near capacity (≥80%)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-500" /> Over capacity
                </span>
                <span className="ml-auto text-gray-500">
                  {workloadData.filter((d) => d.firms > capacityTarget).length} of {workloadData.length} analysts over capacity
                </span>
              </div>
              <div className="space-y-2">
                {workloadData.map((d) => {
                  const pct = capacityTarget > 0 ? Math.min(100, (d.firms / capacityTarget) * 100) : 100;
                  const overCapacity = d.firms > capacityTarget;
                  const nearCapacity = d.firms >= capacityTarget * 0.8 && !overCapacity;
                  const barColor = overCapacity ? "bg-red-500" : nearCapacity ? "bg-amber-400" : "bg-emerald-400";
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-28 flex-shrink-0 truncate text-xs font-medium text-gray-700" title={d.name}>{d.name}</div>
                      <div className="flex-1 h-6 rounded-full bg-gray-100 overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                        {/* Target marker line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                          style={{ left: "100%", transform: "translateX(-100%)", display: pct >= 100 ? "none" : undefined }}
                        />
                      </div>
                      <div className="w-20 flex-shrink-0 text-right">
                        <span className={`text-xs font-bold ${overCapacity ? "text-red-600" : "text-gray-700"}`}>
                          {d.firms}
                        </span>
                        <span className="text-xs text-gray-400"> / {capacityTarget}</span>
                      </div>
                      {overCapacity && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px] flex-shrink-0">Over</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

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