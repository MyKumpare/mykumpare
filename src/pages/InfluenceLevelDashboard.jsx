import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Trophy, Search, X, Loader2, Building2, Users, Crown, Lightbulb,
  UserMinus, HelpCircle, ChevronDown, ChevronRight, FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InfluenceContactCard from "@/components/contacts/InfluenceContactCard";

const INFLUENCE_LEVELS = [
  {
    value: "Final Decision Maker",
    label: "Final Decision Makers",
    icon: Trophy,
    classes: "bg-purple-50 text-purple-700 border-purple-200",
    star: "text-purple-500",
    badge: "bg-purple-100 text-purple-800 border-purple-300",
    description: "Ultimate authority who signs off on investment decisions",
  },
  {
    value: "Decision Maker",
    label: "Decision Makers",
    icon: Crown,
    classes: "bg-amber-50 text-amber-700 border-amber-200",
    star: "text-amber-500",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    description: "Final say on investment decisions",
  },
  {
    value: "Influencer",
    label: "Influencers",
    icon: Lightbulb,
    classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
    star: "text-indigo-500",
    badge: "bg-indigo-100 text-indigo-800 border-indigo-300",
    description: "Shape decisions without final authority",
  },
  {
    value: "Follower",
    label: "Followers",
    icon: UserMinus,
    classes: "bg-blue-50 text-blue-700 border-blue-200",
    star: "text-blue-500",
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    description: "Minimal direct influence",
  },
  {
    value: "Undetermined",
    label: "Undetermined",
    icon: HelpCircle,
    classes: "bg-gray-50 text-gray-600 border-gray-200",
    star: "text-gray-400",
    badge: "bg-gray-100 text-gray-700 border-gray-300",
    description: "Not yet assessed",
  },
];

const TIERS = [
  { min: 16, label: "Key Influencer", classes: "bg-amber-50 text-amber-700 border-amber-200", star: "text-amber-500" },
  { min: 8, label: "Influencer", classes: "bg-indigo-50 text-indigo-700 border-indigo-200", star: "text-indigo-500" },
  { min: 3, label: "Connected", classes: "bg-blue-50 text-blue-700 border-blue-200", star: "text-blue-500" },
  { min: 0, label: "Emerging", classes: "bg-gray-50 text-gray-600 border-gray-200", star: "text-gray-400" },
];

function getTier(score) {
  return TIERS.find((t) => score >= t.min);
}

