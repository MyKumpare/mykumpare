import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, TrendingUp, AlertTriangle, Download, Users, Star, CalendarClock, Sparkles, Building2, User,
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { generateWeeklyInteractionReportPdf } from "@/components/reports/weeklyInteractionReportPdf";
import { useToast } from "@/components/ui/use-toast";

// Top-tier decision roles — these are the contacts the user most wants to stay engaged with.
const TOP_TIER_ROLES = ["Primary Decision Maker", "Board Member", "Key Influencer"];

function fullName(c) {
  return [c?.salutation, c?.first_name, c?.middle_name, c?.last_name, c?.suffix]
    .filter(Boolean).join(" ").trim() || [c?.first_name, c?.last_name].filter(Boolean).join(" ") || "Unknown";
}

const ACTIVITY_ICONS = {
  Call: "📞", Email: "✉️", Meeting: "👥", Note: "📝", Other: "•",
};

// WeeklyInteractionReport — summarizes recent interactions for top-tier contacts.
// Shows a snapshot of who you've engaged with most and where the communication gaps are.
export default function WeeklyInteractionReport() {
  const { toast } = useToast();
  const [windowDays, setWindowDays] = useState(7);
  const [exporting, setExporting] = useState(false);

  const { data: allContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["all_contacts_for_weekly_report"],
    queryFn: () => base44.entities.Contact.list(),
  });

  const { data: allFirms = [] } = useQuery({
    queryKey: ["all_firms_for_weekly_report"],
    queryFn: () => base44.entities.Firm.list(),
  });

  const { data: allActivities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["all_activities_for_weekly_report"],
    queryFn: () => base44.entities.ContactActivity.list("-activity_date", 2000),
  });

  const firmNameFor = useMemo(() => {
    const map = {};
    allFirms.forEach((f) => { map[f.id] = f.name; });
    return map;
  }, [allFirms]);

  const report = useMemo(() => {
    const cutoff = subDays(new Date(), windowDays);
    const startDate = format(subDays(new Date(), windowDays), "MMM d, yyyy");
    const endDate = format(new Date(), "MMM d, yyyy");

    // Active contacts only
    const activeContacts = allContacts.filter((c) => !c.deleted_at && (c.contact_status || "Active") === "Active");
    const topTierContacts = activeContacts.filter((c) => TOP_TIER_ROLES.includes(c.decision_role));

    // Count interactions per contact in the window
    const interactionCounts = {};
    const lastInteractionDate = {};
    allActivities.forEach((a) => {
      if (!a.contact_id || !a.activity_date) return;
      const d = parseISO(a.activity_date + "T00:00:00");
      if (d >= cutoff) {
        interactionCounts[a.contact_id] = (interactionCounts[a.contact_id] || 0) + 1;
      }
      // Track most recent interaction overall (for gap calc)
      const existing = lastInteractionDate[a.contact_id];
      if (!existing || new Date(a.activity_date) > new Date(existing)) {
        lastInteractionDate[a.contact_id] = a.activity_date;
      }
    });

    const totalInteractions = Object.values(interactionCounts).reduce((a, b) => a + b, 0);

    // Most engaged: top-tier contacts sorted by interaction count desc
    const mostEngaged = topTierContacts
      .map((c) => ({
        contact: c,
        firmName: c.firm_ids?.[0] ? firmNameFor[c.firm_ids[0]] : null,
        count: interactionCounts[c.id] || 0,
        lastDate: lastInteractionDate[c.id] ? format(parseISO(lastInteractionDate[c.id] + "T00:00:00"), "MMM d") : null,
        decisionRole: c.decision_role,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);

    // Gaps: top-tier contacts with 0 interactions in the window
    const gaps = topTierContacts
      .map((c) => {
        const last = lastInteractionDate[c.id];
        let daysSince = null;
        if (last) {
          daysSince = Math.floor((new Date() - parseISO(last + "T00:00:00")) / 86400000);
        } else {
          daysSince = c.created_date ? Math.floor((new Date() - new Date(c.created_date)) / 86400000) : null;
        }
        return {
          contact: c,
          firmName: c.firm_ids?.[0] ? firmNameFor[c.firm_ids[0]] : null,
          daysSince,
          lastDate: last ? format(parseISO(last + "T00:00:00"), "MMM d, yyyy") : null,
          decisionRole: c.decision_role,
        };
      })
      .filter((r) => (interactionCounts[r.contact.id] || 0) === 0)
      .sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0));

    return {
      windowDays,
      startDate,
      endDate,
      totalInteractions,
      topTierTotal: topTierContacts.length,
      engagedCount: mostEngaged.length,
      gaps,
      mostEngaged,
    };
  }, [allContacts, allActivities, windowDays, firmNameFor]);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Get the generating firm's logo if available (first firm the user owns)
      const firmName = allFirms[0]?.name;
      let firmLogoDataUrl = null;
      if (allFirms[0]?.logo_url) {
        const { rasterizeImage } = await import("@/components/reports/reportBranding");
        firmLogoDataUrl = await rasterizeImage(allFirms[0].logo_url);
      }
      await generateWeeklyInteractionReportPdf({ report, firmName, firmLogoDataUrl });
      toast({ title: "Report exported" });
    } catch (e) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const loading = contactsLoading || activitiesLoading;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Activity className="w-5 h-5 text-indigo-600" />
        <div>
          <h1 className="text-base font-bold text-gray-800 leading-tight">Weekly Interaction Report</h1>
          <p className="text-[11px] text-gray-500">Engagement snapshot for top-tier contacts</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v))}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 gap-1.5" onClick={handleExport} disabled={exporting || loading}>
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Period banner */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <CalendarClock className="w-3.5 h-3.5" />
          Reporting period: <span className="font-medium text-gray-700">{report.startDate} – {report.endDate}</span>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Activity} label="Total Interactions" value={report.totalInteractions} color="indigo" />
          <KpiCard icon={Star} label="Top-Tier Contacts" value={report.topTierTotal} color="amber" />
          <KpiCard icon={TrendingUp} label="Engaged" value={report.engagedCount} color="emerald" />
          <KpiCard icon={AlertTriangle} label="Communication Gaps" value={report.gaps.length} color="rose" />
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">Crunching interaction data…</div>
        ) : (
          <>
            {/* Most Engaged */}
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-gray-800">Most Engaged This Week</h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-medium">
                  {report.mostEngaged.length} contact{report.mostEngaged.length !== 1 ? "s" : ""}
                </span>
              </div>
              {report.mostEngaged.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                  <Sparkles className="w-5 h-5 text-gray-300" />
                  No interactions recorded in this period. Log activities to see your engagement here.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {report.mostEngaged.map((row, i) => (
                    <div key={row.contact.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 transition-colors">
                      <span className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{fullName(row.contact)}</div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                          {row.firmName && <span className="flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" /> {row.firmName}</span>}
                          {row.decisionRole && <span className="text-amber-600">· {row.decisionRole}</span>}
                          {row.lastDate && <span className="text-gray-400">· last {row.lastDate}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {row.count} interaction{row.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Communication Gaps */}
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h2 className="text-sm font-semibold text-gray-800">Communication Gaps</h2>
                <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-full font-medium">
                  {report.gaps.length} need{report.gaps.length !== 1 ? "s" : ""} outreach
                </span>
              </div>
              {report.gaps.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-emerald-600 flex flex-col items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  All top-tier contacts have been engaged recently. No gaps!
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {report.gaps.map((row) => (
                    <div key={row.contact.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-rose-50/30 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-rose-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{fullName(row.contact)}</div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                          {row.firmName && <span className="flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" /> {row.firmName}</span>}
                          {row.decisionRole && <span className="text-amber-600">· {row.decisionRole}</span>}
                          {row.lastDate && <span className="text-gray-400">· last {row.lastDate}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${
                          row.daysSince > 60 ? "bg-rose-100 text-rose-700 border-rose-300"
                          : row.daysSince > 30 ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}>
                          {row.daysSince != null ? `${row.daysSince}d ago` : "never"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="text-[11px] text-gray-400 px-1 flex items-center gap-1">
              <Users className="w-3 h-3" />
              Top-tier = Primary Decision Makers, Board Members, and Key Influencers. Adjust the window above to see a different period.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const KPI_COLORS = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

function KpiCard({ icon: Icon, label, value, color }) {
  const c = KPI_COLORS[color];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-3.5`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 ${c.text}`} />
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${c.text}`}>{value}</div>
    </div>
  );
}