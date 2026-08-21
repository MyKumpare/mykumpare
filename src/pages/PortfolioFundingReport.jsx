import React, { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  ArrowLeft, Download, FileText, Loader2, Wallet, TrendingUp, TrendingDown, BarChart3,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import ReportDateRangePicker from "@/components/reports/ReportDateRangePicker";

const STATUS_COLORS = { Active: "#10b981", Terminated: "#ef4444" };

const fmtCurrency = (n) =>
  n == null || isNaN(n)
    ? "$0"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return fmtCurrency(n);
};

export default function PortfolioFundingReport() {
  const { user } = useAuth();
  const linkedFirmId = user?.data?.linked_firm_id;
  const [dataScope, setDataScope] = useState("my");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  const { data: portfolios = [], isLoading } = useQuery({
    queryKey: ["portfolios_funding_report"],
    queryFn: () => base44.entities.Portfolio.list("-created_date", 5000),
  });

  const availableRange = useMemo(() => {
    const dates = portfolios.filter((p) => !p.deleted_at && p.inception_date).map((p) => p.inception_date).sort();
    return dates.length ? { oldest: dates[0], newest: dates[dates.length - 1] } : null;
  }, [portfolios]);

  const scopedPortfolios = useMemo(() => {
    let active = portfolios.filter((p) => !p.deleted_at);
    if (dataScope !== "all" && linkedFirmId) active = active.filter((p) => p.tenant_id === linkedFirmId);
    const { start, end } = dateRange;
    if (start || end) {
      active = active.filter((p) => {
        if (!p.inception_date) return false;
        if (start && p.inception_date < start) return false;
        if (end && p.inception_date > end) return false;
        return true;
      });
    }
    return active;
  }, [portfolios, dataScope, linkedFirmId, dateRange]);

  const amount = (p) => Number(p.initial_allocation_amount) || 0;

  const summary = useMemo(() => {
    let total = 0, active = 0, terminated = 0;
    for (const p of scopedPortfolios) {
      const a = amount(p);
      total += a;
      if (p.funding_status === "Active") active += a;
      else if (p.funding_status === "Terminated") terminated += a;
    }
    return { total, active, terminated, count: scopedPortfolios.length };
  }, [scopedPortfolios]);

  const byStatus = useMemo(() => ([
    { name: "Active", value: summary.active },
    { name: "Terminated", value: summary.terminated },
  ].filter((d) => d.value > 0)), [summary]);

  const byAllocator = useMemo(() => {
    const map = new Map();
    for (const p of scopedPortfolios) {
      const name = p.allocator_name || "Unknown Allocator";
      map.set(name, (map.get(name) || 0) + amount(p));
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [scopedPortfolios]);

  const byAdvisor = useMemo(() => {
    const map = new Map();
    for (const p of scopedPortfolios) {
      const name = p.advisor_firm_name || "Unknown Advisor";
      map.set(name, (map.get(name) || 0) + amount(p));
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [scopedPortfolios]);

  const exportPdf = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
      heightLeft -= (pageH - margin * 2);
      while (heightLeft > 0) {
        position = margin - (imgH - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
        heightLeft -= (pageH - margin * 2);
      }
      pdf.save("portfolio-funding-progress-report.pdf");
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Portfolio Funding Progress Report"],
      ["Generated", new Date().toLocaleString()],
      [],
      ["Summary"],
      ["Total Portfolios", summary.count],
      ["Total Allocated", summary.total],
      ["Active Funding", summary.active],
      ["Terminated Funding", summary.terminated],
      [],
      ["Funding by Allocator Firm"],
      ["Allocator Firm", "Allocated Amount"],
      ...byAllocator.map((r) => [r.name, r.value]),
      [],
      ["Funding by Advisor Firm"],
      ["Advisor Firm", "Allocated Amount"],
      ...byAdvisor.map((r) => [r.name, r.value]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio-funding-progress-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasData = summary.count > 0;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <div className="h-5 w-px bg-white/30 flex-shrink-0" />
            <h1 className="text-lg font-bold tracking-tight truncate">Portfolio Funding Progress Report</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" className="bg-white/90 gap-1" onClick={exportCsv} disabled={!hasData || exporting}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button size="sm" className="bg-white text-indigo-700 hover:bg-white/90 gap-1" onClick={exportPdf} disabled={!hasData || exporting}>
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {exporting ? "Exporting…" : "Export PDF"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Data scope toggle */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-gray-500">
            {dataScope === "my" ? "Showing data associated with your firm" : "Showing all firm data"}
          </p>
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            <button
              onClick={() => setDataScope("my")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${dataScope === "my" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              My Data
            </button>
            <button
              onClick={() => setDataScope("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${dataScope === "all" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              All Data
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
          <ReportDateRangePicker value={dateRange} onChange={setDateRange} availableRange={availableRange} label="Filter portfolios by inception date" />
        </div>

        {/* Report body — captured for PDF export */}
        <div ref={reportRef} className="space-y-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Report title block */}
          <div className="border-b border-gray-200 pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-gray-900">Total Funding Progress Across Portfolios</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">Generated {new Date().toLocaleString()}</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : !hasData ? (
            <div className="text-sm text-gray-400 italic py-12 text-center">
              No portfolio funding data to display.
            </div>
          ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard label="Total Portfolios" value={String(summary.count)} icon={Wallet} color="bg-indigo-500" />
              <SummaryCard label="Total Allocated" value={fmtCompact(summary.total)} icon={BarChart3} color="bg-violet-500" />
              <SummaryCard label="Active Funding" value={fmtCompact(summary.active)} icon={TrendingUp} color="bg-emerald-500" />
              <SummaryCard label="Terminated Funding" value={fmtCompact(summary.terminated)} icon={TrendingDown} color="bg-red-500" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Funding by status */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Funding by Status</h3>
                {byStatus.length === 0 ? (
                  <div className="h-60 flex items-center justify-center text-gray-400 text-sm">No funding amounts recorded</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={2}>
                          {byStatus.map((entry, idx) => (
                            <Cell key={idx} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtCurrency(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {byStatus.map((d) => (
                        <div key={d.name} className="rounded-lg border border-gray-200 p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.name] }} />
                            <span className="text-[11px] font-medium text-gray-600">{d.name}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{fmtCurrency(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Funding by allocator firm */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Funding by Allocator Firm (Top 10)</h3>
                {byAllocator.length === 0 ? (
                  <div className="h-60 flex items-center justify-center text-gray-400 text-sm">No allocator data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={byAllocator} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={120} />
                      <Tooltip formatter={(v) => fmtCurrency(v)} cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                      <Bar dataKey="value" name="Allocated" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Funding by advisor firm */}
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Funding by Advisor Firm (Top 10)</h3>
              {byAdvisor.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-gray-400 text-sm">No advisor data</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byAdvisor} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip formatter={(v) => fmtCurrency(v)} cursor={{ fill: "#f9fafb" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                    <Bar dataKey="value" name="Allocated" fill="#10b981" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Breakdown table */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800">Allocator Funding Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="px-4 py-2 font-medium">Allocator Firm</th>
                      <th className="px-4 py-2 font-medium text-right">Allocated Amount</th>
                      <th className="px-4 py-2 font-medium text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byAllocator.map((r) => (
                      <tr key={r.name} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2 text-gray-800">{r.name}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">{fmtCurrency(r.value)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {summary.total > 0 ? ((r.value / summary.total) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-2 text-gray-800">Total</td>
                      <td className="px-4 py-2 text-right text-gray-900">{fmtCurrency(summary.total)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-gray-900 leading-none truncate">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}