import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Trophy, Star, Building2, CalendarClock, Package, Filter, Loader2,
  Crown, Users, Lightbulb, UserCheck, Search, X, FileDown, Mail, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecisionRoleBadge } from "@/components/contacts/ContactDecisionRolePicker";

const TIERS = [
  { min: 16, label: "Key Influencer", classes: "bg-amber-50 text-amber-700 border-amber-200", star: "text-amber-500", ring: "ring-amber-300" },
  { min: 8, label: "Influencer", classes: "bg-indigo-50 text-indigo-700 border-indigo-200", star: "text-indigo-500", ring: "ring-indigo-300" },
  { min: 3, label: "Connected", classes: "bg-blue-50 text-blue-700 border-blue-200", star: "text-blue-500", ring: "ring-blue-300" },
  { min: 0, label: "Emerging", classes: "bg-gray-50 text-gray-600 border-gray-200", star: "text-gray-400", ring: "ring-gray-300" },
];

function getTier(score) {
  return TIERS.find((t) => score >= t.min);
}

const ROLE_COLORS = {
  "Primary Decision Maker": "#f59e0b",
  "Board Member": "#8b5cf6",
  "Key Influencer": "#6366f1",
  "Secondary Contact": "#0ea5e9",
  "Other": "#64748b",
};

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

