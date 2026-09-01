import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  ArrowLeft, ShieldCheck, CalendarClock, AlertTriangle, UserX, Loader2, Building2, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const UPCOMING_WINDOW_DAYS = 90;

function contactDisplayName(c) {
  const parts = [c.first_name, c.last_name].filter(Boolean);
  let name = parts.join(" ");
  if (c.suffix) name += `, ${c.suffix}`;
  return name || c.email || "Unnamed";
}

export default function ComplianceRenewalDashboard() {
  const { user } = useAuth();
  const [dataScope, setDataScope] = useState("my");
  const linkedFirmId = user?.data?.linked_firm_id;

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const scopedFirms = useMemo(() => {
    const active = firms.filter((f) => !f.deleted_at);
    if (dataScope === "all" || !linkedFirmId) return active;
    return active.filter((f) => f.tenant_id === linkedFirmId);
  }, [firms, dataScope, linkedFirmId]);

  const contactMap = useMemo(() => {
    const m = new Map();
    for (const c of contacts) m.set(c.id, c);
    return m;
  }, [contacts]);

  // Build renewal rows: one per jurisdiction with a renewal date.
  const renewalRows = useMemo(() => {
    const today = new Date();
    const rows = [];
    for (const f of scopedFirms) {
      const lc = f.legal_compliance;
      const jurisdictions = lc?.jurisdictions || [];
      const officerNames = (lc?.complianceOfficerIds || [])
        .map((id) => contactMap.get(id))
        .filter(Boolean)
        .map(contactDisplayName);
      for (const j of jurisdictions) {
        if (!j.renewalDate) continue;
        let due;
        try { due = parseISO(j.renewalDate); } catch { continue; }
        if (isNaN(due)) continue;
        const days = differenceInCalendarDays(due, today);
        rows.push({
          firmId: f.id,
          firmName: f.name,
          jurisdiction: j.jurisdictionCountry || j.entityJurisdiction || "—",
          registrationNumber: j.registrationNumber || "—",
          renewalDate: j.renewalDate,
          days,
          officerNames,
        });
      }
    }
    // Sort: overdue first (most overdue), then upcoming soonest.
    return rows.sort((a, b) => a.days - b.days);
  }, [scopedFirms, contactMap]);

  const overdue = renewalRows.filter((r) => r.days < 0);
  const upcoming = renewalRows.filter((r) => r.days >= 0 && r.days <= UPCOMING_WINDOW_DAYS);

  // Firms with jurisdictions but no compliance officers.
  const missingOfficerFirms = useMemo(() => {
    const list = [];
    for (const f of scopedFirms) {
      const lc = f.legal_compliance;
      const jurisdictions = lc?.jurisdictions || [];
      if (jurisdictions.length === 0) continue;
      const officerIds = lc?.complianceOfficerIds || [];
      const hasOfficer = officerIds.some((id) => contactMap.has(id));
      if (!hasOfficer) {
        list.push({
          firmId: f.id,
          firmName: f.name,
          jurisdictionCount: jurisdictions.length,
          jurisdictions: jurisdictions.map((j) => j.jurisdictionCountry || j.entityJurisdiction).filter(Boolean),
        });
      }
    }
    return list.sort((a, b) => a.firmName.localeCompare(b.firmName));
  }, [scopedFirms, contactMap]);

  const totalTracked = renewalRows.length;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="h-5 w-px bg-white/30" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-300" />
              <h1 className="text-lg font-bold tracking-tight">Compliance & Renewals Dashboard</h1>
            </div>
          </div>
          <div className="inline-flex rounded-lg border border-white/20 bg-white/10 p-0.5">
            <button
              onClick={() => setDataScope("my")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dataScope === "my" ? "bg-white text-slate-800" : "text-white/70 hover:text-white"
              }`}
            >
              My Firm
            </button>
            <button
              onClick={() => setDataScope("all")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dataScope === "all" ? "bg-white text-slate-800" : "text-white/70 hover:text-white"
              }`}
            >
              All Data
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Renewals Tracked" value={totalTracked} subtext="Jurisdictions with a renewal date" icon={CalendarClock} color="from-indigo-500 to-indigo-600" />
              <KpiCard label="Overdue" value={overdue.length} subtext="Past their renewal date" icon={AlertTriangle} color="from-red-500 to-red-600" />
              <KpiCard label="Upcoming (90 days)" value={upcoming.length} subtext="Due within 3 months" icon={CalendarClock} color="from-amber-500 to-amber-600" />
              <KpiCard label="Missing Compliance Officer" value={missingOfficerFirms.length} subtext="Firms with jurisdictions but no officer" icon={UserX} color="from-violet-500 to-violet-600" />
            </div>

            {/* Upcoming & overdue renewals */}
            <SectionCard title="Registration Renewals" icon={CalendarClock} subtitle="Overdue and upcoming renewal dates across all jurisdictions">
              {renewalRows.length === 0 ? (
                <EmptyState label="No renewal dates recorded. Add renewal dates in each firm's Legal & Compliance tab." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-gray-500 border-b border-gray-200">
                        <th className="py-2 px-3">Firm</th>
                        <th className="py-2 px-3">Jurisdiction</th>
                        <th className="py-2 px-3">Registration #</th>
                        <th className="py-2 px-3">Renewal Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Compliance Officers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renewalRows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3">
                            <Link to={`/?openFirm=${r.firmId}`} className="font-medium text-indigo-700 hover:underline flex items-center gap-1">
                              {r.firmName} <ChevronRight className="w-3 h-3" />
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-gray-700">{r.jurisdiction}</td>
                          <td className="py-2 px-3 text-gray-700">{r.registrationNumber}</td>
                          <td className="py-2 px-3 text-gray-700">{format(parseISO(r.renewalDate), "MMM d, yyyy")}</td>
                          <td className="py-2 px-3"><RenewalStatus days={r.days} /></td>
                          <td className="py-2 px-3 text-gray-600">
                            {r.officerNames.length > 0 ? r.officerNames.join(", ") : <span className="text-red-600 inline-flex items-center gap-1"><UserX className="w-3 h-3" /> None assigned</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {renewalRows.length > 50 && (
                    <p className="text-xs text-gray-400 px-3 py-2">Showing 50 of {renewalRows.length} renewal rows.</p>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Firms missing compliance officers */}
            <SectionCard title="Outstanding Compliance Officer Updates" icon={UserX} subtitle="Firms with registered jurisdictions but no compliance officer assigned">
              {missingOfficerFirms.length === 0 ? (
                <EmptyState label="All firms with jurisdictions have at least one compliance officer." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {missingOfficerFirms.map((f) => (
                    <Link
                      key={f.firmId}
                      to={`/?openFirm=${f.firmId}`}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 hover:border-indigo-300 hover:shadow-sm transition-all"
                    >
                      <div>
                        <p className="font-medium text-gray-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {f.firmName}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {f.jurisdictionCount} jurisdiction{f.jurisdictionCount !== 1 ? "s" : ""}: {f.jurisdictions.join(", ") || "—"}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

function RenewalStatus({ days }) {
  if (days < 0) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" /> {Math.abs(days)}d overdue</span>;
  }
  if (days <= 30) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><CalendarClock className="w-3 h-3" /> in {days}d</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CalendarClock className="w-3 h-3" /> in {days}d</span>;
}

function KpiCard({ label, value, subtext, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 overflow-hidden relative">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
          <p className="text-xs font-medium text-gray-700 mt-2">{label}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{subtext}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-gray-500 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

function EmptyState({ label }) {
  return <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-sm text-gray-500">{label}</div>;
}