import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Search, FileText, Building2, CalendarDays, X, History, Filter,
} from "lucide-react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DdAuditTrailReport from "./DdAuditTrailReport";

// Statuses considered "closed" (terminal review outcomes)
const CLOSED_STATUSES = ["Buy List", "Rejected", "Watch List"];

/**
 * Searchable index of closed due diligence processes with audit trails.
 * Lets the user filter by firm name or date, then download the audit trail
 * report (PDF) for any closed process.
 */
export default function DdAuditTrailIndex() {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportRecord, setReportRecord] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["dd-audit-trail-index"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 500),
  });

  const closedRecords = useMemo(() => {
    return records.filter(
      (r) => !r.deleted_at && CLOSED_STATUSES.includes(r.status)
    );
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return closedRecords.filter((r) => {
      if (q) {
        const hay = `${r.firm_name || ""} ${r.product_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fromDate) {
        try {
          if (!r.start_date || isAfter(parseISO(fromDate), parseISO(r.start_date))) return false;
        } catch { /* skip invalid */ }
      }
      if (toDate) {
        try {
          if (!r.start_date || isBefore(parseISO(toDate), parseISO(r.start_date))) return false;
        } catch { /* skip invalid */ }
      }
      return true;
    });
  }, [closedRecords, search, fromDate, toDate]);

  const hasFilters = search || fromDate || toDate;
  const clearFilters = () => { setSearch(""); setFromDate(""); setToDate(""); };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">Closed Process Audit Trail Index</h3>
        <span className="text-[10px] text-gray-400">
          ({filtered.length} of {closedRecords.length} closed)
        </span>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by firm or product name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setSearch(""); }}
            className="h-8 pl-8 pr-8 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 w-[130px] text-xs"
            title="Start date from"
          />
          <span className="text-[10px] text-gray-400">to</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 w-[130px] text-xs"
            title="Start date to"
          />
        </div>
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            <X className="w-3 h-3" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400 italic">
          {hasFilters
            ? "No closed processes match your filters."
            : "No closed due diligence processes yet."}
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-md border border-gray-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2">Firm</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Start Date</th>
                <th className="px-3 py-2">Events</th>
                <th className="px-3 py-2 text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const eventCount = (r.audit_trail || []).length;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-800 truncate max-w-[160px]">
                          {r.firm_name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[160px]">
                      {r.product_name || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        r.status === "Buy List" ? "bg-emerald-50 text-emerald-700"
                        : r.status === "Rejected" ? "bg-red-50 text-red-700"
                        : "bg-cyan-50 text-cyan-700"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3 text-gray-400" />
                        {r.start_date ? format(parseISO(r.start_date), "MMM d, yyyy") : "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{eventCount}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1"
                        disabled={eventCount === 0}
                        onClick={() => setReportRecord(r)}
                      >
                        <FileText className="w-3 h-3" /> Download
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Report dialog */}
      <DdAuditTrailReport
        open={!!reportRecord}
        onOpenChange={(open) => { if (!open) setReportRecord(null); }}
        ddRecord={reportRecord}
      />
    </div>
  );
}