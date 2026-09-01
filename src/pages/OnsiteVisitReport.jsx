import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Calendar, MapPin, Video, CheckCircle2, Clock, XCircle, UserX,
  Download, AlertTriangle, FileBarChart, Users, CalendarDays,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

const STATUS_STYLES = {
  Scheduled: { icon: Clock, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  Completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  Cancelled: { icon: XCircle, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
  "No-show": { icon: UserX, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
};

export default function OnsiteVisitReport() {
  const [reportMode, setReportMode] = useState("logs");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch all firms (non-deleted)
  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms-all"],
    queryFn: () => base44.entities.Firm.list("-name", 5000),
  });
  const activeFirms = useMemo(() => firms.filter((f) => !f.deleted_at), [firms]);

  // Fetch all visit rules
  const { data: rules = [] } = useQuery({
    queryKey: ["onsite-visit-rules-all"],
    queryFn: () => base44.entities.OnsiteVisitRule.list("-created_date", 5000),
  });

  // Fetch all visits (broad fetch, filtered client-side by date range)
  const { data: allVisits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ["onsite-visits-all"],
    queryFn: () => base44.entities.OnsiteVisit.list("-target_visit_date", 5000),
  });

  const firmMap = useMemo(() => {
    const m = {};
    for (const f of activeFirms) m[f.id] = f;
    return m;
  }, [activeFirms]);

  const ruleByFirm = useMemo(() => {
    const m = {};
    for (const r of rules) m[r.firm_id] = r;
    return m;
  }, [rules]);

  // Visit logs filtered by date range and status
  const filteredVisits = useMemo(() => {
    let list = allVisits;
    if (dateStart) {
      const s = new Date(dateStart + "T00:00:00");
      list = list.filter((v) => new Date(v.target_visit_date + "T00:00:00") >= s);
    }
    if (dateEnd) {
      const e = new Date(dateEnd + "T23:59:59");
      list = list.filter((v) => new Date(v.target_visit_date + "T00:00:00") <= e);
    }
    if (statusFilter !== "all") {
      list = list.filter((v) => v.status === statusFilter);
    }
    return list;
  }, [allVisits, dateStart, dateEnd, statusFilter]);

  // As-of date compliance status: for each firm with a visit rule, determine status
  const complianceRows = useMemo(() => {
    const asOf = new Date(asOfDate + "T23:59:59");
    const rows = [];
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const firm = firmMap[rule.firm_id];
      if (!firm) continue;
      const firmVisits = allVisits
        .filter((v) => v.firm_id === rule.firm_id && v.status === "Completed" && v.actual_visit_date)
        .sort((a, b) => (b.actual_visit_date || "").localeCompare(a.actual_visit_date || ""));
      const lastVisit = firmVisits[0];
      let status = "needs_visit";
      let lastVisitDate = lastVisit?.actual_visit_date || null;
      let nextDueDate = null;
      if (lastVisitDate) {
        const d = new Date(lastVisitDate + "T00:00:00");
        d.setDate(d.getDate() + rule.visit_cycle_days);
        nextDueDate = d.toISOString().slice(0, 10);
        if (asOf > d) status = "late";
        else status = "visited";
      } else {
        status = "needs_visit";
      }
      rows.push({
        firm,
        rule,
        lastVisitDate,
        nextDueDate,
        status,
        visitCount: firmVisits.length,
      });
    }
    return rows.sort((a, b) => (a.firm.name || "").localeCompare(b.firm.name || ""));
  }, [rules, firmMap, allVisits, asOfDate]);

  const complianceCounts = useMemo(() => {
    const c = { visited: 0, needs_visit: 0, late: 0 };
    for (const r of complianceRows) c[r.status]++;
    return c;
  }, [complianceRows]);

  const exportLogsCSV = () => {
    const headers = ["Firm", "Target Date", "Actual Date", "Analyst", "Type", "Status", "Agenda", "Follow-up Items", "Tasks"];
    const rows = filteredVisits.map((v) => [
      `"${(v.firm_name || "").replace(/"/g, '""')}"`,
      v.target_visit_date || "",
      v.actual_visit_date || "",
      `"${(v.visiting_analyst_name || "").replace(/"/g, '""')}"`,
      v.onsite_type || "",
      v.status || "",
      `"${(v.agenda || "").replace(/<[^>]*>/g, "").replace(/"/g, '""')}"`,
      (v.follow_up_items || []).length,
      (v.follow_up_task_ids || []).length,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onsite_visit_logs_${dateStart || "all"}_${dateEnd || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export ready" });
  };

  const exportComplianceCSV = () => {
    const headers = ["Firm", "Visit Cycle (days)", "Last Visit Date", "Next Due Date", "Status", "Visit Count", "Default Analyst"];
    const rows = complianceRows.map((r) => [
      `"${(r.firm.name || "").replace(/"/g, '""')}"`,
      r.rule.visit_cycle_days,
      r.lastVisitDate || "",
      r.nextDueDate || "",
      r.status === "visited" ? "Visited" : r.status === "late" ? "Late" : "Needs Visit",
      r.visitCount,
      `"${(r.rule.visiting_analyst_name || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onsite_visit_compliance_as_of_${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export ready" });
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-indigo-500" />
            Onsite Visit Report
          </h1>
          <p className="text-sm text-gray-500">View visit logs by date range or check visit cycle compliance as of a date.</p>
        </div>
        <Link to="/OnsiteVisitCalendar">
          <Button variant="outline" size="sm" className="gap-1.5">
            <CalendarDays className="w-4 h-4" /> Calendar View
          </Button>
        </Link>
      </div>

      <Tabs value={reportMode} onValueChange={setReportMode}>
        <TabsList>
          <TabsTrigger value="logs" className="text-xs">Visit Logs</TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs">Visit Cycle Status</TabsTrigger>
        </TabsList>

        {/* Visit Logs tab */}
        <TabsContent value="logs" className="space-y-3">
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Start Date</Label>
                <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="h-8 text-sm w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">End Date</Label>
                <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="h-8 text-sm w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="No-show">No-show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportLogsCSV}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
              <div className="ml-auto text-xs text-gray-400">{filteredVisits.length} visit(s)</div>
            </div>
          </div>

          {visitsLoading ? (
            <div className="text-sm text-gray-400 italic py-3 text-center">Loading visits...</div>
          ) : filteredVisits.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              No visits match the selected filters.
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Firm</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Target Date</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Actual Date</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Analyst</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Type</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Status</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">Items</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">Tasks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVisits.map((v) => {
                    const st = STATUS_STYLES[v.status] || STATUS_STYLES.Scheduled;
                    const StatusIcon = st.icon;
                    const TypeIcon = v.onsite_type === "Virtual" ? Video : MapPin;
                    return (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-800 font-medium">{v.firm_name || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{fmtDate(v.target_visit_date)}</td>
                        <td className="px-3 py-2 text-gray-600">{fmtDate(v.actual_visit_date)}</td>
                        <td className="px-3 py-2 text-gray-600">{v.visiting_analyst_name || "—"}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600"><TypeIcon className="w-3 h-3" /> {v.onsite_type}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color} ${st.bg}`}>
                            <StatusIcon className="w-3 h-3" /> {v.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{(v.follow_up_items || []).length}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{(v.follow_up_task_ids || []).length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Visit Cycle Status tab */}
        <TabsContent value="compliance" className="space-y-3">
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">As of Date</Label>
                <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-8 text-sm w-40" />
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportComplianceCSV}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
              <div className="ml-auto flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Visited: {complianceCounts.visited}</span>
                <span className="inline-flex items-center gap-1 text-blue-600"><Clock className="w-3.5 h-3.5" /> Needs Visit: {complianceCounts.needs_visit}</span>
                <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> Late: {complianceCounts.late}</span>
              </div>
            </div>
          </div>

          {firmsLoading ? (
            <div className="text-sm text-gray-400 italic py-3 text-center">Loading...</div>
          ) : complianceRows.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              No firms with active visit rules. Create a visit rule on a firm's Onsite Due Diligence tab to track visit cycle compliance.
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Firm</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">Cycle (days)</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Last Visit</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Next Due</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Status</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">Visits</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Default Analyst</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {complianceRows.map((r) => {
                    const statusBadge = r.status === "visited"
                      ? { label: "Visited", color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle2 }
                      : r.status === "late"
                      ? { label: "Late", color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle }
                      : { label: "Needs Visit", color: "text-blue-600", bg: "bg-blue-50", icon: Clock };
                    const StatusIcon = statusBadge.icon;
                    return (
                      <tr key={r.firm.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-800 font-medium">{r.firm.name}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{r.rule.visit_cycle_days}</td>
                        <td className="px-3 py-2 text-gray-600">{fmtDate(r.lastVisitDate)}</td>
                        <td className="px-3 py-2 text-gray-600">{fmtDate(r.nextDueDate)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.color} ${statusBadge.bg}`}>
                            <StatusIcon className="w-3 h-3" /> {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{r.visitCount}</td>
                        <td className="px-3 py-2 text-gray-600">{r.rule.visiting_analyst_name || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}