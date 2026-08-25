import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronRight, UserCheck, Building2, User, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GEOGRAPHIC_REGIONS } from "@/components/firms/geographicRegions";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const REGION_COLORS = {
  "North America": "#6366f1",
  "Europe": "#10b981",
  "Asia-Pacific": "#f59e0b",
  "Latin America": "#ec4899",
  "Middle East & Africa": "#8b5cf6",
  "Global": "#06b6d4",
};

// Collapsible dashboard section showing every analyst (team member) organized
// by their role (Primary / Secondary) and the firms they are currently covering,
// derived from active DueDiligence analyst_history entries (no end_date).
// Includes a geographic region filter and a region-based heatmap of covered firms.
export default function DashboardAnalystCoverageSection({ forceExpanded, onFirmClick }) {
  const [expanded, setExpanded] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all"); // all | primary | secondary
  const [firmFilter, setFirmFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const { data: ddRecords = [], isLoading } = useQuery({
    queryKey: ["due-diligence-all"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 500),
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });

  // Map firm_id → geographic_region for region-based filtering and heatmap.
  const firmRegionMap = useMemo(() => {
    const map = new Map();
    for (const f of firms) {
      if (f.deleted_at) continue;
      map.set(f.id, f.geographic_region || "");
    }
    return map;
  }, [firms]);

  // Aggregate active analyst assignments from analyst_history (entries with no
  // end_date are currently active). Each analyst gets their covered firms.
  const analysts = useMemo(() => {
    const active = ddRecords.filter((r) => !r.deleted_at);
    const byAnalyst = {};
    for (const rec of active) {
      for (const entry of rec.analyst_history || []) {
        if (entry.end_date || !entry.contact_id) continue;
        if (!byAnalyst[entry.contact_id]) {
          byAnalyst[entry.contact_id] = {
            id: entry.contact_id,
            name: entry.contact_name || "—",
            roles: new Set(),
            assignments: [],
            firmSet: new Set(),
          };
        }
        const a = byAnalyst[entry.contact_id];
        a.roles.add(entry.analyst_type);
        a.firmSet.add(rec.firm_id);
        a.assignments.push({
          firm_id: rec.firm_id,
          firm_name: rec.firm_name || "—",
          firm_region: firmRegionMap.get(rec.firm_id) || "",
          product_name: rec.product_name || "—",
          dd_status: rec.status || "Pipeline",
          role: entry.analyst_type,
        });
      }
    }
    return Object.values(byAnalyst).map((a) => ({
      ...a,
      roles: Array.from(a.roles),
      firmCount: a.firmSet.size,
      assignments: a.assignments.sort((x, y) => x.firm_name.localeCompare(y.firm_name)),
    }));
  }, [ddRecords, firmRegionMap]);

  // Fetch analyst contacts for photos / titles.
  const analystIds = analysts.map((a) => a.id);
  const { data: contacts = [] } = useQuery({
    queryKey: ["analyst-contacts", analystIds],
    queryFn: () => (analystIds.length ? base44.entities.Contact.filter({ id: { $in: analystIds } }) : []),
    enabled: analystIds.length > 0,
  });
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const firmOptions = useMemo(() => {
    const map = new Map();
    for (const a of analysts)
      for (const as of a.assignments) map.set(as.firm_id, as.firm_name);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [analysts]);

  // Region heatmap: count of covered firms per geographic region (across all
  // analysts, before the region filter is applied — so the heatmap always
  // shows the full picture). A firm is counted once per region even if
  // multiple analysts cover it.
  const regionHeatmapData = useMemo(() => {
    const counts = {};
    for (const region of GEOGRAPHIC_REGIONS) counts[region] = 0;
    const seenFirmRegions = new Set();
    for (const a of analysts) {
      for (const as of a.assignments) {
        const key = `${as.firm_id}:${as.firm_region}`;
        if (seenFirmRegions.has(key)) continue;
        seenFirmRegions.add(key);
        if (as.firm_region && counts[as.firm_region] !== undefined) {
          counts[as.firm_region]++;
        }
      }
    }
    return GEOGRAPHIC_REGIONS
      .map((region) => ({ region, firms: counts[region] }))
      .filter((d) => d.firms > 0);
  }, [analysts]);

  // Apply region filter to each analyst's assignments (and drop analysts with
  // no matching assignments when a region filter is active).
  const regionFilteredAnalysts = useMemo(() => {
    if (regionFilter === "all") return analysts;
    return analysts
      .map((a) => ({
        ...a,
        assignments: a.assignments.filter((as) => as.firm_region === regionFilter),
        firmSet: new Set(a.assignments.filter((as) => as.firm_region === regionFilter).map((as) => as.firm_id)),
      }))
      .filter((a) => a.assignments.length > 0)
      .map((a) => ({ ...a, firmCount: a.firmSet.size }));
  }, [analysts, regionFilter]);

  const firmFilteredAnalysts = useMemo(() => {
    if (firmFilter === "all") return regionFilteredAnalysts;
    return regionFilteredAnalysts.filter((a) => a.assignments.some((as) => as.firm_id === firmFilter));
  }, [regionFilteredAnalysts, firmFilter]);

  const primaryAnalysts = firmFilteredAnalysts
    .filter((a) => a.roles.includes("primary"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const secondaryOnly = firmFilteredAnalysts
    .filter((a) => !a.roles.includes("primary") && a.roles.includes("secondary"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderAnalystCard = (a) => {
    const contact = contactMap.get(a.id);
    const photo = contact?.photo_url;
    const title = contact?.title;
    const hasBothRoles = a.roles.length > 1;
    return (
      <div key={a.id} className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2.5">
          {photo ? (
            <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-indigo-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-gray-800 truncate">{a.name}</span>
              {a.roles.map((r) => (
                <Badge
                  key={r}
                  className={`text-[10px] px-1.5 py-0 ${
                    r === "primary"
                      ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                      : "bg-violet-100 text-violet-700 border-violet-200"
                  }`}
                >
                  {r === "primary" ? "Primary" : "Secondary"}
                </Badge>
              ))}
            </div>
            {title && <div className="text-xs text-gray-400 truncate">{title}</div>}
          </div>
          <Badge className="bg-gray-100 text-gray-600 border border-gray-200 flex-shrink-0">
            {a.firmCount} {a.firmCount === 1 ? "firm" : "firms"}
          </Badge>
        </div>
        <div className="mt-2 space-y-1">
          {a.assignments.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              {onFirmClick ? (
                <button
                  type="button"
                  onClick={() => onFirmClick(f.firm_id)}
                  className="text-gray-700 hover:text-indigo-600 hover:underline truncate text-left"
                >
                  {f.firm_name}
                </button>
              ) : (
                <span className="text-gray-700 truncate">{f.firm_name}</span>
              )}
              {f.firm_region && (
                <span
                  className="text-[9px] px-1 rounded flex-shrink-0"
                  style={{ backgroundColor: (REGION_COLORS[f.firm_region] || "#9ca3af") + "20", color: REGION_COLORS[f.firm_region] || "#6b7280" }}
                >
                  {f.firm_region}
                </span>
              )}
              <span className="text-gray-300">·</span>
              <span className="text-gray-400 truncate flex-1 min-w-0">{f.product_name}</span>
              {hasBothRoles && (
                <span
                  className={`text-[9px] font-medium px-1 rounded flex-shrink-0 ${
                    f.role === "primary"
                      ? "bg-indigo-50 text-indigo-600"
                      : "bg-violet-50 text-violet-600"
                  }`}
                >
                  {f.role === "primary" ? "P" : "S"}
                </span>
              )}
              <Badge variant="outline" className="text-[9px] flex-shrink-0">{f.dd_status}</Badge>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full mb-2 px-1 group"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        )}
        <UserCheck className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
          Analyst Coverage
        </span>
        <span className="text-[11px] text-gray-400 font-normal hidden sm:inline">
          Team members & the firms they cover
        </span>
      </button>
      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100 space-y-3">
          {isLoading ? (
            <div className="text-xs text-gray-400 italic py-4 text-center">Loading…</div>
          ) : analysts.length === 0 ? (
            <div className="text-xs text-gray-400 italic py-4 text-center">
              No active analyst assignments
            </div>
          ) : (
            <>
              {/* Region heatmap */}
              {regionHeatmapData.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs font-semibold text-gray-700">Covered Firms by Geographic Region</span>
                  </div>
                  <ResponsiveContainer width="100%" height={Math.max(60, regionHeatmapData.length * 28)}>
                    <BarChart data={regionHeatmapData} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="region" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [`${v} firms`, "Covered Firms"]} />
                      <Bar dataKey="firms" name="Covered Firms" radius={[0, 4, 4, 0]}>
                        {regionHeatmapData.map((d) => (
                          <Cell key={d.region} fill={REGION_COLORS[d.region] || "#6366f1"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {[
                    { key: "all", label: "All" },
                    { key: "primary", label: "Primary" },
                    { key: "secondary", label: "Secondary" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setRoleFilter(opt.key)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                        roleFilter === opt.key
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="text-[11px] border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600 focus:outline-none focus:border-indigo-400 max-w-[180px] truncate"
                  title="Filter analysts by firm geographic region"
                >
                  <option value="all">All Regions</option>
                  {GEOGRAPHIC_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select
                  value={firmFilter}
                  onChange={(e) => setFirmFilter(e.target.value)}
                  className="text-[11px] border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600 focus:outline-none focus:border-indigo-400 max-w-[200px] truncate"
                  title="Filter analysts by firm coverage"
                >
                  <option value="all">All Firms</option>
                  {firmOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {(roleFilter === "all" || roleFilter === "primary") && primaryAnalysts.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide mb-1.5">
                    Primary Analysts ({primaryAnalysts.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {primaryAnalysts.map(renderAnalystCard)}
                  </div>
                </div>
              )}

              {(roleFilter === "all" || roleFilter === "secondary") && secondaryOnly.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide mb-1.5">
                    Secondary Analysts ({secondaryOnly.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {secondaryOnly.map(renderAnalystCard)}
                  </div>
                </div>
              )}

              {!(
                (roleFilter === "all" || roleFilter === "primary") && primaryAnalysts.length > 0
              ) &&
                !(
                  (roleFilter === "all" || roleFilter === "secondary") &&
                  secondaryOnly.length > 0
                ) && (
                <div className="text-xs text-gray-400 italic py-4 text-center">
                  No analysts matching the selected filters
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}