export default function InfluenceLevelDashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeLevel, setActiveLevel] = useState("Decision Maker");
  const [expandedFirms, setExpandedFirms] = useState(new Set());
  const [exporting, setExporting] = useState(false);

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["influenceLevelContacts"],
    queryFn: async () => {
      const list = await base44.entities.Contact.list("-created_date", 2000);
      return (list || []).filter((c) => !c.deleted_at);
    },
    staleTime: 60_000,
  });

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["influenceLevelFirms"],
    queryFn: async () => {
      const list = await base44.entities.Firm.list("-created_date", 2000);
      return (list || []).filter((f) => !f.deleted_at);
    },
    staleTime: 60_000,
  });

  const { data: boardMeetings = [], isLoading: boardsLoading } = useQuery({
    queryKey: ["influenceLevelBoards"],
    queryFn: async () => base44.entities.BoardMeeting.list("-meeting_date", 2000),
    staleTime: 60_000,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["influenceLevelProducts"],
    queryFn: async () => base44.entities.Product.list("-created_date", 2000),
    staleTime: 60_000,
  });

  const isLoading = contactsLoading || firmsLoading || boardsLoading || productsLoading;

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

  // Enrich contacts with influence score + linked firms
  const enrichedContacts = useMemo(() => {
    if (isLoading) return [];
    return contacts.map((c) => {
      const directFirmIds = Array.isArray(c.firm_ids) ? c.firm_ids.filter(Boolean) : [];
      const teamProducts = products.filter(
        (p) => Array.isArray(p.investment_team) && p.investment_team.some((m) => m.contact_id === c.id)
      );
      const teamFirmIds = teamProducts.map((p) => p.firm_id).filter((fid) => fid && !directFirmIds.includes(fid));
      const allFirmIds = [...new Set([...directFirmIds, ...teamFirmIds])];

      const boardCount = allFirmIds.reduce((sum, fid) => sum + (boardsByFirm.get(fid) || []).length, 0);
      const firmCount = allFirmIds.length;
      const teamSeatCount = teamProducts.length;
      const score = firmCount + boardCount * 2 + teamSeatCount;
      const tier = getTier(score);

      const linkedFirms = allFirmIds.map((fid) => firmMap.get(fid)).filter(Boolean);
      const primaryFirm = linkedFirms[0];

      return {
        ...c,
        score,
        tier,
        firmCount,
        boardCount,
        teamSeatCount,
        allFirmIds,
        linkedFirms,
        primaryFirm,
      };
    });
  }, [contacts, firms, boardMeetings, products, isLoading, firmMap, boardsByFirm]);

  // Count contacts per influence level
  const levelCounts = useMemo(() => {
    const counts = {};
    INFLUENCE_LEVELS.forEach((l) => (counts[l.value] = 0));
    enrichedContacts.forEach((c) => {
      const level = c.influence_level || "Undetermined";
      counts[level] = (counts[level] || 0) + 1;
    });
    return counts;
  }, [enrichedContacts]);

  // Filter contacts by active level + search
  const filteredContacts = useMemo(() => {
    let list = enrichedContacts.filter((c) => (c.influence_level || "Undetermined") === activeLevel);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ").toLowerCase().includes(q) ||
          (c.title || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          c.linkedFirms.some((f) => (f.name || "").toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => b.score - a.score);
  }, [enrichedContacts, activeLevel, search]);

  // Group filtered contacts by firm for the breakdown
  const firmBreakdown = useMemo(() => {
    const m = new Map();
    filteredContacts.forEach((c) => {
      c.linkedFirms.forEach((f) => {
        if (!m.has(f.id)) m.set(f.id, { firm: f, contacts: [] });
        m.get(f.id).contacts.push(c);
      });
    });
    return Array.from(m.values()).sort((a, b) => b.contacts.length - a.contacts.length);
  }, [filteredContacts]);

  // Top firms across ALL influence levels (overview breakdown)
  const overviewFirmBreakdown = useMemo(() => {
    const m = new Map();
    enrichedContacts.forEach((c) => {
      const level = c.influence_level || "Undetermined";
      c.linkedFirms.forEach((f) => {
        if (!m.has(f.id)) m.set(f.id, { firm: f, contacts: [], levelCounts: {} });
        const entry = m.get(f.id);
        entry.contacts.push(c);
        entry.levelCounts[level] = (entry.levelCounts[level] || 0) + 1;
      });
    });
    // Sort by number of Decision Makers + Influencers first
    return Array.from(m.values())
      .map((e) => ({
        ...e,
        influentialCount: (e.levelCounts["Decision Maker"] || 0) + (e.levelCounts["Influencer"] || 0),
      }))
      .sort((a, b) => b.influentialCount - a.influentialCount || b.contacts.length - a.contacts.length);
  }, [enrichedContacts]);

  const toggleFirm = (firmId) => {
    setExpandedFirms((prev) => {
      const next = new Set(prev);
      if (next.has(firmId)) next.delete(firmId);
      else next.add(firmId);
      return next;
    });
  };

  const handleFirmClick = (firmId) => {
    if (firmId) navigate(`/?firm=${firmId}`);
  };

  const handleExportCsv = () => {
    if (!filteredContacts.length || exporting) return;
    setExporting(true);
    try {
      const rows = [
        ["Name", "Title", "Email", "Influence Level", "Score", "Tier", "Firms", "Board Meetings", "Linked Firms"],
        ...filteredContacts.map((c) => [
          [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" "),
          c.title || "",
          c.email || "",
          c.influence_level || "Undetermined",
          c.score,
          c.tier.label,
          c.firmCount,
          c.boardCount,
          c.linkedFirms.map((f) => f.name).join("; "),
        ]),
      ];
      const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `influence-level-${activeLevel.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const activeLevelConfig = INFLUENCE_LEVELS.find((l) => l.value === activeLevel);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Trophy className="w-6 h-6 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold">Influence Level Dashboard</h1>
            <p className="text-xs text-white/70">
              Contacts categorized by influence level — breakdown of influential individuals across firms
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Level summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {INFLUENCE_LEVELS.map((level) => {
            const Icon = level.icon;
            const isActiveLevel = activeLevel === level.value;
            return (
              <button
                key={level.value}
                type="button"
                onClick={() => setActiveLevel(level.value)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  isActiveLevel
                    ? "border-primary shadow-md scale-[1.02]"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${level.badge}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-2xl font-bold text-gray-900">{levelCounts[level.value] || 0}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800">{level.label}</p>
                <p className="text-[10px] text-gray-500 truncate">{level.description}</p>
              </button>
            );
          })}
        </div>

        {/* Firm breakdown overview — top firms by influential contacts */}
        {!isLoading && overviewFirmBreakdown.length > 0 && (
          <div className="mb-5 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-800">Firm Breakdown — Top Firms by Influence</h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Firms ranked by number of Decision Makers + Influencers in their contacts
              </p>
            </div>
            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {overviewFirmBreakdown.slice(0, 15).map(({ firm, contacts, levelCounts, influentialCount }) => (
                <div key={firm.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => handleFirmClick(firm.id)}
                    className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium min-w-0 flex-1"
                  >
                    <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{firm.name}</span>
                  </button>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {INFLUENCE_LEVELS.map((level) => {
                      const count = levelCounts[level.value] || 0;
                      if (count === 0) return null;
                      return (
                        <span
                          key={level.value}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${level.classes}`}
                          title={`${count} ${level.label}`}
                        >
                          {count}
                        </span>
                      );
                    })}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 ml-1">
                      <Users className="w-3 h-3" />
                      {contacts.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap">Level:</span>
            <select
              value={activeLevel}
              onChange={(e) => setActiveLevel(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {INFLUENCE_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label} ({levelCounts[l.value] || 0})
                </option>
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
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
            Export CSV
          </Button>
        </div>

        {/* Active level section header */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${activeLevelConfig?.badge}`}>
            <activeLevelConfig.icon className="w-4 h-4" />
            {activeLevelConfig?.label}
          </span>
          <span className="text-sm text-gray-500">
            {filteredContacts.length} contact{filteredContacts.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Contact cards grouped by firm */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-gray-500">Loading contacts…</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-sm">
            <Trophy className="w-8 h-8 mb-2 opacity-40" />
            No contacts in this influence level.
          </div>
        ) : firmBreakdown.length === 0 ? (
          /* Contacts with no firm links — show flat grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredContacts.map((c) => (
              <InfluenceContactCard
                key={c.id}
                contact={c}
                firmName={null}
                onFirmClick={() => {}}
                score={c.score}
                tierLabel={c.tier.label}
                tierClasses={c.tier.classes}
                tierStar={c.tier.star}
                firmCount={c.firmCount}
                boardCount={c.boardCount}
              />
            ))}
          </div>
        ) : (
          /* Grouped by firm — expandable sections */
          <div className="space-y-3">
            {firmBreakdown.map(({ firm, contacts: firmContacts }) => {
              const isExpanded = expandedFirms.has(firm.id) || firmBreakdown.length <= 3;
              return (
                <div key={firm.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleFirm(firm.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-gray-800 truncate">{firm.name}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                      {firmContacts.length}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto hidden sm:block">
                      {firm.firm_type || (firm.firm_types || []).join(", ") || ""}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-gray-100 pt-3">
                      {firmContacts.map((c) => (
                        <InfluenceContactCard
                          key={c.id}
                          contact={c}
                          firmName={firm.name}
                          onFirmClick={() => handleFirmClick(firm.id)}
                          score={c.score}
                          tierLabel={c.tier.label}
                          tierClasses={c.tier.classes}
                          tierStar={c.tier.star}
                          firmCount={c.firmCount}
                          boardCount={c.boardCount}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Influence score = (linked firms) + (board meetings × 2) + (product team seats).
          Tiers: Emerging (0–2) · Connected (3–7) · Influencer (8–15) · Key Influencer (16+).
        </p>
      </div>
    </div>
  );
}