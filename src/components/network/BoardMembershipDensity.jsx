import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { Loader2, Users, Building2, Layers, Crown } from "lucide-react";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#0ea5e9", "#ef4444", "#14b8a6", "#f97316", "#a855f7",
  "#3b82f6", "#84cc16", "#e11d48", "#0891b2", "#d946ef",
  "#65a30d", "#c026d3", "#0d9488", "#ea580c", "#4f46e5",
];

export default function BoardMembershipDensity() {
  const [firmTypeFilter, setFirmTypeFilter] = useState("All");

  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["contactsForBoardDensity"],
    queryFn: async () => base44.entities.Contact.list("-created_date", 5000),
    staleTime: 120_000,
  });

  const { data: firms, isLoading: firmsLoading } = useQuery({
    queryKey: ["firmsForBoardDensity"],
    queryFn: async () => base44.entities.Firm.list("-created_date", 5000),
    staleTime: 120_000,
  });

  const isLoading = contactsLoading || firmsLoading;

  // firm_id → firm_types[]
  const firmTypeMap = useMemo(() => {
    const m = new Map();
    (firms || []).forEach((f) => {
      const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
      m.set(f.id, types);
    });
    return m;
  }, [firms]);

  // Which firm types actually have board-sitting contacts (for the filter dropdown)
  const availableTypes = useMemo(() => {
    if (!contacts || !firms) return [];
    const active = contacts.filter((c) => !c.deleted_at);
    const types = new Set();
    active.forEach((c) => {
      (c.firm_ids || []).forEach((fid) => {
        (firmTypeMap.get(fid) || []).forEach((t) => {
          if (FIRM_TYPES.includes(t)) types.add(t);
        });
      });
    });
    return Array.from(types).sort();
  }, [contacts, firms, firmTypeMap]);

  const { chartData, stats, topContacts } = useMemo(() => {
    if (!contacts || !firms) return { chartData: [], stats: null, topContacts: [] };

    const active = contacts.filter((c) => !c.deleted_at);

    const filtered = firmTypeFilter === "All"
      ? active
      : active.filter((c) =>
          (c.firm_ids || []).some((fid) =>
            (firmTypeMap.get(fid) || []).includes(firmTypeFilter)
          )
        );

    // Aggregate board memberships by organization
    const orgCounts = new Map();
    let totalSeats = 0;
    let contactsWithBoards = 0;
    const contactBoardCount = new Map(); // contact_id → number of board seats

    filtered.forEach((c) => {
      const boards = c.board_memberships || [];
      if (boards.length > 0) contactsWithBoards++;
      const seenOrgs = new Set();
      boards.forEach((b) => {
        const org = (b.organization_name || "").trim();
        if (!org || seenOrgs.has(org)) return;
        seenOrgs.add(org);
        orgCounts.set(org, (orgCounts.get(org) || 0) + 1);
        totalSeats++;
      });
      if (boards.length > 0) {
        contactBoardCount.set(c.id, boards.length);
      }
    });

    const chartData = Array.from(orgCounts.entries())
      .map(([org, count]) => ({ org, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Top contacts by board seat count
    const fullName = (c) =>
      [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
        .filter(Boolean).join(" ");
    const topContacts = Array.from(contactBoardCount.entries())
      .map(([id, count]) => {
        const c = filtered.find((x) => x.id === id);
        return c ? { id, name: fullName(c), title: c.title, count } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      chartData,
      stats: {
        totalSeats,
        uniqueOrgs: orgCounts.size,
        contactsWithBoards,
        totalContacts: filtered.length,
      },
      topContacts,
    };
  }, [contacts, firms, firmTypeFilter, firmTypeMap]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-sm text-gray-500">Loading board membership data…</p>
      </div>
    );
  }

  const hasData = stats && stats.totalSeats > 0;

  return (
    <div className="absolute inset-0 overflow-y-auto p-4 space-y-4">
      {/* Firm type filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap font-medium">Firm type:</label>
          <select
            value={firmTypeFilter}
            onChange={(e) => setFirmTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
          >
            <option value="All">All Firm Types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats cards */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Layers className="w-4 h-4" />
              <span className="text-xs font-medium">Total Board Seats</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats.totalSeats}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-medium">Unique Organizations</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats.uniqueOrgs}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Contacts on Boards</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats.contactsWithBoards}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Crown className="w-4 h-4" />
              <span className="text-xs font-medium">Avg Seats / Contact</span>
            </div>
            <p className="text-2xl font-bold text-indigo-600">
              {stats.contactsWithBoards > 0
                ? (stats.totalSeats / stats.contactsWithBoards).toFixed(1)
                : "0"}
            </p>
          </div>
        </div>
      )}

      {!hasData ? (
        <div className="flex flex-col items-center justify-center gap-2 text-gray-400 py-16">
          <Building2 className="w-8 h-8" />
          <p className="text-sm">
            No board memberships found{firmTypeFilter !== "All" ? ` for ${firmTypeFilter} firms` : ""}.
          </p>
          <p className="text-xs text-gray-400">
            Board memberships are extracted from contact biographies during enrichment.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Bar chart: board seat density by organization */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Board Membership Density by Organization
            {firmTypeFilter !== "All" && (
              <span className="ml-2 text-xs font-normal text-indigo-600">
                ({firmTypeFilter} contacts only)
              </span>
            )}
          </h3>
          <div style={{ height: Math.max(300, chartData.length * 28 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  type="category"
                  dataKey="org"
                  width={200}
                  tick={{ fontSize: 11 }}
                  stroke="#6b7280"
                />
                <Tooltip
                  cursor={{ fill: "rgba(99,102,241,0.05)" }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  formatter={(value) => [`${value} seat${value !== 1 ? "s" : ""}`, "Board Seats"]}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top contacts by board seats */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-500" /> Most Board Seats
          </h3>
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
            {topContacts.map((tc, i) => (
              <div key={tc.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-amber-700 bg-amber-100 flex-shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate">{tc.name}</p>
                  {tc.title && <p className="text-[10px] text-gray-400 truncate">{tc.title}</p>}
                </div>
                <span className="text-xs font-bold text-indigo-600 flex-shrink-0">{tc.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}