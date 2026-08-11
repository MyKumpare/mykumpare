import React, { useState, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { format, parseISO, parse } from "date-fns";
import { Download, Search, FileText, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import PortfolioPdfSummary from "./PortfolioPdfSummary";

function buildLevelOptions(portfolio) {
  const opts = [{ value: "all", label: "All Levels", refId: "" }];
  opts.push({ value: "portfolio", label: "Portfolio Total", refId: "" });
  if (portfolio.advisor_type && portfolio.advisor_firm_id) {
    opts.push({
      value: "advisor",
      label: `${portfolio.advisor_type === "Manager of Managers" ? "MoM" : "IM"}: ${portfolio.advisor_firm_name || ""}`,
      refId: portfolio.advisor_firm_id,
    });
  }
  (portfolio.sub_managers || []).forEach((sm) => {
    opts.push({
      value: "sub_manager",
      label: `Sub-Manager: ${sm.product_name}`,
      refId: sm.product_id,
    });
  });
  return opts;
}

function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

function parseFlexibleDate(str) {
  if (!str) return null;
  let d = parse(str, "MM/dd/yyyy", new Date());
  if (!isNaN(d.getTime())) return d;
  try {
    d = parseISO(str);
    if (!isNaN(d.getTime())) return d;
  } catch {}
  return null;
}

export default function PortfolioReportModal({ portfolio, open, onOpenChange }) {
  const [reportType, setReportType] = useState("funding"); // funding | aum | both
  const [levelFilter, setLevelFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const pdfSummaryRef = useRef(null);

  const levelOptions = useMemo(() => buildLevelOptions(portfolio), [portfolio]);

  const generatePdf = async () => {
    if (!pdfSummaryRef.current) return;
    setGeneratingPdf(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      const canvas = await html2canvas(pdfSummaryRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "letter");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      pdf.save(`portfolio_summary_${portfolio.portfolio_name || "portfolio"}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const results = useMemo(() => {
    let items = [];

    // Funding history (allocation history)
    if (reportType === "funding" || reportType === "both") {
      (portfolio.allocation_history || []).forEach((a) => {
        items.push({
          category: "Funding",
          date: a.activity_date,
          type: a.activity_type,
          amount: a.amount,
          notes: stripHtml(a.notes),
          level: a.level,
          reference_name: a.reference_name || "Portfolio Total",
          document: a.document,
        });
      });
    }

    // Historical AUM
    if (reportType === "aum" || reportType === "both") {
      (portfolio.historical_aum || []).forEach((a) => {
        items.push({
          category: "AUM",
          date: a.date,
          type: "AUM Value",
          amount: a.value,
          notes: "",
          level: a.level,
          reference_name: a.reference_name || "Portfolio Total",
          document: null,
        });
      });
    }

    // Apply level filter
    if (levelFilter !== "all") {
      const opt = levelOptions.find((o) => o.value === levelFilter);
      items = items.filter(
        (i) =>
          i.level === levelFilter &&
          (!opt?.refId || i.reference_name === opt.label)
      );
    }

    // Apply date filter
    if (dateFrom) {
      const fromD = parseFlexibleDate(dateFrom);
      if (fromD) {
        items = items.filter(
          (i) => parseFlexibleDate(i.date) >= fromD
        );
      }
    }
    if (dateTo) {
      const toD = parseFlexibleDate(dateTo);
      if (toD) {
        items = items.filter((i) => parseFlexibleDate(i.date) <= toD);
      }
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.type?.toLowerCase().includes(q) ||
          i.notes?.toLowerCase().includes(q) ||
          i.reference_name?.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q)
      );
    }

    // Sort by date descending
    items.sort((a, b) => {
      const da = parseFlexibleDate(a.date)?.getTime() || 0;
      const db = parseFlexibleDate(b.date)?.getTime() || 0;
      return db - da;
    });

    return items;
  }, [portfolio, reportType, levelFilter, dateFrom, dateTo, search, levelOptions]);

  const exportCsv = () => {
    const headers = [
      "Category",
      "Date",
      "Type",
      "Amount",
      "Level",
      "Reference",
      "Notes",
    ];
    const rows = results.map((r) => [
      r.category,
      r.date ? format(parseISO(r.date), "MM/dd/yyyy") : "",
      r.type || "",
      r.amount != null ? r.amount : "",
      r.level || "",
      r.reference_name || "",
      (r.notes || "").replace(/,/g, ";"),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio_report_${portfolio.portfolio_name || "portfolio"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Portfolio Report — {portfolio.portfolio_name}
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-3">
          {/* Report type */}
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
              Report Type
            </Label>
            <div className="flex gap-2">
              {[
                { value: "funding", label: "Funding History", icon: DollarSign },
                { value: "aum", label: "Historical AUM", icon: TrendingUp },
                { value: "both", label: "Both", icon: FileText },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReportType(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border text-sm font-medium transition-colors ${
                      reportType === opt.value
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Level + Date range + Search */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
                Level
              </Label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full h-9 text-sm rounded-md border border-input bg-transparent px-2 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {levelOptions.map((o) => (
                  <option key={o.value + (o.refId || "")} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
                Search
              </Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search type, notes, reference..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 text-sm rounded-md border border-input bg-transparent pl-8 pr-3 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
                Date From
              </Label>
              <input
                type="text"
                placeholder="MM/DD/YYYY"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full h-9 text-sm rounded-md border border-input bg-transparent px-3 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
                Date To
              </Label>
              <input
                type="text"
                placeholder="MM/DD/YYYY"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full h-9 text-sm rounded-md border border-input bg-transparent px-3 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-[350px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">
                    Category
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">
                    Date
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">
                    Type
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">
                    Amount
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">
                    Reference
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-gray-400 italic"
                    >
                      No results found
                    </td>
                  </tr>
                ) : (
                  results.map((r, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            r.category === "Funding"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-green-50 text-green-700"
                          }`}
                        >
                          {r.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                        {r.date ? format(parseISO(r.date), "MM/dd/yyyy") : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{r.type || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-800 font-medium whitespace-nowrap">
                        {r.amount != null
                          ? r.amount.toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">
                        {r.reference_name || "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                        {r.notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          {results.length} record{results.length !== 1 ? "s" : ""} found
        </p>

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={exportCsv}
            disabled={results.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button
            onClick={generatePdf}
            disabled={generatingPdf}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            {generatingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            {generatingPdf ? "Generating..." : "Generate PDF"}
          </Button>
        </DialogFooter>

        {/* Hidden PDF summary — rendered offscreen for html2canvas capture */}
        <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
          <PortfolioPdfSummary ref={pdfSummaryRef} portfolio={portfolio} />
        </div>
      </DialogContent>
    </Dialog>
  );
}