import React, { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Download, CalendarRange, CalendarClock, Mail, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { generateNewsSummaryPdf } from "./newsSummaryPdf";
import { sendSummaryEmail } from "./newsSummaryEmail";

// Shared news summary dialog for a firm or contact.
// props: open, onOpenChange, newsItems (active, non-deleted), targetType ("firm"|"contact"), targetLabel
export default function NewsSummaryDialog({ open, onOpenChange, newsItems, targetType, targetLabel }) {
  const today = new Date().toISOString().split("T")[0];
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(thirtyAgo);
  const [endDate, setEndDate] = useState(today);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);

  const itemsInRange = useMemo(() => {
    if (!newsItems) return [];
    const start = startDate ? new Date(startDate + "T00:00:00") : null;
    const end = endDate ? new Date(endDate + "T23:59:59") : null;
    return newsItems
      .filter((n) => {
        if (!n.news_date) return false;
        const d = new Date(n.news_date + "T00:00:00");
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      })
      .sort((a, b) => {
        const rank = { High: 0, Medium: 1, Low: 2 };
        const ar = rank[a.alert_status] ?? 2;
        const br = rank[b.alert_status] ?? 2;
        if (ar !== br) return ar - br;
        return (b.news_date || "").localeCompare(a.news_date || "");
      });
  }, [newsItems, startDate, endDate]);

  const { oldestDate, newestDate } = useMemo(() => {
    const dates = (newsItems || []).map((n) => n.news_date).filter(Boolean).sort();
    return { oldestDate: dates[0] || null, newestDate: dates[dates.length - 1] || null };
  }, [newsItems]);

  const fmt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-US") : "—");

  const computeStats = (items) => {
    const stats = { total: items.length, high: 0, medium: 0, low: 0, positive: 0, negative: 0, neutral: 0 };
    for (const it of items) {
      if (it.alert_status === "High") stats.high++;
      else if (it.alert_status === "Medium") stats.medium++;
      else stats.low++;
      if (it.news_status === "Positive") stats.positive++;
      else if (it.news_status === "Negative") stats.negative++;
      else stats.neutral++;
    }
    return stats;
  };

  const dominant = (counts, order) => {
    let best = null, bestN = 0;
    for (const k of order) {
      const n = counts[k] || 0;
      if (n > bestN) { best = k; bestN = n; }
    }
    return best;
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast({ title: "Select a date range", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setReport(null);
    try {
      const stats = computeStats(itemsInRange);
      const overallAlert = dominant(
        { High: stats.high, Medium: stats.medium, Low: stats.low },
        ["High", "Medium", "Low"]
      ) || "None";
      const overallStatus = dominant(
        { Positive: stats.positive, Negative: stats.negative, Neutral: stats.neutral },
        ["Negative", "Positive", "Neutral"]
      ) || "None";

      // Build an AI narrative summary from the items in range
      let summary = "";
      if (itemsInRange.length > 0) {
        const itemBrief = itemsInRange.slice(0, 40).map((it, i) =>
          `${i + 1}. [${it.alert_status || "Low"}/${it.news_status || "Neutral"}] ${it.news_date || ""}: ${it.headline || ""}${it.summary ? " — " + it.summary.slice(0, 200) : ""}`
        ).join("\n");
        const prompt = `You are writing a concise news summary report for a ${targetType === "contact" ? "contact" : "firm"} named "${targetLabel}".
Below are ${itemsInRange.length} news item${itemsInRange.length !== 1 ? "s" : ""} from ${startDate} to ${endDate}.

Alert level counts: High=${stats.high}, Medium=${stats.medium}, Low=${stats.low}.
News status counts: Positive=${stats.positive}, Negative=${stats.negative}, Neutral=${stats.neutral}.
Overall alert level: ${overallAlert}. Overall news status: ${overallStatus}.

News items:
${itemBrief}

Write a 3-5 sentence executive summary noting the overall alert level, the overall news status, notable themes, and any high-impact items. Be objective and concise.`;
        const res = await base44.integrations.Core.InvokeLLM({ prompt });
        summary = typeof res === "string" ? res : (res?.output || res?.response || JSON.stringify(res));
      } else {
        summary = `No news items were found for ${targetLabel} between ${startDate} and ${endDate}.`;
      }

      setReport({
        targetType,
        targetLabel,
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
        stats,
        overallAlert,
        overallStatus,
        summary,
        items: itemsInRange,
      });
    } catch (e) {
      toast({ title: "Summary failed", description: e.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleDownload = () => {
    if (!report) return;
    generateNewsSummaryPdf(report);
  };

  const handleSendEmail = async () => {
    if (!report || !emailTo.trim()) return;
    setSending(true);
    try {
      await sendSummaryEmail(emailTo.trim(), report);
      toast({ title: "Summary emailed", description: emailTo.trim() });
      setEmailOpen(false);
      setEmailTo("");
    } catch (e) {
      toast({ title: "Email failed", description: e.message, variant: "destructive" });
    }
    setSending(false);
  };

  const handleClose = () => {
    setReport(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            News Summary — {targetLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CalendarRange className="w-3.5 h-3.5" />
            Choose a date range to include in the summary report.
          </div>
          {(oldestDate || newestDate) && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-gray-500">Oldest article:</span>
                <span className="font-semibold text-gray-800">{fmt(oldestDate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Newest article:</span>
                <span className="font-semibold text-gray-800">{fmt(newestDate)}</span>
                <CalendarClock className="w-3.5 h-3.5 text-indigo-500" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Start date</Label>
              <Input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">End date</Label>
              <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { if (oldestDate) setStartDate(oldestDate); if (newestDate) setEndDate(newestDate); }}
              disabled={!oldestDate && !newestDate}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CalendarRange className="w-3 h-3" /> Auto-select full range
            </button>
            <button
              type="button"
              onClick={() => oldestDate && setStartDate(oldestDate)}
              disabled={!oldestDate}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Set start to earliest
            </button>
            <button
              type="button"
              onClick={() => newestDate && setEndDate(newestDate)}
              disabled={!newestDate}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Set end to latest
            </button>
          </div>
          <p className="text-xs text-gray-400">
            {itemsInRange.length} news item{itemsInRange.length !== 1 ? "s" : ""} in range.
          </p>

          {report && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-3">
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: "Total", value: report.stats.total, color: "text-gray-800" },
                  { label: "High", value: report.stats.high, color: "text-red-600" },
                  { label: "Medium", value: report.stats.medium, color: "text-amber-600" },
                  { label: "Negative", value: report.stats.negative, color: "text-red-600" },
                  { label: "Positive", value: report.stats.positive, color: "text-green-600" },
                ].map((c) => (
                  <div key={c.label} className="rounded-lg bg-white border border-gray-100 py-2">
                    <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">{c.label}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="font-semibold text-gray-700">
                  Overall Alert: <span className={report.overallAlert === "High" ? "text-red-600" : report.overallAlert === "Medium" ? "text-amber-600" : "text-blue-600"}>{report.overallAlert}</span>
                </span>
                <span className="font-semibold text-gray-700">
                  Overall Status: <span className={report.overallStatus === "Positive" ? "text-green-600" : report.overallStatus === "Negative" ? "text-red-600" : "text-gray-500"}>{report.overallStatus}</span>
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Summary</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.summary}</p>
              </div>
            </div>
          )}
        </div>

        {report && emailOpen && (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-2">
            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="recipient@email.com"
              className="flex-1 min-w-0 h-8 text-sm rounded-md border border-gray-200 bg-white px-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <Button size="sm" onClick={handleSendEmail} disabled={sending || !emailTo.trim()} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? "Sending..." : "Send"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEmailOpen(false); setEmailTo(""); }}>Cancel</Button>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>Close</Button>
          {report && (
            <Button size="sm" variant="outline" onClick={() => setEmailOpen((v) => !v)} className="gap-1">
              <Mail className="w-3.5 h-3.5" /> Email
            </Button>
          )}
          {report && (
            <Button size="sm" onClick={handleDownload} className="gap-1">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
          )}
          <Button size="sm" onClick={handleGenerate} disabled={generating} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {generating ? "Generating..." : report ? "Regenerate" : "Generate Summary"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}