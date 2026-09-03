import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Search, LayoutList, Building, UserCircle2, ArrowUpDown, Filter, X, Download, BarChart3 } from "lucide-react";
import XponanceAssignmentCell from "@/components/xponance/XponanceAssignmentCell";
import AnalystAssignmentChart from "@/components/coverage/AnalystAssignmentChart";

const ADVISOR_TYPES = ["Investment Manager"];

export default function PortfolioCoverageDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const tenantFirmId = user?.linked_firm_id;

  const handleAssignmentSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    queryClient.invalidateQueries({ queryKey: ["portfolios-all"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  const [search, setSearch] = useState("");
  const [advisorTypeFilter, setAdvisorTypeFilter] = useState("");
  const [allocatorFilter, setAllocatorFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [primaryAnalystFilter, setPrimaryAnalystFilter] = useState("");
  const [secondaryAnalystFilter, setSecondaryAnalystFilter] = useState("");
  const [sortKey, setSortKey] = useState("name");

  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery({
    queryKey: ["portfolios-all"],
    queryFn: () => base44.entities.Portfolio.list("-created_date", 5000),
    select: (data) => data.filter((p) => !p.deleted_at),
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
    select: (data) => data.filter((c) => !c.deleted_at),
  });

  const xponanceContacts = useMemo(() => {
    if (!tenantFirmId) return [];
    return contacts.filter((c) => (c.firm_ids || []).includes(tenantFirmId));
  }, [contacts, tenantFirmId]);

  // Count how many portfolios each Xponance contact is assigned to
  const assignmentCounts = useMemo(() => {
    const counts = {};
    for (const p of portfolios) {
      if (p.primary_xponance_contact_id) {
        counts[p.primary_xponance_contact_id] = counts[p.primary_xponance_contact_id] || { primary: 0, secondary: 0 };
        counts[p.primary_xponance_contact_id].primary++;
      }
      if (p.secondary_xponance_contact_id) {
        counts[p.secondary_xponance_contact_id] = counts[p.secondary_xponance_contact_id] || { primary: 0, secondary: 0 };
        counts[p.secondary_xponance_contact_id].secondary++;
      }
    }
    return counts;
  }, [portfolios]);

  const allocatorOptions = useMemo(
    () => Array.from(new Set(portfolios.map((p) => p.allocator_name).filter(Boolean))).sort(),
    [portfolios]
  );

  const filteredPortfolios = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = portfolios;
    if (advisorTypeFilter) {
      list = list.filter((p) => (p.advisor_type || "No Advisor") === advisorTypeFilter);
    }
    if (allocatorFilter) {
      list = list.filter((p) => (p.allocator_name || "Unknown") === allocatorFilter);
    }
    if (assignmentFilter === "assigned") {
      list = list.filter((p) => p.primary_xponance_contact_id || p.secondary_xponance_contact_id);
    } else if (assignmentFilter === "unassigned") {
      list = list.filter((p) => !p.primary_xponance_contact_id && !p.secondary_xponance_contact_id);
    } else if (assignmentFilter === "has_primary") {
      list = list.filter((p) => p.primary_xponance_contact_id);
    } else if (assignmentFilter === "has_secondary") {
      list = list.filter((p) => p.secondary_xponance_contact_id);
    } else if (assignmentFilter === "unassigned_primary") {
      list = list.filter((p) => !p.primary_xponance_contact_id);
    } else if (assignmentFilter === "unassigned_secondary") {
      list = list.filter((p) => !p.secondary_xponance_contact_id);
    }
    if (primaryAnalystFilter) {
      list = list.filter((p) => p.primary_xponance_contact_id === primaryAnalystFilter);
    }
    if (secondaryAnalystFilter) {
      list = list.filter((p) => p.secondary_xponance_contact_id === secondaryAnalystFilter);
    }
    if (q) {
      list = list.filter((p) => {
        const nameMatch = (p.portfolio_name || "").toLowerCase().includes(q);
        const allocatorMatch = (p.allocator_name || "").toLowerCase().includes(q);
        const advisorMatch = (p.advisor_firm_name || "").toLowerCase().includes(q);
        const primaryMatch = (p.primary_xponance_contact_name || "").toLowerCase().includes(q);
        const secondaryMatch = (p.secondary_xponance_contact_name || "").toLowerCase().includes(q);
        return nameMatch || allocatorMatch || advisorMatch || primaryMatch || secondaryMatch;
      });
    }
    const sorted = [...list];
    if (sortKey === "name") {
      sorted.sort((a, b) => (a.portfolio_name || "").localeCompare(b.portfolio_name || ""));
    } else if (sortKey === "allocator") {
      sorted.sort((a, b) => (a.allocator_name || "zzz").localeCompare(b.allocator_name || "zzz"));
    } else if (sortKey === "primary") {
      sorted.sort((a, b) => (a.primary_xponance_contact_name || "zzz").localeCompare(b.primary_xponance_contact_name || "zzz"));
    } else if (sortKey === "secondary") {
      sorted.sort((a, b) => (a.secondary_xponance_contact_name || "zzz").localeCompare(b.secondary_xponance_contact_name || "zzz"));
    }
    return sorted;
  }, [portfolios, search, advisorTypeFilter, allocatorFilter, assignmentFilter, primaryAnalystFilter, secondaryAnalystFilter, sortKey]);

  const hasFilters = search.trim() || advisorTypeFilter || allocatorFilter || assignmentFilter || primaryAnalystFilter || secondaryAnalystFilter;
  const clearFilters = () => {
    setSearch(""); setAdvisorTypeFilter(""); setAllocatorFilter(""); setAssignmentFilter("");
    setPrimaryAnalystFilter(""); setSecondaryAnalystFilter("");
  };

  const sortedXponanceContacts = useMemo(() => {
    return [...xponanceContacts].sort((a, b) => {
      const an = [a.first_name, a.last_name].filter(Boolean).join(" ");
      const bn = [b.first_name, b.last_name].filter(Boolean).join(" ");
      return an.localeCompare(bn);
    });
  }, [xponanceContacts]);

  const loading = portfoliosLoading || contactsLoading;

  const portfoliosWithPrimary = portfolios.filter((p) => p.primary_xponance_contact_id).length;
  const portfoliosWithSecondary = portfolios.filter((p) => p.secondary_xponance_contact_id).length;
  const portfoliosUnassignedPrimary = portfolios.filter((p) => !p.primary_xponance_contact_id).length;
  const portfoliosUnassignedSecondary = portfolios.filter((p) => !p.secondary_xponance_contact_id).length;

  const handleExportCsv = () => {
    const rows = [
      ["Portfolio", "Allocator", "Advisor Firm", "Primary Analyst", "Secondary Analyst"],
      ...filteredPortfolios.map((p) => [
        p.portfolio_name || "",
        p.allocator_name || "",
        p.advisor_firm_name || "",
        p.primary_xponance_contact_name || "",
        p.secondary_xponance_contact_name || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-coverage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <LayoutList className="w-5 h-5" />
                Portfolio Coverage
              </h1>
              <p className="text-xs text-white/70 mt-0.5">
                Primary & secondary Xponance analyst assignments across client portfolios
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                <div className="font-bold text-lg">{xponanceContacts.length}</div>
                <div className="text-white/60 text-[10px]">Xponance Contacts</div>
              </div>
              <button
                onClick={() => setAssignmentFilter(assignmentFilter === "has_primary" ? "" : "has_primary")}
                className={`rounded-lg px-3 py-1.5 text-center transition-colors ${assignmentFilter === "has_primary" ? "bg-white/40 ring-2 ring-white/70" : "bg-white/15 hover:bg-white/25"}`}
              >
                <div className="font-bold text-lg">{portfoliosWithPrimary}</div>
                <div className="text-white/60 text-[10px]">Portfolios w/ Primary</div>
              </button>
              <button
                onClick={() => setAssignmentFilter(assignmentFilter === "has_secondary" ? "" : "has_secondary")}
                className={`rounded-lg px-3 py-1.5 text-center transition-colors ${assignmentFilter === "has_secondary" ? "bg-white/40 ring-2 ring-white/70" : "bg-white/15 hover:bg-white/25"}`}
              >
                <div className="font-bold text-lg">{portfoliosWithSecondary}</div>
                <div className="text-white/60 text-[10px]">Portfolios w/ Secondary</div>
              </button>
              <button
                onClick={() => setAssignmentFilter(assignmentFilter === "unassigned_primary" ? "" : "unassigned_primary")}
                className={`rounded-lg px-3 py-1.5 text-center transition-colors ${assignmentFilter === "unassigned_primary" ? "bg-white/40 ring-2 ring-white/70" : "bg-white/15 hover:bg-white/25"}`}
              >
                <div className="font-bold text-lg">{portfoliosUnassignedPrimary}</div>
                <div className="text-white/60 text-[10px]">Unassigned Primary</div>
              </button>
              <button
                onClick={() => setAssignmentFilter(assignmentFilter === "unassigned_secondary" ? "" : "unassigned_secondary")}
                className={`rounded-lg px-3 py-1.5 text-center transition-colors ${assignmentFilter === "unassigned_secondary" ? "bg-white/40 ring-2 ring-white/70" : "bg-white/15 hover:bg-white/25"}`}
              >
                <div className="font-bold text-lg">{portfoliosUnassignedSecondary}</div>
                <div className="text-white/60 text-[10px]">Unassigned Secondary</div>
              </button>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by portfolio, allocator, advisor, or analyst..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="h-10 rounded-lg border border-gray-200 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="name">Sort: Portfolio Name (A-Z)</option>
                <option value="allocator">Sort: Allocator</option>
                <option value="primary">Sort: Primary Analyst</option>
                <option value="secondary">Sort: Secondary Analyst</option>
              </select>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={advisorTypeFilter}
              onChange={(e) => setAdvisorTypeFilter(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              <option value="">All Advisor Types</option>
              {ADVISOR_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={allocatorFilter}
              onChange={(e) => setAllocatorFilter(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 max-w-[220px] focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              <option value="">All Allocators</option>
              {allocatorOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              <option value="">All Assignments</option>
              <option value="assigned">Has Assignment</option>
              <option value="unassigned">No Assignment</option>
              <option value="has_primary">Has Primary</option>
              <option value="has_secondary">Has Secondary</option>
              <option value="unassigned_primary">Unassigned Primary</option>
              <option value="unassigned_secondary">Unassigned Secondary</option>
            </select>
            <select
              value={primaryAnalystFilter}
              onChange={(e) => setPrimaryAnalystFilter(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 max-w-[200px] focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              <option value="">Primary Analyst: All</option>
              {sortedXponanceContacts.map((c) => {
                const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
                return <option key={c.id} value={c.id}>{name}</option>;
              })}
            </select>
            <select
              value={secondaryAnalystFilter}
              onChange={(e) => setSecondaryAnalystFilter(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 max-w-[200px] focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              <option value="">Secondary Analyst: All</option>
              {sortedXponanceContacts.map((c) => {
                const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
                return <option key={c.id} value={c.id}>{name}</option>;
              })}
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 h-8 px-2 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-3 h-3" />
                Clear filters
              </button>
            )}
            <span className="text-xs text-gray-400">
              Showing {filteredPortfolios.length} portfolios
            </span>
            <button
              onClick={handleExportCsv}
              disabled={filteredPortfolios.length === 0}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export filtered list to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[30%]">Portfolio</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[20%]">Allocator</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[25%]">Primary Analyst</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[25%]">Secondary Analyst</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPortfolios.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-sm text-gray-400 italic">
                        No portfolios match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredPortfolios.map((portfolio) => (
                      <tr key={portfolio.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-emerald-50 flex items-center justify-center flex-shrink-0">
                              <LayoutList className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                            <div className="min-w-0">
                              <Link to={`/Home?openPortfolio=${portfolio.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-emerald-600 hover:text-emerald-800 hover:underline truncate block">
                                {portfolio.portfolio_name}
                              </Link>
                              {portfolio.advisor_firm_name && (
                                <p className="text-xs text-gray-400 truncate">{portfolio.advisor_firm_name}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Building className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-600 truncate">{portfolio.allocator_name || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <XponanceAssignmentCell
                            entityType="Portfolio"
                            entityId={portfolio.id}
                            role="primary"
                            value={{ contact_id: portfolio.primary_xponance_contact_id, contact_name: portfolio.primary_xponance_contact_name }}
                            excludeId={portfolio.secondary_xponance_contact_id}
                            xponanceContacts={xponanceContacts}
                            onSaved={handleAssignmentSaved}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <XponanceAssignmentCell
                            entityType="Portfolio"
                            entityId={portfolio.id}
                            role="secondary"
                            value={{ contact_id: portfolio.secondary_xponance_contact_id, contact_name: portfolio.secondary_xponance_contact_name }}
                            excludeId={portfolio.primary_xponance_contact_id}
                            xponanceContacts={xponanceContacts}
                            onSaved={handleAssignmentSaved}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analyst assignment chart */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            Analyst Assignment Summary
          </h3>
          <AnalystAssignmentChart xponanceContacts={xponanceContacts} assignmentCounts={assignmentCounts} />
        </div>

        {/* Xponance contacts summary */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <UserCircle2 className="w-4 h-4 text-emerald-600" />
            Xponance Analysts ({xponanceContacts.length})
          </h3>
          {xponanceContacts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No contacts found related to the Xponance firm.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {xponanceContacts
                .slice()
                .sort((a, b) => {
                  const ta = (assignmentCounts[a.id]?.primary || 0) + (assignmentCounts[a.id]?.secondary || 0);
                  const tb = (assignmentCounts[b.id]?.primary || 0) + (assignmentCounts[b.id]?.secondary || 0);
                  if (tb !== ta) return tb - ta;
                  const an = [a.first_name, a.last_name].filter(Boolean).join(" ");
                  const bn = [b.first_name, b.last_name].filter(Boolean).join(" ");
                  return an.localeCompare(bn);
                })
                .map((c) => {
                  const counts = assignmentCounts[c.id] || { primary: 0, secondary: 0 };
                  const total = counts.primary + counts.secondary;
                  const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
                  return (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-colors">
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <UserCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                        {c.title && <p className="text-xs text-gray-400 truncate">{c.title}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {counts.primary > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200" title={`${counts.primary} primary assignments`}>
                            P: {counts.primary}
                          </span>
                        )}
                        {counts.secondary > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200" title={`${counts.secondary} secondary assignments`}>
                            S: {counts.secondary}
                          </span>
                        )}
                        {total === 0 && (
                          <span className="text-xs text-gray-300">No assignments</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}