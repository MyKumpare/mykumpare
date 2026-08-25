import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Filter, ArrowUpDown, FileSearch, LayoutDashboard, Building2,
  Clock, CheckCircle2, FolderOpen, FileDown, AlertTriangle,
} from "lucide-react";
import FirmRfpRfiCard from "@/components/firms/FirmRfpRfiCard";
import RfpRfiByFirmTypeChart from "@/components/firms/RfpRfiByFirmTypeChart";
import { generateRfpRfiDashboardPdf } from "@/components/firms/rfpRfiDashboardPdf";
import { toast } from "@/components/ui/use-toast";

const FIRM_TYPE_ORDER = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

/**
 * Centralized RFP/RFI tracking dashboard.
 * Aggregates every FirmRfpRfi record across all firms into one view, with a
 * status filter (Open / Closed / All) and a chart of open proposals by firm
 * type so the user can spot where the most active opportunities are.
 */
export default function RfpRfiDashboard({ inline = false }) {
  const [statusFilter, setStatusFilter] = useState("Open");
  const [sortBy, setSortBy] = useState("due_asc");
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("all");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["rfp-rfi-dashboard"],
    queryFn: () => base44.entities.FirmRfpRfi.list("-created_date", 2000),
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 2000),
  });

  // The generating firm (the user's own firm) — its logo + name appear in the
  // branded PDF header alongside the MyKumpare mark.
  const { data: ownFirm } = useQuery({
    queryKey: ["own-firm-for-rfp-pdf"],
    queryFn: async () => {
      const me = await base44.auth.me().catch(() => null);
      const fid = me?.linked_firm_id || me?.data?.linked_firm_id;
      if (!fid) return null;
      return base44.entities.Firm.get(fid).catch(() => null);
    },
  });

  const firmTypeMap = useMemo(() => {
    const map = new Map();
    (firms || []).forEach((f) => {
      if (!f || !f.id) return;
      const types = (f.firm_types && f.firm_types.length ? f.firm_types : (f.firm_type ? [f.firm_type] : []));
      map.set(f.id, types);
    });
    return map;
  }, [firms]);

  const active = useMemo(() => (records || []).filter((r) => !r.deleted_at), [records]);

  const counts = useMemo(() => ({
    Open: active.filter((r) => r.status === "Open").length,
    Closed: active.filter((r) => r.status === "Closed").length,
    Unknown: active.filter((r) => r.status === "Unknown").length,
  }), [active]);

  // Chart data: count of OPEN proposals per firm type. A proposal is counted
  // under every type its firm belongs to (multi-type firms contribute to each).
  const chartData = useMemo(() => {
    const buckets = new Map();
    active
      .filter((r) => r.status === "Open")
      .forEach((r) => {
        const types = firmTypeMap.get(r.firm_id);
        if (types && types.length) {
          types.forEach((t) => buckets.set(t, (buckets.get(t) || 0) + 1));
        } else {
          buckets.set("Uncategorized", (buckets.get("Uncategorized") || 0) + 1);
        }
      });
    const ordered = FIRM_TYPE_ORDER.filter((t) => buckets.has(t));
    const extras = Array.from(buckets.keys()).filter((t) => !FIRM_TYPE_ORDER.includes(t));
    return [
      ...ordered.map((firmType) => ({ firmType, count: buckets.get(firmType) })),
      ...extras.sort().map((firmType) => ({ firmType, count: buckets.get(firmType) })),
      ...(buckets.has("Uncategorized") ? [{ firmType: "Uncategorized", count: buckets.get("Uncategorized") }] : []),
    ];
  }, [active, firmTypeMap]);

  const decisionCounts = useMemo(() => ({
    "Needs Review": active.filter((r) => (r.decision_status || "Needs Review") === "Needs Review").length,
    "Submitted": active.filter((r) => r.decision_status === "Submitted").length,
    "Passed": active.filter((r) => r.decision_status === "Passed").length,
  }), [active]);

  const visible = useMemo(() => {
    let list = [...active];
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (decisionFilter !== "all") list = list.filter((r) => (r.decision_status || "Needs Review") === decisionFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.title || "").toLowerCase().includes(q) ||
        (r.firm_name || "").toLowerCase().includes(q) ||
        (r.summary || "").toLowerCase().includes(q) ||
        (r.rfp_type || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === "due_asc") return (a.due_date || "9999").localeCompare(b.due_date || "9999");
      if (sortBy === "due_desc") return (b.due_date || "0").localeCompare(a.due_date || "0");
      if (sortBy === "posted_desc") return (b.posting_date || "0").localeCompare(a.posting_date || "0");
      return (a.title || "").localeCompare(b.title || "");
    });
    return list;
  }, [active, statusFilter, decisionFilter, sortBy, search]);

  const [exporting, setExporting] = useState(false);
  const handleExportPdf = async () => {
    if (!visible.length) {
      toast({ title: "Nothing to export", description: "No records match the current filter.", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      await generateRfpRfiDashboardPdf({
        items: visible,
        filters: { statusFilter, decisionFilter, search, sortBy },
        totalCount: active.length,
        firmName: ownFirm?.name,
        firmLogoUrl: ownFirm?.logo_url,
      });
      toast({ title: "PDF exported", description: `${visible.length} records exported.` });
    } catch (err) {
      toast({ title: "Export failed", description: err?.message || "Could not generate PDF.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const dueSoonCount = useMemo(() => {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    today.setHours(0, 0, 0, 0);
    return active.filter((r) => {
      if (!r.due_date || r.status !== "Open") return false;
      const due = new Date(r.due_date + "T00:00:00");
      due.setHours(0, 0, 0, 0);
      const days = Math.round((due - today) / (1000 * 60 * 60 * 24));
      return days === 0 || days === 1;
    }).length;
  }, [active]);

  const stats = [
    { label: "Total", value: active.length, icon: FolderOpen, color: "text-gray-700", bg: "bg-gray-100" },
    { label: "Open", value: counts.Open, icon: Clock, color: "text-emerald-700", bg: "bg-emerald-100" },
    { label: "Due ≤48h", value: dueSoonCount, icon: AlertTriangle, color: "text-orange-700", bg: "bg-orange-100" },
    { label: "Closed", value: counts.Closed, icon: CheckCircle2, color: "text-red-700", bg: "bg-red-100" },
  ];

  return (
    <div className={inline ? "pb-6" : "min-h-screen bg-gray-50 pb-10"}>
      {/* Header — hidden when rendered inline inside the Monitor page */}
      {!inline && (
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="gap-1 text-gray-600">
            <LayoutDashboard className="w-4 h-4" /> Back
          </Button>
          <div className="flex items-center gap-2 ml-1">
            <FileSearch className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-gray-800">RFP / RFI Dashboard</h1>
          </div>
        </div>
      </div>
      )}

      <div className={inline ? "space-y-4" : "max-w-6xl mx-auto px-4 pt-4 space-y-4"}>
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-2.5 shadow-sm">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4.5 h-4.5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500 leading-none">{s.label}</p>
                  <p className="text-xl font-bold text-gray-800 leading-tight">{s.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Open Proposals by Firm Type</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Where the most active opportunities are concentrated. Open proposals are counted under each firm type they belong to.
          </p>
          <RfpRfiByFirmTypeChart data={chartData} />
        </div>

        {/* Toolbar: status filter + decision filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] text-gray-400 mr-0.5">Status:</span>
            {[
              { key: "all", label: `All (${active.length})` },
              { key: "Open", label: `Open (${counts.Open})` },
              { key: "Closed", label: `Closed (${counts.Closed})` },
              { key: "Unknown", label: `Unknown (${counts.Unknown})` },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStatusFilter(opt.key)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  statusFilter === opt.key
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 mr-0.5">Decision:</span>
            {[
              { key: "all", label: "All" },
              { key: "Needs Review", label: `Needs Review (${decisionCounts["Needs Review"]})` },
              { key: "Submitted", label: `Submitted (${decisionCounts["Submitted"]})` },
              { key: "Passed", label: `Passed (${decisionCounts["Passed"]})` },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDecisionFilter(opt.key)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  decisionFilter === opt.key
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + sort */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Input
              placeholder="Search by title, firm, summary, or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs border border-gray-200 rounded-md h-8 px-2 bg-white"
            >
              <option value="due_asc">Due date (earliest)</option>
              <option value="due_desc">Due date (latest)</option>
              <option value="posted_desc">Recently posted</option>
              <option value="title">Title (A–Z)</option>
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={!visible.length || exporting}
            className="h-8 gap-1.5 text-xs shrink-0"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            {exporting ? "Exporting…" : "Export PDF"}
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-10">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2">
            <FileSearch className="w-8 h-8 text-gray-300" />
            {active.length === 0
              ? "No RFP/RFI records yet. Scrub a firm's website from its RFP/RFI tab to populate this dashboard."
              : "No records match the current filter."}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[11px] text-gray-500 border-b border-gray-100 bg-gray-50/60">
                  <Building2 className="w-3 h-3 text-gray-400" />
                  <span className="font-medium text-gray-700 truncate">{r.firm_name || "—"}</span>
                </div>
                <div className="p-3 pt-2.5">
                  <FirmRfpRfiCard record={r} onEdit={() => {}} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}