function fullName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export default function ContactInfluenceDashboard() {
  const [firmTypeFilter, setFirmTypeFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  // Load all data in parallel
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["influenceContacts"],
    queryFn: async () => {
      const list = await base44.entities.Contact.list("-created_date", 1000);
      return (list || []).filter((c) => !c.deleted_at);
    },
    staleTime: 60_000,
  });

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["influenceFirms"],
    queryFn: async () => {
      const list = await base44.entities.Firm.list("-created_date", 1000);
      return (list || []).filter((f) => !f.deleted_at);
    },
    staleTime: 60_000,
  });

  const { data: boardMeetings = [], isLoading: boardsLoading } = useQuery({
    queryKey: ["influenceBoards"],
    queryFn: async () => base44.entities.BoardMeeting.list("-meeting_date", 1000),
    staleTime: 60_000,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["influenceProducts"],
    queryFn: async () => base44.entities.Product.list("-created_date", 1000),
    staleTime: 60_000,
  });

  const isLoading = contactsLoading || firmsLoading || boardsLoading || productsLoading;

  // Build lookup maps
  const firmMap = useMemo(() => {
    const m = new Map();
    firms.forEach((f) => m.set(f.id, f));
    return m;
  }, [firms]);

  const boardsByFirm = useMemo(() => {
    const m = new Map();
    boardMeetings.forEach((b) => {
      if (!b.firm_id) return;
      if (!m.has(b.firm_id)) m.set(b.firm_id, []);
      m.get(b.firm_id).push(b);
    });
    return m;
  }, [boardMeetings]);

  // Compute influence scores for every contact
  const rankedContacts = useMemo(() => {
    if (isLoading) return [];
    return contacts
      .map((c) => {
        const directFirmIds = Array.isArray(c.firm_ids) ? c.firm_ids.filter(Boolean) : [];
        // Products where this contact sits on the investment team
        const teamProducts = products.filter(
          (p) =>
            Array.isArray(p.investment_team) &&
            p.investment_team.some((m) => m.contact_id === c.id)
        );
        // Firms linked via investment-team products (may include firms not in firm_ids)
        const teamFirmIds = teamProducts
          .map((p) => p.firm_id)
          .filter((fid) => fid && !directFirmIds.includes(fid));
        const allFirmIds = [...new Set([...directFirmIds, ...teamFirmIds])];

        // Board meetings for any linked firm
        const boardCount = allFirmIds.reduce((sum, fid) => {
          const list = boardsByFirm.get(fid) || [];
          return sum + list.length;
        }, 0);

        const firmCount = allFirmIds.length;
        const teamSeatCount = teamProducts.length;
        const score = firmCount + boardCount * 2 + teamSeatCount;
        const tier = getTier(score);

        // Collect the linked firm objects (for firm-type filtering + display)
        const linkedFirms = allFirmIds
          .map((fid) => firmMap.get(fid))
          .filter(Boolean);

        // Firm types across all linked firms
        const linkedFirmTypes = new Set();
        linkedFirms.forEach((f) => {
          if (f.firm_type) linkedFirmTypes.add(f.firm_type);
          (f.firm_types || []).forEach((t) => linkedFirmTypes.add(t));
        });

        return {
          ...c,
          fullName: fullName(c) || `${c.first_name} ${c.last_name}`,
          score,
          tier,
          firmCount,
          boardCount,
          teamSeatCount,
          allFirmIds,
          linkedFirms,
          linkedFirmTypes: Array.from(linkedFirmTypes),
          teamProducts,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [contacts, firms, boardMeetings, products, isLoading, firmMap, boardsByFirm]);

  // Apply filters
  const filteredContacts = useMemo(() => {
    let list = rankedContacts;
    if (firmTypeFilter !== "All") {
      list = list.filter((c) => c.linkedFirmTypes.includes(firmTypeFilter));
    }
    if (tierFilter !== "All") {
      list = list.filter((c) => c.tier.label === tierFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          (c.title || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          c.linkedFirms.some((f) => (f.name || "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [rankedContacts, firmTypeFilter, tierFilter, search]);

  // Summary stats
  const stats = useMemo(() => {
    if (!rankedContacts.length) return null;
    const tierCounts = {};
    TIERS.forEach((t) => (tierCounts[t.label] = 0));
    rankedContacts.forEach((c) => (tierCounts[c.tier.label] = (tierCounts[c.tier.label] || 0) + 1));
    return {
      total: rankedContacts.length,
      scored: rankedContacts.filter((c) => c.score > 0).length,
      avgScore: rankedContacts.length
        ? (rankedContacts.reduce((s, c) => s + c.score, 0) / rankedContacts.length).toFixed(1)
        : 0,
      tierCounts,
    };
  }, [rankedContacts]);

  const handleExportCsv = () => {
    if (!filteredContacts.length || exporting) return;
    setExporting(true);
    try {
      const rows = [
        ["Rank", "Name", "Title", "Email", "Score", "Tier", "Firms", "Board Meetings", "Team Seats", "Linked Firms"],
        ...filteredContacts.map((c, i) => [
          i + 1,
          c.fullName,
          c.title || "",
          c.email || "",
          c.score,
          c.tier.label,
          c.firmCount,
          c.boardCount,
          c.teamSeatCount,
          c.linkedFirms.map((f) => f.name).join("; "),
        ]),
      ];
      const csv = rows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contact-influence-ranking-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Trophy className="w-6 h-6 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold">Contact Influence Ranking</h1>
            <p className="text-xs text-white/70">
              Contacts ranked by network influence — firms, board meetings, and product team seats
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, title, email, or firm…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <label className="text-sm text-gray-600 whitespace-nowrap">Firm type:</label>
            <select
              value={firmTypeFilter}
              onChange={(e) => setFirmTypeFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="All">All Firm Types</option>
              {FIRM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Tier:</label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="All">All Tiers</option>
              {TIERS.map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={exporting || !filteredContacts.length}
            className="ml-auto"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-1" />
            )}
            Export CSV
          </Button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
              <Users className="w-3.5 h-3.5" /> {stats.total} contacts · {stats.scored} scored
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-medium">
              Avg score: {stats.avgScore}
            </span>
            {TIERS.map((t) => (
              <span
                key={t.label}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium border ${t.classes}`}
              >
                <Star className={`w-3 h-3 ${t.star}`} />
                {t.label}: {stats.tierCounts[t.label] || 0}
              </span>
            ))}
          </div>
        )}

        {/* Ranking table */}
        <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-sm text-gray-500">Calculating influence scores…</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-sm">
              <Trophy className="w-8 h-8 mb-2 opacity-40" />
              No contacts match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-16">Rank</th>
                    <th className="px-3 py-2.5 text-left">Contact</th>
                    <th className="px-3 py-2.5 text-center w-24">Score</th>
                    <th className="px-3 py-2.5 text-center w-28">Tier</th>
                    <th className="px-3 py-2.5 text-center w-20">Firms</th>
                    <th className="px-3 py-2.5 text-center w-24">Boards</th>
                    <th className="px-3 py-2.5 text-center w-20">Seats</th>
                    <th className="px-3 py-2.5 text-left">Linked Firms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredContacts.map((c, i) => (
                    <tr
                      key={c.id}
                      className={`hover:bg-gray-50 transition-colors ${c.tier.ring ? `ring-1 ring-inset ${c.tier.ring}` : ""}`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          i === 0 ? "bg-amber-100 text-amber-700" :
                          i === 1 ? "bg-gray-200 text-gray-700" :
                          i === 2 ? "bg-orange-100 text-orange-700" :
                          "bg-gray-50 text-gray-500"
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {c.photo_url ? (
                            <img src={c.photo_url} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" style={{ background: ROLE_COLORS[c.decision_role] || "#94a3b8" }}>
                              {c.fullName?.[0]?.toUpperCase() || "?"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">{c.fullName}</p>
                            {c.title && <p className="text-xs text-gray-500 truncate">{c.title}</p>}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {c.decision_role && <DecisionRoleBadge role={c.decision_role} size="xs" />}
                              {c.email && (
                                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-primary" onClick={(e) => e.stopPropagation()}>
                                  <Mail className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-lg font-bold text-gray-800">{c.score}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.tier.classes}`}>
                          <Star className={`w-3 h-3 ${c.tier.star}`} />
                          {c.tier.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {c.firmCount}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
                          {c.boardCount}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Package className="w-3.5 h-3.5 text-gray-400" />
                          {c.teamSeatCount}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {c.linkedFirms.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">No firms linked</span>
                          ) : (
                            c.linkedFirms.slice(0, 3).map((f) => (
                              <span
                                key={f.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] border border-blue-100"
                                title={f.firm_type || (f.firm_types || []).join(", ")}
                              >
                                <Building2 className="w-2.5 h-2.5" />
                                {f.name?.length > 22 ? f.name.slice(0, 20) + "…" : f.name}
                              </span>
                            ))
                          )}
                          {c.linkedFirms.length > 3 && (
                            <span className="text-[10px] text-gray-400 self-center">
                              +{c.linkedFirms.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Influence score = (linked firms) + (board meetings × 2) + (product team seats).
          Tiers: Emerging (0–2) · Connected (3–7) · Influencer (8–15) · Key Influencer (16+).
        </p>
      </div>
    </div>
  );
}