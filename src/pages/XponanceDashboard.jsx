import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Search, Building, User, UserCircle2, ArrowUpDown, Filter, X, MapPin } from "lucide-react";
import XponanceContactBadges from "@/components/xponance/XponanceContactBadges";
import XponanceAssignmentCell from "@/components/xponance/XponanceAssignmentCell";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const getFirmTypes = (f) =>
  f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];

const getContactName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

export default function XponanceDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantFirmId = user?.linked_firm_id;

  const handleAssignmentSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["firms"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  const [search, setSearch] = useState("");
  const [firmTypeFilter, setFirmTypeFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState(""); // "assigned" | "unassigned" | ""
  const [viewMode, setViewMode] = useState("firms"); // "firms" | "contacts"
  const [sortKey, setSortKey] = useState("name"); // "name" | "primary" | "secondary"

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    select: (data) => data.filter((f) => !f.deleted_at),
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
    select: (data) => data.filter((c) => !c.deleted_at),
  });

  // Xponance contacts = contacts whose firm_ids includes the tenant firm ID
  const xponanceContacts = useMemo(() => {
    if (!tenantFirmId) return [];
    return contacts.filter((c) => (c.firm_ids || []).includes(tenantFirmId));
  }, [contacts, tenantFirmId]);

  // Build a map of Xponance contact ID → contact for reverse lookup
  const xponanceContactMap = useMemo(
    () => Object.fromEntries(xponanceContacts.map((c) => [c.id, c])),
    [xponanceContacts]
  );

  // Count how many firms/contacts each Xponance contact is assigned to
  const assignmentCounts = useMemo(() => {
    const counts = {};
    for (const f of firms) {
      if (f.primary_xponance_contact_id) {
        counts[f.primary_xponance_contact_id] = counts[f.primary_xponance_contact_id] || { primary: 0, secondary: 0 };
        counts[f.primary_xponance_contact_id].primary++;
      }
      if (f.secondary_xponance_contact_id) {
        counts[f.secondary_xponance_contact_id] = counts[f.secondary_xponance_contact_id] || { primary: 0, secondary: 0 };
        counts[f.secondary_xponance_contact_id].secondary++;
      }
    }
    for (const c of contacts) {
      if (c.primary_xponance_contact_id) {
        counts[c.primary_xponance_contact_id] = counts[c.primary_xponance_contact_id] || { primary: 0, secondary: 0 };
        counts[c.primary_xponance_contact_id].primary++;
      }
      if (c.secondary_xponance_contact_id) {
        counts[c.secondary_xponance_contact_id] = counts[c.secondary_xponance_contact_id] || { primary: 0, secondary: 0 };
        counts[c.secondary_xponance_contact_id].secondary++;
      }
    }
    return counts;
  }, [firms, contacts]);

  // Filtered + sorted firms
  const filteredFirms = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = firms;
    if (firmTypeFilter) {
      list = list.filter((f) => getFirmTypes(f).includes(firmTypeFilter));
    }
    if (assignmentFilter === "assigned") {
      list = list.filter((f) => f.primary_xponance_contact_id || f.secondary_xponance_contact_id);
    } else if (assignmentFilter === "unassigned") {
      list = list.filter((f) => !f.primary_xponance_contact_id && !f.secondary_xponance_contact_id);
    }
    if (q) {
      list = list.filter((f) => {
        const nameMatch = f.name.toLowerCase().includes(q);
        const primaryMatch = (f.primary_xponance_contact_name || "").toLowerCase().includes(q);
        const secondaryMatch = (f.secondary_xponance_contact_name || "").toLowerCase().includes(q);
        return nameMatch || primaryMatch || secondaryMatch;
      });
    }
    // Sort
    const sorted = [...list];
    if (sortKey === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortKey === "primary") {
      sorted.sort((a, b) => (a.primary_xponance_contact_name || "zzz").localeCompare(b.primary_xponance_contact_name || "zzz"));
    } else if (sortKey === "secondary") {
      sorted.sort((a, b) => (a.secondary_xponance_contact_name || "zzz").localeCompare(b.secondary_xponance_contact_name || "zzz"));
    }
    return sorted;
  }, [firms, search, firmTypeFilter, assignmentFilter, sortKey]);

  // Filtered + sorted contacts (non-Xponance contacts that have Xponance assignments)
  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = contacts.filter((c) => !(c.firm_ids || []).includes(tenantFirmId)); // exclude Xponance's own contacts
    if (assignmentFilter === "assigned") {
      list = list.filter((c) => c.primary_xponance_contact_id || c.secondary_xponance_contact_id);
    } else if (assignmentFilter === "unassigned") {
      list = list.filter((c) => !c.primary_xponance_contact_id && !c.secondary_xponance_contact_id);
    }
    if (q) {
      list = list.filter((c) => {
        const name = getContactName(c).toLowerCase();
        const primaryMatch = (c.primary_xponance_contact_name || "").toLowerCase().includes(q);
        const secondaryMatch = (c.secondary_xponance_contact_name || "").toLowerCase().includes(q);
        return name.includes(q) || primaryMatch || secondaryMatch;
      });
    }
    const sorted = [...list];
    if (sortKey === "name") {
      sorted.sort((a, b) => getContactName(a).localeCompare(getContactName(b)));
    } else if (sortKey === "primary") {
      sorted.sort((a, b) => (a.primary_xponance_contact_name || "zzz").localeCompare(b.primary_xponance_contact_name || "zzz"));
    } else if (sortKey === "secondary") {
      sorted.sort((a, b) => (a.secondary_xponance_contact_name || "zzz").localeCompare(b.secondary_xponance_contact_name || "zzz"));
    }
    return sorted;
  }, [contacts, tenantFirmId, search, assignmentFilter, sortKey]);

  const hasFilters = search.trim() || firmTypeFilter || assignmentFilter;
  const clearFilters = () => { setSearch(""); setFirmTypeFilter(""); setAssignmentFilter(""); };

  const loading = firmsLoading || contactsLoading;

  // Stats
  const firmsWithPrimary = firms.filter((f) => f.primary_xponance_contact_id).length;
  const firmsWithSecondary = firms.filter((f) => f.secondary_xponance_contact_id).length;
  const firmsUnassigned = firms.filter((f) => !f.primary_xponance_contact_id && !f.secondary_xponance_contact_id).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Building className="w-5 h-5" />
                Xponance Dashboard
              </h1>
              <p className="text-xs text-white/70 mt-0.5">
                Primary & secondary Xponance contact assignments across firms and contacts
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                <div className="font-bold text-lg">{xponanceContacts.length}</div>
                <div className="text-white/60 text-[10px]">Xponance Contacts</div>
              </div>
              <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                <div className="font-bold text-lg">{firmsWithPrimary}</div>
                <div className="text-white/60 text-[10px]">Firms w/ Primary</div>
              </div>
              <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                <div className="font-bold text-lg">{firmsWithSecondary}</div>
                <div className="text-white/60 text-[10px]">Firms w/ Secondary</div>
              </div>
              <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                <div className="font-bold text-lg">{firmsUnassigned}</div>
                <div className="text-white/60 text-[10px]">Unassigned</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={viewMode === "firms" ? "Search by firm name or Xponance contact..." : "Search by contact name or Xponance contact..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("firms")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "firms" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Building className="w-4 h-4" />
                Firms
              </button>
              <button
                onClick={() => setViewMode("contacts")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "contacts" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <User className="w-4 h-4" />
                Contacts
              </button>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="h-10 rounded-lg border border-gray-200 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="name">Sort: Name (A-Z)</option>
                <option value="primary">Sort: Primary Contact</option>
                <option value="secondary">Sort: Secondary Contact</option>
              </select>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            {viewMode === "firms" && (
              <select
                value={firmTypeFilter}
                onChange={(e) => setFirmTypeFilter(e.target.value)}
                className="h-8 rounded-lg border border-gray-200 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="">All Firm Types</option>
                {FIRM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="">All Assignments</option>
              <option value="assigned">Has Assignment</option>
              <option value="unassigned">No Assignment</option>
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
            <span className="text-xs text-gray-400 ml-auto">
              Showing {viewMode === "firms" ? filteredFirms.length : filteredContacts.length} {viewMode === "firms" ? "firms" : "contacts"}
            </span>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : viewMode === "firms" ? (
          /* Firms table */
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Firm</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Type</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Primary Xponance Contact</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Secondary Xponance Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredFirms.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-sm text-gray-400 italic">
                        No firms match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredFirms.map((firm) => {
                      const types = getFirmTypes(firm);
                      return (
                        <tr key={firm.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {firm.logo_url ? (
                                <img src={firm.logo_url} alt="" className="w-7 h-7 rounded object-contain flex-shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <Building className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <Link to={`/Home?openFirm=${firm.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline truncate">{firm.name}</Link>
                                {firm.location && (
                                  <p className="text-xs text-gray-400 flex items-center gap-0.5">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate max-w-[180px]">{firm.location}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {types.map((t) => (
                                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <XponanceAssignmentCell
                              entityType="Firm"
                              entityId={firm.id}
                              role="primary"
                              value={{ contact_id: firm.primary_xponance_contact_id, contact_name: firm.primary_xponance_contact_name }}
                              excludeId={firm.secondary_xponance_contact_id}
                              xponanceContacts={xponanceContacts}
                              onSaved={handleAssignmentSaved}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <XponanceAssignmentCell
                              entityType="Firm"
                              entityId={firm.id}
                              role="secondary"
                              value={{ contact_id: firm.secondary_xponance_contact_id, contact_name: firm.secondary_xponance_contact_name }}
                              excludeId={firm.primary_xponance_contact_id}
                              xponanceContacts={xponanceContacts}
                              onSaved={handleAssignmentSaved}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Contacts view */
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Contact</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Firm</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Primary Xponance Contact</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Secondary Xponance Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-sm text-gray-400 italic">
                        No contacts match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map((contact) => {
                      const firmName = (contact.firm_ids || [])
                        .map((fid) => firms.find((f) => f.id === fid)?.name)
                        .filter(Boolean)
                        .join(", ");
                      return (
                        <tr key={contact.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {contact.photo_url ? (
                                <img src={contact.photo_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                                  <UserCircle2 className="w-4 h-4 text-pink-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <Link to={`/Home?openContact=${contact.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline truncate">{getContactName(contact)}</Link>
                                {contact.title && <p className="text-xs text-gray-400 truncate">{contact.title}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">{firmName || "—"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <XponanceAssignmentCell
                              entityType="Contact"
                              entityId={contact.id}
                              role="primary"
                              value={{ contact_id: contact.primary_xponance_contact_id, contact_name: contact.primary_xponance_contact_name }}
                              excludeId={contact.secondary_xponance_contact_id}
                              xponanceContacts={xponanceContacts}
                              onSaved={handleAssignmentSaved}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <XponanceAssignmentCell
                              entityType="Contact"
                              entityId={contact.id}
                              role="secondary"
                              value={{ contact_id: contact.secondary_xponance_contact_id, contact_name: contact.secondary_xponance_contact_name }}
                              excludeId={contact.primary_xponance_contact_id}
                              xponanceContacts={xponanceContacts}
                              onSaved={handleAssignmentSaved}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Xponance contacts summary — shows all Xponance contacts and their assignment counts */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <UserCircle2 className="w-4 h-4 text-indigo-600" />
            Xponance Contacts ({xponanceContacts.length})
          </h3>
          {xponanceContacts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No contacts found related to the Xponance firm.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {xponanceContacts
                .sort((a, b) => getContactName(a).localeCompare(getContactName(b)))
                .map((c) => {
                  const counts = assignmentCounts[c.id] || { primary: 0, secondary: 0 };
                  const total = counts.primary + counts.secondary;
                  return (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <UserCircle2 className="w-4 h-4 text-indigo-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{getContactName(c)}</p>
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