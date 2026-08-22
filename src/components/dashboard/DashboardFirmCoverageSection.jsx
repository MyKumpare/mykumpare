import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Building2,
  User,
  Users,
  Printer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CoverageReportDialog from "./CoverageReportDialog";
import CoverageHeatmap from "./CoverageHeatmap";

// Collapsible dashboard section visualizing team coverage by role and firm.
// Highlights firms that are under-resourced or missing key analyst assignments
// (no primary analyst, or no analysts at all) derived from active DueDiligence
// analyst_history entries (no end_date).
const STATUS = {
  unassigned: {
    label: "Unassigned",
    border: "border-red-300",
    chip: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
    card: "bg-red-50 border-red-200",
  },
  no_primary: {
    label: "No Primary",
    border: "border-amber-300",
    chip: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    card: "bg-amber-50 border-amber-200",
  },
  covered: {
    label: "Covered",
    border: "border-emerald-200",
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    card: "bg-emerald-50 border-emerald-200",
  },
};

export default function DashboardFirmCoverageSection({ forceExpanded, onFirmClick, onProductClick }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("all"); // all | gaps | covered
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const { data: ddRecords = [], isLoading } = useQuery({
    queryKey: ["due-diligence-all"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 500),
  });

  const firms = useMemo(() => {
    const active = ddRecords.filter((r) => !r.deleted_at);
    const byFirm = {};
    for (const rec of active) {
      if (!rec.firm_id) continue;
      if (!byFirm[rec.firm_id]) {
        byFirm[rec.firm_id] = {
          firm_id: rec.firm_id,
          firm_name: rec.firm_name || "—",
          primaries: {},
          secondaries: {},
          products: {},
          ddCount: 0,
        };
      }
      const f = byFirm[rec.firm_id];
      f.ddCount++;
      if (rec.product_id) f.products[rec.product_id] = rec.product_name || "—";
      for (const entry of rec.analyst_history || []) {
        if (entry.end_date || !entry.contact_id) continue;
        if (entry.analyst_type === "primary") {
          f.primaries[entry.contact_id] = entry.contact_name || "—";
        } else {
          f.secondaries[entry.contact_id] = entry.contact_name || "—";
        }
      }
    }
    return Object.values(byFirm)
      .map((f) => {
        const primaryNames = Object.values(f.primaries);
        const secondaryNames = Object.values(f.secondaries);
        const totalAnalysts = new Set([
          ...Object.keys(f.primaries),
          ...Object.keys(f.secondaries),
        ]).size;
        let status;
        if (totalAnalysts === 0) status = "unassigned";
        else if (primaryNames.length === 0) status = "no_primary";
        else status = "covered";
        return {
          ...f,
          primaryNames,
          secondaryNames,
          products: Object.entries(f.products).map(([id, name]) => ({ id, name })),
          totalAnalysts,
          status,
        };
      })
      .sort((a, b) => {
        // Gaps first (unassigned → no_primary), then covered; then by name.
        const rank = { unassigned: 0, no_primary: 1, covered: 2 };
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        return a.firm_name.localeCompare(b.firm_name);
      });
  }, [ddRecords]);

  const counts = useMemo(
    () => ({
      unassigned: firms.filter((f) => f.status === "unassigned").length,
      no_primary: firms.filter((f) => f.status === "no_primary").length,
      covered: firms.filter((f) => f.status === "covered").length,
    }),
    [firms]
  );
  const gapCount = counts.unassigned + counts.no_primary;

  const visibleFirms = firms.filter((f) => {
    if (filter === "gaps") return f.status !== "covered";
    if (filter === "covered") return f.status === "covered";
    return true;
  });

  const renderFirmCard = (f) => {
    const cfg = STATUS[f.status];
    return (
      <div key={f.firm_id} className={`rounded-lg border ${cfg.border} bg-white p-3`}>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {onFirmClick ? (
            <button
              type="button"
              onClick={() => onFirmClick(f.firm_id)}
              className="text-sm font-semibold text-gray-800 hover:text-indigo-600 hover:underline truncate text-left"
            >
              {f.firm_name}
            </button>
          ) : (
            <span className="text-sm font-semibold text-gray-800 truncate">{f.firm_name}</span>
          )}
          <Badge variant="outline" className="text-[10px] flex-shrink-0">
            {f.ddCount} {f.ddCount === 1 ? "DD" : "DDs"}
          </Badge>
          <Badge className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${cfg.chip}`}>
            {cfg.label}
          </Badge>
        </div>

        <div className="mt-2 flex items-start gap-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase w-14 pt-0.5 flex-shrink-0">
            Product
          </span>
          {f.products.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {f.products.map((p) =>
                onProductClick ? (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onProductClick(p.id)}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-gray-50 text-indigo-700 hover:underline border border-gray-200 text-left"
                  >
                    {p.name}
                  </button>
                ) : (
                  <span
                    key={p.id}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200"
                  >
                    {p.name}
                  </span>
                )
              )}
            </div>
          ) : (
            <span className="text-[11px] text-gray-400 italic">None</span>
          )}
        </div>

        {f.totalAnalysts === 0 ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>No analysts assigned — needs coverage</span>
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] font-semibold text-indigo-600 uppercase w-14 pt-0.5 flex-shrink-0">
                Primary
              </span>
              {f.primaryNames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {f.primaryNames.map((n, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-amber-600 italic">Missing primary analyst</span>
              )}
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] font-semibold text-violet-600 uppercase w-14 pt-0.5 flex-shrink-0">
                Secondary
              </span>
              {f.secondaryNames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {f.secondaryNames.map((n, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-gray-400 italic">None</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1 mb-2 px-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 flex-1 group"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          )}
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Firm Coverage
          </span>
          <span className="text-[11px] text-gray-400 font-normal hidden sm:inline">
            Team coverage by firm &amp; role
          </span>
          {gapCount > 0 && (
            <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border border-red-200 flex-shrink-0">
              <AlertTriangle className="w-3 h-3 mr-0.5" />
              {gapCount} need attention
            </Badge>
          )}
        </button>
        {firms.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-500 hover:text-emerald-700"
            onClick={() => setReportOpen(true)}
            title="Print coverage report"
          >
            <Printer className="w-4 h-4" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100 space-y-3">
          {isLoading ? (
            <div className="text-xs text-gray-400 italic py-4 text-center">Loading…</div>
          ) : firms.length === 0 ? (
            <div className="text-xs text-gray-400 italic py-4 text-center">
              No firms with active due diligence
            </div>
          ) : (
            <>
              {/* Missing-roles alert banner — consolidates every firm needing coverage */}
              {gapCount > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-amber-800">
                        {gapCount} {gapCount === 1 ? "firm has" : "firms have"} missing analyst roles
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {firms
                          .filter((f) => f.status !== "covered")
                          .map((f) => (
                            <li
                              key={f.firm_id}
                              className="text-[11px] text-amber-800 flex items-center gap-1.5"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${STATUS[f.status].dot}`} />
                              <span className="font-medium truncate">{f.firm_name}</span>
                              <span className="text-amber-600">
                                — {f.status === "unassigned"
                                  ? "no analysts assigned"
                                  : "missing primary analyst"}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Coverage summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`rounded-lg border p-2 ${STATUS.covered.card}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS.covered.dot}`} />
                    <span className="text-[10px] font-semibold text-emerald-700 uppercase">Covered</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-700 mt-0.5">{counts.covered}</div>
                </div>
                <div className={`rounded-lg border p-2 ${STATUS.no_primary.card}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS.no_primary.dot}`} />
                    <span className="text-[10px] font-semibold text-amber-700 uppercase">No Primary</span>
                  </div>
                  <div className="text-lg font-bold text-amber-700 mt-0.5">{counts.no_primary}</div>
                </div>
                <div className={`rounded-lg border p-2 ${STATUS.unassigned.card}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS.unassigned.dot}`} />
                    <span className="text-[10px] font-semibold text-red-700 uppercase">Unassigned</span>
                  </div>
                  <div className="text-lg font-bold text-red-700 mt-0.5">{counts.unassigned}</div>
                </div>
              </div>

              {/* Coverage heatmap — visual matrix of role × firm */}
              <CoverageHeatmap firms={firms} onFirmClick={onFirmClick} />

              {/* Filter */}
              <div className="flex items-center gap-1">
                {[
                  { key: "all", label: "All" },
                  { key: "gaps", label: "Needs Attention" },
                  { key: "covered", label: "Covered" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFilter(opt.key)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      filter === opt.key
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {visibleFirms.length === 0 ? (
                <div className="text-xs text-gray-400 italic py-4 text-center">
                  No firms match this filter
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {visibleFirms.map(renderFirmCard)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <CoverageReportDialog open={reportOpen} onClose={() => setReportOpen(false)} firms={firms} />
    </div>
  );
}