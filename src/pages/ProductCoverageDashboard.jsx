import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Search, Package, Building, UserCircle2, ArrowUpDown, Filter, X, Download } from "lucide-react";
import XponanceAssignmentCell from "@/components/xponance/XponanceAssignmentCell";
import AnalystBreakdownSection from "@/components/coverage/AnalystBreakdownSection";
import AnalystRegionCoverageHeatmap from "@/components/coverage/AnalystRegionCoverageHeatmap";
import AnalystCoverageMap from "@/components/coverage/AnalystCoverageMap";
import { buildCoverageMapPoints } from "@/components/coverage/coverageGeo";
import BulkReassignBar from "@/components/coverage/BulkReassignBar";
import CoverageContactsTable from "@/components/coverage/CoverageContactsTable";
import { Checkbox } from "@/components/ui/checkbox";

const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];

export default function ProductCoverageDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const tenantFirmId = user?.linked_firm_id;

  const handleAssignmentSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  const [search, setSearch] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [firmNameFilter, setFirmNameFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [primaryAnalystFilter, setPrimaryAnalystFilter] = useState("");
  const [secondaryAnalystFilter, setSecondaryAnalystFilter] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [coveredAnalystId, setCoveredAnalystId] = useState("");
  const [viewMode, setViewMode] = useState("products"); // "products" | "contacts"

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 5000),
    select: (data) => data.filter((p) => !p.deleted_at),
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
    select: (data) => data.filter((c) => !c.deleted_at),
  });

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    select: (data) => data.filter((f) => !f.deleted_at),
  });

  const xponanceContacts = useMemo(() => {
    if (!tenantFirmId) return [];
    return contacts.filter((c) => (c.firm_ids || []).includes(tenantFirmId));
  }, [contacts, tenantFirmId]);

  const firmMap = useMemo(
    () => Object.fromEntries(firms.map((f) => [f.id, f])),
    [firms]
  );

  // Count how many products each Xponance contact is assigned to (Products view)
  const productAssignmentCounts = useMemo(() => {
    const counts = {};
    for (const p of products) {
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
  }, [products]);

  // Count how many (non-Xponance) contacts each Xponance contact is assigned to (Contacts view)
  const contactAssignmentCounts = useMemo(() => {
    const counts = {};
    const nonXponance = contacts.filter((c) => !(c.firm_ids || []).includes(tenantFirmId));
    for (const c of nonXponance) {
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
  }, [contacts, tenantFirmId]);

  const assignmentCounts = viewMode === "products" ? productAssignmentCounts : contactAssignmentCounts;

  // Geographic map points — one pin per product firm with active assignments, sized by assignment count
  const coverageMapPoints = useMemo(
    () => buildCoverageMapPoints(products, (p) => p.firm_id, firmMap),
    [products, firmMap]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products;
    if (productTypeFilter) {
      list = list.filter((p) => p.product_type === productTypeFilter);
    }
    if (firmNameFilter) {
      list = list.filter((p) => p.firm_id === firmNameFilter);
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
    if (coveredAnalystId) {
      list = list.filter((p) => p.primary_xponance_contact_id === coveredAnalystId || p.secondary_xponance_contact_id === coveredAnalystId);
    }
    if (q) {
      list = list.filter((p) => {
        const nameMatch = (p.name || "").toLowerCase().includes(q);
        const firmMatch = (p.firm_name || "").toLowerCase().includes(q);
        const primaryMatch = (p.primary_xponance_contact_name || "").toLowerCase().includes(q);
        const secondaryMatch = (p.secondary_xponance_contact_name || "").toLowerCase().includes(q);
        return nameMatch || firmMatch || primaryMatch || secondaryMatch;
      });
    }
    const sorted = [...list];
    if (sortKey === "name") {
      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortKey === "firm") {
      sorted.sort((a, b) => (a.firm_name || "zzz").localeCompare(b.firm_name || "zzz"));
    } else if (sortKey === "primary") {
      sorted.sort((a, b) => (a.primary_xponance_contact_name || "zzz").localeCompare(b.primary_xponance_contact_name || "zzz"));
    } else if (sortKey === "secondary") {
      sorted.sort((a, b) => (a.secondary_xponance_contact_name || "zzz").localeCompare(b.secondary_xponance_contact_name || "zzz"));
    }
    return sorted;
  }, [products, search, productTypeFilter, firmNameFilter, assignmentFilter, primaryAnalystFilter, secondaryAnalystFilter, sortKey, coveredAnalystId]);

  const hasFilters = search.trim() || productTypeFilter || firmNameFilter || assignmentFilter || primaryAnalystFilter || secondaryAnalystFilter || coveredAnalystId;
  const clearFilters = () => { setSearch(""); setProductTypeFilter(""); setFirmNameFilter(""); setAssignmentFilter(""); setPrimaryAnalystFilter(""); setSecondaryAnalystFilter(""); setCoveredAnalystId(""); };

  const sortedXponanceContacts = useMemo(() => {
    return [...xponanceContacts].sort((a, b) => {
      const an = [a.first_name, a.last_name].filter(Boolean).join(" ");
      const bn = [b.first_name, b.last_name].filter(Boolean).join(" ");
      return an.localeCompare(bn);
    });
  }, [xponanceContacts]);

  const loading = productsLoading || contactsLoading || firmsLoading;

  const productsWithPrimary = products.filter((p) => p.primary_xponance_contact_id).length;
  const productsWithSecondary = products.filter((p) => p.secondary_xponance_contact_id).length;
  const productsUnassignedPrimary = products.filter((p) => !p.primary_xponance_contact_id).length;
  const productsUnassignedSecondary = products.filter((p) => !p.secondary_xponance_contact_id).length;

  // Contacts view: non-Xponance contacts with Xponance assignments, filtered to match the active filters
  const nonXponanceContacts = useMemo(
    () => contacts.filter((c) => !(c.firm_ids || []).includes(tenantFirmId)),
    [contacts, tenantFirmId]
  );
  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = nonXponanceContacts;
    if (firmNameFilter) {
      list = list.filter((c) => (c.firm_ids || []).includes(firmNameFilter));
    }
    if (assignmentFilter === "assigned") {
      list = list.filter((c) => c.primary_xponance_contact_id || c.secondary_xponance_contact_id);
    } else if (assignmentFilter === "unassigned") {
      list = list.filter((c) => !c.primary_xponance_contact_id && !c.secondary_xponance_contact_id);
    } else if (assignmentFilter === "has_primary") {
      list = list.filter((c) => c.primary_xponance_contact_id);
    } else if (assignmentFilter === "has_secondary") {
      list = list.filter((c) => c.secondary_xponance_contact_id);
    } else if (assignmentFilter === "unassigned_primary") {
      list = list.filter((c) => !c.primary_xponance_contact_id);
    } else if (assignmentFilter === "unassigned_secondary") {
      list = list.filter((c) => !c.secondary_xponance_contact_id);
    }
    if (coveredAnalystId) {
      list = list.filter((c) => c.primary_xponance_contact_id === coveredAnalystId || c.secondary_xponance_contact_id === coveredAnalystId);
    }
    if (q) {
      list = list.filter((c) => {
        const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ").toLowerCase();
        const primaryMatch = (c.primary_xponance_contact_name || "").toLowerCase().includes(q);
        const secondaryMatch = (c.secondary_xponance_contact_name || "").toLowerCase().includes(q);
        return name.includes(q) || primaryMatch || secondaryMatch;
      });
    }
    return [...list].sort((a, b) =>
      [a.first_name, a.last_name].filter(Boolean).join(" ").localeCompare([b.first_name, b.last_name].filter(Boolean).join(" "))
    );
  }, [nonXponanceContacts, search, firmNameFilter, assignmentFilter, coveredAnalystId]);

  const contactsWithPrimary = nonXponanceContacts.filter((c) => c.primary_xponance_contact_id).length;
  const contactsWithSecondary = nonXponanceContacts.filter((c) => c.secondary_xponance_contact_id).length;
  const contactsUnassignedPrimary = nonXponanceContacts.filter((c) => !c.primary_xponance_contact_id).length;
  const contactsUnassignedSecondary = nonXponanceContacts.filter((c) => !c.secondary_xponance_contact_id).length;

  // View-aware header stats
  const statsWithPrimary = viewMode === "products" ? productsWithPrimary : contactsWithPrimary;
  const statsWithSecondary = viewMode === "products" ? productsWithSecondary : contactsWithSecondary;
  const statsUnassignedPrimary = viewMode === "products" ? productsUnassignedPrimary : contactsUnassignedPrimary;
  const statsUnassignedSecondary = viewMode === "products" ? productsUnassignedSecondary : contactsUnassignedSecondary;
  const entityLabel = viewMode === "products" ? "Products" : "Contacts";

  const selectedProducts = useMemo(
    () => filteredProducts.filter((p) => selectedIds.has(p.id)),
    [filteredProducts, selectedIds]
  );

  const allFilteredSelected =
    filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (filteredProducts.every((p) => prev.has(p.id))) {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.delete(p.id));
        return next;
      }
      const next = new Set(prev);
      filteredProducts.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDone = () => {
    clearSelection();
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  const handleExportCsv = () => {
    const rows = [
      ["Product", "Firm", "Product Type", "Primary Analyst", "Secondary Analyst"],
      ...filteredProducts.map((p) => [
        p.name || "",
        p.firm_name || "",
        p.product_type || "",
        p.primary_xponance_contact_name || "",
        p.secondary_xponance_contact_name || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product-coverage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportContactsCsv = () => {
    const rows = [
      ["Contact", "Firm", "Primary Analyst", "Secondary Analyst"],
      ...filteredContacts.map((c) => {
        const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
        const firmName = (c.firm_ids || []).map((fid) => firmMap[fid]?.name).filter(Boolean).join(", ");
        return [name, firmName, c.primary_xponance_contact_name || "", c.secondary_xponance_contact_name || ""];
      }),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product-coverage-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Product Coverage
              </h1>
              <p className="text-xs text-white/70 mt-0.5">
                Primary & secondary Xponance analyst assignments across products
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
                <div className="font-bold text-lg">{statsWithPrimary}</div>
                <div className="text-white/60 text-[10px]">{entityLabel} w/ Primary</div>
              </button>
              <button
                onClick={() => setAssignmentFilter(assignmentFilter === "has_secondary" ? "" : "has_secondary")}
                className={`rounded-lg px-3 py-1.5 text-center transition-colors ${assignmentFilter === "has_secondary" ? "bg-white/40 ring-2 ring-white/70" : "bg-white/15 hover:bg-white/25"}`}
              >
                <div className="font-bold text-lg">{statsWithSecondary}</div>
                <div className="text-white/60 text-[10px]">{entityLabel} w/ Secondary</div>
              </button>
              <button
                onClick={() => setAssignmentFilter(assignmentFilter === "unassigned_primary" ? "" : "unassigned_primary")}
                className={`rounded-lg px-3 py-1.5 text-center transition-colors ${assignmentFilter === "unassigned_primary" ? "bg-white/40 ring-2 ring-white/70" : "bg-white/15 hover:bg-white/25"}`}
              >
                <div className="font-bold text-lg">{statsUnassignedPrimary}</div>
                <div className="text-white/60 text-[10px]">Unassigned Primary</div>
              </button>
              <button
                onClick={() => setAssignmentFilter(assignmentFilter === "unassigned_secondary" ? "" : "unassigned_secondary")}
                className={`rounded-lg px-3 py-1.5 text-center transition-colors ${assignmentFilter === "unassigned_secondary" ? "bg-white/40 ring-2 ring-white/70" : "bg-white/15 hover:bg-white/25"}`}
              >
                <div className="font-bold text-lg">{statsUnassignedSecondary}</div>
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
                placeholder="Search by product, firm, or analyst..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("products")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "products" ? "bg-white text-violet-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Package className="w-4 h-4" />
                Products
              </button>
              <button
                onClick={() => setViewMode("contacts")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "contacts" ? "bg-white text-violet-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <UserCircle2 className="w-4 h-4" />
                Contacts
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="h-10 rounded-lg border border-gray-200 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="name">Sort: Product Name (A-Z)</option>
                <option value="firm">Sort: Firm Name</option>
                <option value="primary">Sort: Primary Analyst</option>
                <option value="secondary">Sort: Secondary Analyst</option>
              </select>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={productTypeFilter}
              onChange={(e) => setProductTypeFilter(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              <option value="">All Product Types</option>
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={firmNameFilter}
              onChange={(e) => setFirmNameFilter(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 max-w-[220px] focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              <option value="">All Firms</option>
              {[...firms]
                .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                .map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
            </select>
            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
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
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 max-w-[200px] focus:outline-none focus:ring-1 focus:ring-violet-400"
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
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 max-w-[200px] focus:outline-none focus:ring-1 focus:ring-violet-400"
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
              Showing {viewMode === "products" ? filteredProducts.length : filteredContacts.length} {viewMode === "products" ? "products" : "contacts"}
            </span>
            <button
              onClick={viewMode === "products" ? handleExportCsv : handleExportContactsCsv}
              disabled={(viewMode === "products" ? filteredProducts : filteredContacts).length === 0}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-gray-600 hover:text-violet-600 hover:bg-violet-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div className="w-8 h-8 border-4 border-gray-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : viewMode === "products" ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 w-[44px]">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all products"
                      />
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[28%]">Product</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[18%]">Firm</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[24%]">Primary Analyst</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[24%]">Secondary Analyst</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-sm text-gray-400 italic">
                        No products match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-violet-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            onCheckedChange={() => toggleSelect(product.id)}
                            aria-label={`Select ${product.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-violet-50 flex items-center justify-center flex-shrink-0">
                              <Package className="w-3.5 h-3.5 text-violet-400" />
                            </div>
                            <div className="min-w-0">
                              <Link to={`/Home?openProduct=${product.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-violet-600 hover:text-violet-800 hover:underline truncate block">
                                {product.name}
                              </Link>
                              {product.product_type && (
                                <p className="text-xs text-gray-400 truncate">{product.product_type}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Building className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-600 truncate">{product.firm_name || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <XponanceAssignmentCell
                            entityType="Product"
                            entityId={product.id}
                            role="primary"
                            value={{ contact_id: product.primary_xponance_contact_id, contact_name: product.primary_xponance_contact_name }}
                            excludeId={product.secondary_xponance_contact_id}
                            xponanceContacts={xponanceContacts}
                            onSaved={handleAssignmentSaved}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <XponanceAssignmentCell
                            entityType="Product"
                            entityId={product.id}
                            role="secondary"
                            value={{ contact_id: product.secondary_xponance_contact_id, contact_name: product.secondary_xponance_contact_name }}
                            excludeId={product.primary_xponance_contact_id}
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
        ) : (
          <CoverageContactsTable
            contacts={filteredContacts}
            firms={firms}
            xponanceContacts={xponanceContacts}
            onSaved={handleAssignmentSaved}
            rowHoverClass="hover:bg-violet-50/30"
            linkClass="text-violet-600 hover:text-violet-800"
          />
        )}

        {/* Bulk reassign bar */}
        {selectedProducts.length > 0 && (
          <BulkReassignBar
            selectedItems={selectedProducts}
            entityType="Product"
            xponanceContacts={xponanceContacts}
            onDone={handleBulkDone}
            onClear={clearSelection}
          />
        )}

        <AnalystRegionCoverageHeatmap
          products={products}
          firmMap={firmMap}
          xponanceContacts={xponanceContacts}
        />

        <AnalystCoverageMap
          points={coverageMapPoints}
          themeColor="#8b5cf6"
          title="Product Coverage Map"
          emptyText="No products with active assignments have mapped firm locations yet."
        />

        <AnalystBreakdownSection
          title="Xponance Analysts"
          icon={<UserCircle2 className="w-4 h-4 text-violet-600" />}
          theme="violet"
          xponanceContacts={xponanceContacts}
          assignmentCounts={assignmentCounts}
          coveredAnalystId={coveredAnalystId}
          onCoveredAnalystClick={(id) => { setCoveredAnalystId(id); if (id) { setPrimaryAnalystFilter(""); setSecondaryAnalystFilter(""); } }}
          coveredLabel="Click to show products this analyst covers"
        />
      </div>
    </div>
  );
}