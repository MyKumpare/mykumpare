import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Download,
  Upload,
  ClipboardPaste,
  Trash,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { downloadBenchmarkTemplate, parseBenchmarkTemplate, readBenchmarkTemplateFile } from "./benchmarkTemplate";

/**
 * Toolbar for bulk monthly-returns management across all (filtered) benchmarks.
 * Mirrors the controls in the Edit Benchmark "Returns" tab, but operates on
 * the entire filtered benchmark list at once:
 *   - Download Data  → export all returns from filtered benchmarks as CSV
 *   - Download Template → blank benchmark+returns template
 *   - Upload CSV     → upload a template file (CSV/Excel) and apply returns
 *   - Paste Excel    → paste returns rows inline and apply
 *   - Delete All     → clear monthly_returns from all filtered benchmarks
 *
 * Props:
 *   benchmarks       — the filtered benchmark list to operate on
 *   onUploadTemplate — opens the full BenchmarkTemplateDialog (handled by parent)
 */
export default function BenchmarkBulkReturnsToolbar({ benchmarks = [], onUploadTemplate }) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pastePreview, setPastePreview] = useState(null); // { benchmarks, errors }
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // ─── Download Data: export all returns from filtered benchmarks ───
  const handleDownloadData = () => {
    if (benchmarks.length === 0) {
      toast({ title: "Nothing to export", description: "No benchmarks match the current filter.", variant: "destructive" });
      return;
    }

    const lines = [];
    lines.push("[RETURNS]");
    lines.push("Benchmark Name,Date,Gross Return (%),Net Return (%)");

    let totalRows = 0;
    benchmarks.forEach((b) => {
      const returns = b.monthly_returns || [];
      if (returns.length === 0) return;
      returns.forEach((r) => {
        const gross = r.return_value !== undefined && r.return_value !== null ? r.return_value : "";
        const net = r.net_return_value !== undefined && r.net_return_value !== null ? r.net_return_value : "";
        const row = [`"${b.name}"`, r.date, gross, net].join(",");
        lines.push(row);
        totalRows++;
      });
    });

    if (totalRows === 0) {
      toast({ title: "No returns data", description: "None of the filtered benchmarks have any monthly returns.", variant: "destructive" });
      return;
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "benchmark_returns_all.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export ready", description: `${totalRows} return rows from ${benchmarks.filter((b) => (b.monthly_returns || []).length > 0).length} benchmarks exported.` });
  };

  // ─── Upload CSV: parse a template file and apply returns ───
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await readBenchmarkTemplateFile(file);
      const result = parseBenchmarkTemplate(text);
      await applyParsedBenchmarks(result.benchmarks, result.errors);
    } catch (err) {
      toast({ title: "Failed to read file", description: err.message, variant: "destructive" });
    }
    setBusy(false);
    e.target.value = "";
  };

  // ─── Paste Excel: parse pasted text and preview before applying ───
  const handlePastePreview = () => {
    if (!pasteText.trim()) return;
    const result = parseBenchmarkTemplate(pasteText);
    setPastePreview(result);
  };

  const handlePasteApply = async () => {
    if (!pastePreview) return;
    setBusy(true);
    await applyParsedBenchmarks(pastePreview.benchmarks, pastePreview.errors);
    setBusy(false);
    setShowPaste(false);
    setPasteText("");
    setPastePreview(null);
  };

  // ─── Shared: apply parsed benchmarks (returns-only) to existing records ───
  const applyParsedBenchmarks = async (parsedBenchmarks, parseErrors = []) => {
    if (parsedBenchmarks.length === 0) {
      toast({ title: "Nothing to import", description: "No valid benchmark return rows found.", variant: "destructive" });
      return;
    }

    const benchMap = {};
    benchmarks.forEach((b) => {
      benchMap[(b.name || "").toLowerCase().trim()] = b;
    });

    let updatedCount = 0;
    let skippedCount = 0;
    let totalReturnRows = 0;
    const errors = [...parseErrors];

    for (const bench of parsedBenchmarks) {
      const existing = benchMap[bench.name.toLowerCase().trim()];
      if (!existing) {
        errors.push(`"${bench.name}" — not found in current benchmark list; skipped.`);
        skippedCount++;
        continue;
      }
      if (bench.returns.length === 0) {
        skippedCount++;
        continue;
      }
      try {
        const existingMap = Object.fromEntries(
          (existing.monthly_returns || []).map((r) => [r.date, r])
        );
        for (const ret of bench.returns) {
          existingMap[ret.date] = ret;
          totalReturnRows++;
        }
        const mergedReturns = Object.values(existingMap).sort((a, b) =>
          a.date < b.date ? -1 : 1
        );
        await base44.entities.Benchmark.update(existing.id, {
          monthly_returns: mergedReturns,
        });
        updatedCount++;
      } catch (err) {
        errors.push(`"${bench.name}" — ${err.message || "failed"}`);
        skippedCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["benchmarks"] });

    if (errors.length === 0) {
      toast({
        title: "Returns imported",
        description: `${totalReturnRows} return rows applied to ${updatedCount} benchmark${updatedCount !== 1 ? "s" : ""}.`,
      });
    } else {
      toast({
        title: "Import finished with warnings",
        description: `${updatedCount} updated, ${skippedCount} skipped. ${errors.length} issue(s).`,
        variant: "destructive",
      });
    }
  };

  // ─── Delete All: clear monthly_returns from all filtered benchmarks ───
  const handleDeleteAll = async () => {
    const withReturns = benchmarks.filter((b) => (b.monthly_returns || []).length > 0);
    if (withReturns.length === 0) {
      toast({ title: "Nothing to delete", description: "No benchmarks in the current filter have any returns.", variant: "destructive" });
      setConfirmDeleteAll(false);
      return;
    }
    setBusy(true);
    let deletedCount = 0;
    let totalRows = 0;
    const errors = [];
    for (const b of withReturns) {
      try {
        totalRows += (b.monthly_returns || []).length;
        await base44.entities.Benchmark.update(b.id, { monthly_returns: [] });
        deletedCount++;
      } catch (err) {
        errors.push(`"${b.name}" — ${err.message || "failed"}`);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["benchmarks"] });
    setBusy(false);
    setConfirmDeleteAll(false);
    if (errors.length === 0) {
      toast({
        title: "Returns cleared",
        description: `${totalRows} return rows removed from ${deletedCount} benchmark${deletedCount !== 1 ? "s" : ""}.`,
      });
    } else {
      toast({
        title: "Delete finished with errors",
        description: `${deletedCount} cleared, ${errors.length} failed.`,
        variant: "destructive",
      });
    }
  };

  const withReturnsCount = benchmarks.filter((b) => (b.monthly_returns || []).length > 0).length;

  return (
    <div className="rounded-lg border bg-gray-50 p-3 space-y-2.5">
      <p className="text-xs text-gray-500">
        Bulk monthly returns management — operates on all {benchmarks.length} benchmark{benchmarks.length !== 1 ? "s" : ""} in the current filter
        {withReturnsCount > 0 && ` (${withReturnsCount} with returns data)`}.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Download Data */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8 bg-white"
          onClick={handleDownloadData}
          disabled={busy || withReturnsCount === 0}
          title="Export all returns from filtered benchmarks as CSV"
        >
          <Download className="w-3.5 h-3.5" />
          Download Data
        </Button>

        {/* Download Template */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8 bg-white"
          onClick={downloadBenchmarkTemplate}
          disabled={busy}
          title="Download a blank benchmark + returns template"
        >
          <Download className="w-3.5 h-3.5" />
          Template
        </Button>

        {/* Upload CSV */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8 bg-white"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          title="Upload a CSV or Excel file with benchmark returns"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Upload CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Paste Excel */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8 bg-white"
          onClick={() => { setShowPaste(!showPaste); setPastePreview(null); }}
          disabled={busy}
          title="Paste benchmark returns data from Excel"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          Paste Excel
        </Button>

        {/* Delete All */}
        {withReturnsCount > 0 && !confirmDeleteAll && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 bg-white text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 ml-auto"
            onClick={() => setConfirmDeleteAll(true)}
            disabled={busy}
            title="Clear all monthly returns from filtered benchmarks"
          >
            <Trash className="w-3.5 h-3.5" />
            Delete All
          </Button>
        )}
        {confirmDeleteAll && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-red-600 font-medium">
              Clear returns from {withReturnsCount} benchmark{withReturnsCount !== 1 ? "s" : ""}?
            </span>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white px-3"
              onClick={handleDeleteAll}
              disabled={busy}
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setConfirmDeleteAll(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Paste area */}
      {showPaste && (
        <div className="space-y-2 p-3 bg-white border rounded-lg">
          <Label className="text-xs font-medium text-gray-600">
            Paste benchmark returns (format: Benchmark Name, Date, Gross Return %, Net Return %)
          </Label>
          <textarea
            className="w-full h-32 text-sm border rounded px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
            placeholder={"Benchmark Name\tDate\tGross Return (%)\tNet Return (%)\nMSCI Emerging Markets\t2024-01-31\t1.2500\t1.1000\nMSCI Emerging Markets\t2024-02-29\t0.8300\t0.7200"}
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setPastePreview(null); }}
          />
          <div className="flex gap-2">
            {!pastePreview ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs h-8"
                  onClick={handlePastePreview}
                  disabled={!pasteText.trim() || busy}
                >
                  Preview
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => { setShowPaste(false); setPasteText(""); setPastePreview(null); }}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs h-8"
                  onClick={handlePasteApply}
                  disabled={busy || pastePreview.benchmarks.length === 0}
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Apply {pastePreview.benchmarks.length} benchmark{pastePreview.benchmarks.length !== 1 ? "s" : ""}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setPastePreview(null)}
                  disabled={busy}
                >
                  Back
                </Button>
              </>
            )}
          </div>

          {/* Paste preview */}
          {pastePreview && (
            <div className="space-y-2">
              {pastePreview.benchmarks.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {pastePreview.benchmarks.length} benchmark{pastePreview.benchmarks.length !== 1 ? "s" : ""}, {" "}
                    {pastePreview.benchmarks.reduce((s, b) => s + b.returns.length, 0)} return rows parsed
                  </span>
                </div>
              )}
              {pastePreview.errors.length > 0 && (
                <div className="flex gap-2 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-700">
                    <p className="font-medium">{pastePreview.errors.length} parsing warning(s):</p>
                    <ul className="list-disc ml-4 mt-0.5 space-y-0.5 max-h-24 overflow-y-auto">
                      {pastePreview.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                      {pastePreview.errors.length > 10 && <li className="italic">…and {pastePreview.errors.length - 10} more</li>}
                    </ul>
                  </div>
                </div>
              )}
              {pastePreview.benchmarks.length > 0 && (
                <div className="border rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-medium text-gray-600">Benchmark</th>
                        <th className="text-right px-2 py-1.5 font-medium text-gray-600">Returns</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pastePreview.benchmarks.map((b, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5 text-gray-800 font-medium">{b.name}</td>
                          <td className="px-2 py-1.5 text-right text-gray-500">{b.returns.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}