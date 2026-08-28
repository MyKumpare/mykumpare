import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, FileSpreadsheet, Loader2, Upload, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import {
  downloadBenchmarkTemplate,
  parseBenchmarkTemplate,
  readBenchmarkTemplateFile,
} from "./benchmarkTemplate";

export default function BenchmarkTemplateDialog({ open, onOpenChange, existingBenchmarks = [] }) {
  const [parsed, setParsed] = useState(null); // { benchmarks, errors }
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // { created, updated, skipped, errors }
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const existingNames = new Set(
    existingBenchmarks.filter((b) => !b.deleted_at).map((b) => (b.name || "").toLowerCase().trim())
  );

  const reset = () => {
    setParsed(null);
    setFileName("");
    setImportResult(null);
  };

  const handleClose = (open) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await readBenchmarkTemplateFile(file);
      const result = parseBenchmarkTemplate(text);
      setParsed(result);
      setFileName(file.name);
      setImportResult(null);
    } catch (err) {
      toast({ title: "Failed to read file", description: err.message, variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!parsed || parsed.benchmarks.length === 0) return;
    setImporting(true);
    const created = [];
    const updated = [];
    const skipped = [];
    const errors = [];

    for (const bench of parsed.benchmarks) {
      try {
        // Check if benchmark already exists (for returns-only entries)
        const existing = existingBenchmarks.find(
          (b) => !b.deleted_at && (b.name || "").toLowerCase().trim() === bench.name.toLowerCase().trim()
        );

        if (bench._returnsOnly && existing) {
          // Upload returns to an existing benchmark — merge returns
          const existingMap = Object.fromEntries(
            (existing.monthly_returns || []).map((r) => [r.date, r])
          );
          for (const ret of bench.returns) {
            existingMap[ret.date] = ret;
          }
          const mergedReturns = Object.values(existingMap).sort((a, b) =>
            a.date < b.date ? -1 : 1
          );
          await base44.entities.Benchmark.update(existing.id, {
            monthly_returns: mergedReturns,
          });
          updated.push(bench.name);
        } else if (bench._returnsOnly && !existing) {
          errors.push(`"${bench.name}" — not found in existing benchmarks and no metadata provided`);
          skipped.push(bench.name);
        } else if (existing) {
          // Benchmark exists and metadata provided — update metadata + merge returns
          const existingMap = Object.fromEntries(
            (existing.monthly_returns || []).map((r) => [r.date, r])
          );
          for (const ret of bench.returns) {
            existingMap[ret.date] = ret;
          }
          const mergedReturns = Object.values(existingMap).sort((a, b) =>
            a.date < b.date ? -1 : 1
          );
          await base44.entities.Benchmark.update(existing.id, {
            asset_class: bench.asset_class || existing.asset_class,
            region: bench.region || existing.region,
            market_capitalization: bench.market_capitalization || existing.market_capitalization,
            style: bench.style || existing.style,
            inception_date: bench.inception_date || existing.inception_date,
            description: bench.description || existing.description,
            monthly_returns: mergedReturns,
          });
          updated.push(bench.name);
        } else {
          // Create new benchmark
          await base44.entities.Benchmark.create({
            name: bench.name,
            asset_class: bench.asset_class,
            region: bench.region,
            market_capitalization: bench.market_capitalization,
            style: bench.style,
            inception_date: bench.inception_date,
            description: bench.description,
            monthly_returns: bench.returns.sort((a, b) => (a.date < b.date ? -1 : 1)),
          });
          created.push(bench.name);
        }
      } catch (err) {
        errors.push(`"${bench.name}" — ${err.message || "failed"}`);
        skipped.push(bench.name);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["benchmarks"] });
    setImporting(false);
    setImportResult({ created, updated, skipped, errors });
    if (errors.length === 0) {
      toast({
        title: "Import complete",
        description: `${created.length} created, ${updated.length} updated.`,
      });
    } else {
      toast({
        title: "Import finished with errors",
        description: `${created.length} created, ${updated.length} updated, ${skipped.length} skipped.`,
        variant: "destructive",
      });
    }
  };

  const newCount = parsed
    ? parsed.benchmarks.filter((b) => !b._returnsOnly && !existingNames.has(b.name.toLowerCase().trim())).length
    : 0;
  const updateCount = parsed
    ? parsed.benchmarks.filter((b) => existingNames.has(b.name.toLowerCase().trim())).length
    : 0;
  const returnsOnlyCount = parsed
    ? parsed.benchmarks.filter((b) => b._returnsOnly).length
    : 0;
  const totalReturns = parsed
    ? parsed.benchmarks.reduce((sum, b) => sum + b.returns.length, 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Benchmark Template — Upload</DialogTitle>
          <DialogDescription>
            Create one or more benchmarks and upload monthly returns (gross and net) from a spreadsheet.
          </DialogDescription>
        </DialogHeader>

        {!parsed && !importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={downloadBenchmarkTemplate}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download Template
              </Button>
            </div>
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Click to upload CSV or Excel file</p>
              <p className="text-xs text-gray-400 mt-1">.csv or .xlsx — use the template above for the correct format</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        )}

        {parsed && !importResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Parsed <strong>{fileName}</strong></span>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg border bg-gray-50 p-2.5 text-center">
                <p className="text-lg font-bold text-indigo-600">{newCount}</p>
                <p className="text-xs text-gray-500">New</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-2.5 text-center">
                <p className="text-lg font-bold text-amber-600">{updateCount}</p>
                <p className="text-xs text-gray-500">Update</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-2.5 text-center">
                <p className="text-lg font-bold text-cyan-600">{returnsOnlyCount}</p>
                <p className="text-xs text-gray-500">Returns Only</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-2.5 text-center">
                <p className="text-lg font-bold text-gray-600">{totalReturns}</p>
                <p className="text-xs text-gray-500">Return Rows</p>
              </div>
            </div>

            {/* Parse errors */}
            {parsed.errors.length > 0 && (
              <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-700">
                  <p className="font-medium">{parsed.errors.length} parsing warning(s):</p>
                  <ul className="list-disc ml-4 mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {parsed.errors.slice(0, 20).map((e, i) => (
                      <li key={i} className="text-xs">{e}</li>
                    ))}
                    {parsed.errors.length > 20 && (
                      <li className="text-xs italic">…and {parsed.errors.length - 20} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Benchmark preview list */}
            <div className="border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Benchmark</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Asset Class</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Returns</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsed.benchmarks.map((b, i) => {
                    const exists = existingNames.has(b.name.toLowerCase().trim());
                    const action = b._returnsOnly
                      ? exists ? "Update returns" : "Not found"
                      : exists ? "Update" : "Create";
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-800 font-medium">{b.name}</td>
                        <td className="px-3 py-2 text-gray-500">{b.asset_class || "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{b.returns.length}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            action === "Create" ? "bg-indigo-50 text-indigo-600"
                            : action === "Update" ? "bg-amber-50 text-amber-600"
                            : action === "Update returns" ? "bg-cyan-50 text-cyan-600"
                            : "bg-red-50 text-red-500"
                          }`}>
                            {action}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleImport}
                disabled={importing || parsed.benchmarks.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? "Importing…" : `Import ${parsed.benchmarks.length} benchmark${parsed.benchmarks.length !== 1 ? "s" : ""}`}
              </Button>
              <Button type="button" variant="outline" onClick={reset} disabled={importing}>
                Choose different file
              </Button>
            </div>
          </div>
        )}

        {importResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Import complete</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{importResult.created.length}</p>
                <p className="text-xs text-gray-500">Created</p>
              </div>
              <div className="rounded-lg border bg-amber-50 p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{importResult.updated.length}</p>
                <p className="text-xs text-gray-500">Updated</p>
              </div>
              <div className="rounded-lg border bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{importResult.skipped.length}</p>
                <p className="text-xs text-gray-500">Skipped</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <ul className="list-disc ml-4 space-y-0.5 max-h-32 overflow-y-auto">
                    {importResult.errors.map((e, i) => <li key={i} className="text-xs">{e}</li>)}
                  </ul>
                </div>
              </div>
            )}
            <Button type="button" variant="outline" onClick={reset}>
              Upload another file
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}