import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Building2, Layers, Users, Grid3x3, Crown } from "lucide-react";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

function fullName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean).join(" ");
}

// Color scale: white → indigo (intensity by density)
function cellColor(value, max) {
  if (value === 0 || max === 0) return "#f8fafc";
  const ratio = value / max;
  // Interpolate from light indigo to deep indigo
  const hue = 230;
  const sat = 70 + ratio * 20;
  const light = 96 - ratio * 70;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function textColor(value, max) {
  if (value === 0 || max === 0) return "#cbd5e1";
  const ratio = value / max;
  return ratio > 0.55 ? "#ffffff" : "#475569";
}

export default function BoardMembershipHeatmap() {
  const [firmTypeFilter, setFirmTypeFilter] = useState("All");
  const [topN, setTopN] = useState(15);

  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["contactsForBoardHeatmap"],
    queryFn: async () => base44.entities.Contact.list("-created_date", 5000),
    staleTime: 120_000,
  });

  const { data: firms, isLoading: firmsLoading } = useQuery({
    queryKey: ["firmsForBoardHeatmap"],
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

  // Which firm types have board-sitting contacts
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

  // Build the heatmap matrix: rows = organizations, columns = firm types
  const { matrix, orgs, stats, topContacts } = useMemo(() => {
    if (!contacts || !firms) return { matrix: [], orgs: [], stats: null, topContacts: [] };

    const active = contacts.filter((c) => !c.deleted_at);

    const filtered = firmTypeFilter === "All"
      ? active
      : active.filter((c) =>
          (c.firm_ids || []).some((fid) =>
            (firmTypeMap.get(fid) || []).includes(firmTypeFilter)
          )
        );

    // org → { total, byType: { firmType: count } }
    const orgMap = new Map();
    const contactBoardCount = new Map();

    filtered.forEach((c) => {
      const cTypes = new Set();
      (c.firm_ids || []).forEach((fid) => {
        (firmTypeMap.get(fid) || []).forEach((t) => {
          if (FIRM_TYPES.includes(t)) cTypes.add(t);
        });
      });

      const boards = c.board_memberships || [];
      const seenOrgs = new Set();
      boards.forEach((b) => {
        const org = (b.organization_name || "").trim();
        if (!org || seenOrgs.has(org)) return;
        seenOrgs.add(org);
        if (!orgMap.has(org)) orgMap.set(org, { total: 0, byType: {} });
        const entry = orgMap.get(org);
        entry.total += 1;
        // Attribute to each firm type this contact belongs to
        const typesToCredit = firmTypeFilter === "All"
          ? (cTypes.size > 0 ? Array.from(cTypes) : ["Unknown"])
          : [firmTypeFilter];
        typesToCredit.forEach((t) => {
          entry.byType[t] = (entry.byType[t] || 0) + 1;
        });
      });

      if (boards.length > 0) {
        contactBoardCount.set(c.id, (contactBoardCount.get(c.id) || 0) + boards.length);
      }
    });

    // Sort orgs by total seats desc, take top N
    const orgs = Array.from(orgMap.entries())
      .map(([org, data]) => ({ org, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN);

    // Column types: all firm types (or just the filtered one)
    const colTypes = firmTypeFilter === "All" ? FIRM_TYPES : [firmTypeFilter];

    // Build matrix values + find max for color scaling
    let maxVal = 0;
    const matrix = orgs.map((row) => {
      const cells = colTypes.map((t) => {
        const v = row.byType[t] || 0;
        if (v > maxVal) maxVal = v;
        return v;
      });
      return { org: row.org, total: row.total, cells };
    });

    const totalSeats = orgs.reduce((s, r) => s + r.total, 0);
    const contactsWithBoards = filtered.filter((c) => (c.board_memberships || []).length > 0).length;

    const topContacts = Array.from(contactBoardCount.entries())
      .map(([id, count]) => {
        const c = filtered.find((x) => x.id === id);
        return c ? { id, name: fullName(c), title: c.title, count } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      matrix,
      orgs,
      stats: {
        totalSeats,
        uniqueOrgs: orgMap.size,
        contactsWithBoards,
        totalContacts: filtered.length,
        maxVal,
      },
      topContacts,
    };
  }, [contacts, firms, firmTypeFilter, firmTypeMap, topN]);

  const colTypes = firmTypeFilter === "All" ? FIRM_TYPES : [firmTypeFilter];

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
      {/* Controls */}
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
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap font-medium">Top orgs:</label>
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
          </select>
        </div>
      </div>

      {/* Stats cards */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Layers className="w-4 h-4" />
              <span className="text-xs font-medium">Board Seats (top {topN})</span>
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
              <span className="text-xs font-medium">Max Density</span>
            </div>
            <p className="text-2xl font-bold text-indigo-600">{stats.maxVal}</p>
          </div>
        </div>
      )}

      {!hasData ? (
        <div className="flex flex-col items-center justify-center gap-2 text-gray-400 py-16">
          <Grid3x3 className="w-8 h-8" />
          <p className="text-sm">
            No board memberships found{firmTypeFilter !== "All" ? ` for ${firmTypeFilter} firms` : ""}.
          </p>
          <p className="text-xs text-gray-400">
            Board memberships are extracted from contact biographies during enrichment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
          {/* Heatmap grid */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm overflow-x-auto">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <Grid3x3 className="w-4 h-4 text-indigo-500" />
              Board Membership Density
              {firmTypeFilter !== "All" && (
                <span className="ml-2 text-xs font-normal text-indigo-600">
                  ({firmTypeFilter} contacts only)
                </span>
              )}
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1.5 text-gray-500 font-medium border-b border-gray-200 sticky left-0 bg-white z-10 min-w-[180px]">
                    Organization
                  </th>
                  {colTypes.map((t) => (
                    <th
                      key={t}
                      className="px-2 py-1.5 text-gray-500 font-medium border-b border-gray-200 text-center min-w-[110px]"
                      title={t}
                    >
                      {t.length > 14 ? t.slice(0, 12) + "…" : t}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-gray-700 font-semibold border-b border-gray-200 text-center bg-gray-50">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={row.org} className="group">
                    <td className="px-2 py-1.5 text-gray-700 border-b border-gray-100 sticky left-0 bg-white z-10 group-hover:bg-gray-50 max-w-[180px]">
                      <span className="block truncate" title={row.org}>{row.org}</span>
                    </td>
                    {row.cells.map((v, j) => (
                      <td
                        key={j}
                        className="px-1 py-1 text-center border-b border-gray-100 border-r border-gray-50 font-semibold"
                        style={{
                          background: cellColor(v, stats.maxVal),
                          color: textColor(v, stats.maxVal),
                        }}
                        title={`${row.org} · ${colTypes[j]}: ${v} seat${v !== 1 ? "s" : ""}`}
                      >
                        {v > 0 ? v : ""}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center border-b border-gray-100 font-bold text-gray-800 bg-gray-50">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-500">
              <span>Low</span>
              <div className="flex h-3 rounded overflow-hidden border border-gray-200">
                {[0, 0.25, 0.5, 0.75, 1].map((r) => (
                  <div
                    key={r}
                    className="w-6"
                    style={{ background: cellColor(r * (stats.maxVal || 1), stats.maxVal) }}
                  />
                ))}
              </div>
              <span>High ({stats.maxVal})</span>
            </div>
          </div>

          {/* Top contacts sidebar */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" /> Most Board Seats
            </h3>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
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
              {topContacts.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-4">No board seats</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}