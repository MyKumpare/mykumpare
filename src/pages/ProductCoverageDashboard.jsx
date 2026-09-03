import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Search, Package, Building, UserCircle2, ArrowUpDown, Filter, X, Download } from "lucide-react";
import XponanceAssignmentCell from "@/components/xponance/XponanceAssignmentCell";
import AnalystAssignmentChart from "@/components/coverage/AnalystAssignmentChart";
import BulkReassignBar from "@/components/coverage/BulkReassignBar";
import CoverageStatusBadge, { getCoverageStatus, COVERAGE_STATUS_META } from "@/components/coverage/CoverageStatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart3 } from "lucide-react";

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
  const [coverageStatusFilter, setCoverageStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [selectedIds, setSelectedIds] = useState(() => new Set());

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

  // Count how many products each Xponance contact is assigned to
  const assignmentCounts = useMemo(() => {
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
    }
    if (primaryAnalystFilter) {
      list = list.filter((p) => p.primary_xponance_contact_id === primaryAnalystFilter);
    }
    if (secondaryAnalystFilter) {
      list = list.filter((p) => p.secondary_xponance_contact_id === secondaryAnalystFilter);
    }
    if (coverageStatusFilter) {
      list = list.filter((p) => getCoverageStatus(p) === coverageStatusFilter);
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
  }, [products, search, productTypeFilter, firmNameFilter, assignmentFilter, primaryAnalystFilter, secondaryAnalystFilter, sortKey]);

  const hasFilters = search.trim() || productTypeFilter || firmNameFilter || assignmentFilter || primaryAnalystFilter || secondaryAnalystFilter || coverageStatusFilter;
  const clearFilters = () => { setSearch(""); setProductTypeFilter(""); setFirmNameFilter(""); setAssignmentFilter(""); setPrimaryAnalystFilter(""); setSecondaryAnalystFilter(""); setCoverageStatusFilter(""); };

  const sortedXponanceContacts = useMemo(() => {
    return [...xponanceContacts].sort((a, b) => {
      const an = [a.first_name, a.last_name].filter(Boolean).join(" ");
      const bn = [b.first_name, b.last_name].filter(Boolean).join(" ");
      return an.localeCompare(bn);
    });
  }, [xponanceContacts]);

  const loading = productsLoading || contactsLoading || firmsLoading;

  const productsWithPrimary = products.filter((p) => p.primary_xponance_contact_id).length;
  const productsUnassigned = products.filter((p) => !p.primary_xponance_contact_id && !p.secondary_xponance_contact_id).length;

  const coverageStatusCounts = useMemo(() => {
    const counts = { active: 0, pending: 0, under_review: 0 };
    for (const p of products) counts[getCoverageStatus(p)]++;
    return counts;
  }, [products]);

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
              <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                <div className="font-bold text-lg">{productsWithPrimary}</div>
                <div className="text-white/60 text-[10px]">Products w/ Primary</div>
              </div>
              <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                <div className="font-bold text-lg">{productsUnassigned}</div>
                <div className="text-white/60 text-[10px]">Unassigned</div>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                {Object.entries(coverageStatusCounts).map(([key, count]) => {
                  const meta = COVERAGE_STATUS_META[key];
                  return (
                    <div key={key} className="flex items-center gap-1.5" title={`${meta.label}: ${count} products`}>
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      <span className="text-xs font-semibold">{count}</span>
                      <span className="text-white/60 text-[10px]">{meta.label}</span>
                    </div>
                  );
                })}
              </div>
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
            <select
              value={coverageStatusFilter}
              onChange={(e) => setCoverageStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 text-xs px-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              <option value="">Coverage Status: All</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
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
              Showing {filteredProducts.length} products
            </span>
            <button
              onClick={handleExportCsv}
              disabled={filteredProducts.length === 0}
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
        ) : (
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
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[26%]">Product</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[16%]">Firm</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[21%]">Primary Analyst</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[21%]">Secondary Analyst</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[12%]">Coverage Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-sm text-gray-400 italic">
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
                        <td className="px-4 py-3">
                          <CoverageStatusBadge product={product} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bulk reassign bar */}
        {selectedProducts.length > 0 && (
          <BulkReassignBar
            selectedProducts={selectedProducts}
            xponanceContacts={xponanceContacts}
            onDone={handleBulkDone}
            onClear={clearSelection}
          />
        )}

        {/* Analyst assignment chart */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-600" />
            Analyst Assignment Summary
          </h3>
          <AnalystAssignmentChart xponanceContacts={xponanceContacts} assignmentCounts={assignmentCounts} />
        </div>

        {/* Xponance contacts summary */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <UserCircle2 className="w-4 h-4 text-violet-600" />
            Xponance Analysts ({xponanceContacts.length})
          </h3>
          {xponanceContacts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No contacts found related to the Xponance firm.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {xponanceContacts
                .sort((a, b) => {
                  const an = [a.first_name, a.last_name].filter(Boolean).join(" ");
                  const bn = [b.first_name, b.last_name].filter(Boolean).join(" ");
                  return an.localeCompare(bn);
                })
                .map((c) => {
                  const counts = assignmentCounts[c.id] || { primary: 0, secondary: 0 };
                  const total = counts.primary + counts.secondary;
                  const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
                  return (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:border-violet-200 hover:bg-violet-50/30 transition-colors">
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <UserCircle2 className="w-4 h-4 text-violet-400" />
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