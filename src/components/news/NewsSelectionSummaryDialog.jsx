import React, { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download, Mail, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { generateNewsSummaryPdf } from "./newsSummaryPdf";
import { sendSummaryEmail } from "./newsSummaryEmail";

// Summarizes a user-selected set of news articles (no date-range filter —
// the user already chose exactly which items to include).
export default function NewsSelectionSummaryDialog({ open, onOpenChange, items }) {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);

  const sortedItems = useMemo(
    () => [...(items || [])].sort((a, b) => (b.news_date || "").localeCompare(a.news_date || "")),
    [items]
  );

  const computeStats = (list) => {
    const stats = { total: list.length, high: 0, medium: 0, low: 0, positive: 0, negative: 0, neutral: 0 };
    for (const it of list) {
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
    if (!sortedItems.length) {
      toast({ title: "No articles selected", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setReport(null);
    try {
      const stats = computeStats(sortedItems);
      const overallAlert = dominant(
        { High: stats.high, Medium: stats.medium, Low: stats.low },
        ["High", "Medium", "Low"]
      ) || "None";
      const overallStatus = dominant(
        { Positive: stats.positive, Negative: stats.negative, Neutral: stats.neutral },
        ["Negative", "Positive", "Neutral"]
      ) || "None";

      const itemBrief = sortedItems.slice(0, 40).map((it, i) =>
        `${i + 1}. [${it.alert_status || "Low"}/${it.news_status || "Neutral"}] ${it.news_date || ""}: ${it.headline || ""}${it.summary ? " — " + it.summary.slice(0, 200) : ""}`
      ).join("\n");

      const prompt = `You are writing a concise news summary report for ${sortedItems.length} selected news article${sortedItems.length !== 1 ? "s" : ""}.

Alert level counts: High=${stats.high}, Medium=${stats.medium}, Low=${stats.low}.
News status counts: Positive=${stats.positive}, Negative=${stats.negative}, Neutral=${stats.neutral}.
Overall alert level: ${overallAlert}. Overall news status: ${overallStatus}.

News items:
${itemBrief}

Write a 3-5 sentence executive summary noting the overall alert level, the overall news status, notable themes, and any high-impact items. Be objective and concise.`;
      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      const summary = typeof res === "string" ? res : (res?.output || res?.response || JSON.stringify(res));

      const dates = sortedItems.map(i => i.news_date).filter(Boolean).sort();
      const startDate = dates[0] || new Date().toISOString().split("T")[0];
      const endDate = dates[dates.length - 1] || startDate;

      setReport({
        targetType: "firm",
        targetLabel: "Selected Articles",
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
        stats,
        overallAlert,
        overallStatus,
        summary,
        items: sortedItems,
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
            News Summary — {sortedItems.length} Selected Article{sortedItems.length !== 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Generate an AI executive summary from the {sortedItems.length} article{sortedItems.length !== 1 ? "s" : ""} you selected.
          </p>

          {report && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-3">
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Alert Level</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "Total", value: report.stats.total, color: "text-gray-800" },
                      { label: "High", value: report.stats.high, color: "text-red-600" },
                      { label: "Medium", value: report.stats.medium, color: "text-amber-600" },
                      { label: "Low", value: report.stats.low, color: "text-blue-600" },
                    ].map((c) => (
                      <div key={c.label} className="rounded-lg bg-white border border-gray-100 py-2">
                        <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">{c.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Sentiment</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "Total", value: report.stats.total, color: "text-gray-800" },
                      { label: "Positive", value: report.stats.positive, color: "text-green-600" },
                      { label: "Negative", value: report.stats.negative, color: "text-red-600" },
                      { label: "Neutral", value: report.stats.neutral, color: "text-gray-500" },
                    ].map((c) => (
                      <div key={c.label} className="rounded-lg bg-white border border-gray-100 py-2">
                        <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">{c.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
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