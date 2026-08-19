import React, { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, AlertTriangle, Loader2, Download, ArrowLeft } from "lucide-react";
import { parseCSV, autoMapHeader, validateEnum } from "./csvUtils";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const IMPORTABLE_FIELDS = [
  { key: "name", label: "Firm Name", required: true },
  { key: "firm_types", label: "Firm Types (semicolon-separated)", isArray: true, enum: FIRM_TYPES },
  { key: "logo_url", label: "Logo URL" },
  { key: "website", label: "Website" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "email", label: "Email" },
  { key: "year_founded", label: "Year Founded", numeric: true },
  { key: "description", label: "Description" },
];

const FIELD_ALIASES = {
  name: ["name", "firmname", "company", "companyname", "organization", "org", "firm"],
  firm_types: ["firmtypes", "firmtype", "types", "type", "category", "categories"],
  logo_url: ["logourl", "logo", "logoimage", "logoimageurl"],
  website: ["website", "site", "url", "web", "webpage", "homepage"],
  linkedin_url: ["linkedin", "linkedinurl", "linkedinprofile"],
  email: ["email", "emailaddress", "mail", "contactemail"],
  year_founded: ["yearfounded", "founded", "foundedyear", "year", "established", "establishedyear"],
  description: ["description", "desc", "summary", "about", "bio", "overview"],
};

export default function CsvFirmImport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState("upload");
  const [csvData, setCsvData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.match(/\.(csv|txt)$/i)) {
      toast({ title: "Invalid file", description: "Please upload a .csv file.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result);
      if (rows.length < 2) {
        toast({ title: "Empty CSV", description: "The file has no data rows.", variant: "destructive" });
        return;
      }
      const headers = rows[0].map((h) => h.trim());
      const dataRows = rows.slice(1);
      const auto = {};
      headers.forEach((h, i) => { auto[i] = autoMapHeader(h, FIELD_ALIASES); });
      setCsvData({ headers, rows: dataRows });
      setMapping(auto);
      setStage("mapping");
    };
    reader.readAsText(file);
  }, []);

  const mappedFields = useMemo(() => {
    if (!csvData) return [];
    return csvData.headers.map((h, i) => ({
      header: h,
      fieldKey: mapping[i] || "",
      previewValue: csvData.rows[0]?.[i] || "",
    }));
  }, [csvData, mapping]);

  const buildFirms = useCallback(() => {
    if (!csvData) return { valid: [], skipped: [] };
    const tenant_id = user?.linked_firm_id;
    const valid = [];
    const skipped = [];

    csvData.rows.forEach((row, rowIdx) => {
      const raw = {};
      csvData.headers.forEach((_, i) => {
        const fk = mapping[i];
        if (fk) raw[fk] = (row[i] || "").trim();
      });

      if (!raw.name) {
        skipped.push({ row: rowIdx + 2, reason: "Missing firm name" });
        return;
      }

      const firm = { tenant_id, name: raw.name };

      if (raw.firm_types) {
        const types = raw.firm_types
          .split(/[;|]/).map((t) => t.trim()).filter(Boolean)
          .map((t) => validateEnum(t, FIRM_TYPES)).filter(Boolean);
        if (types.length > 0) firm.firm_types = [...new Set(types)];
      }
      if (raw.logo_url) firm.logo_url = raw.logo_url;
      if (raw.website) firm.website = raw.website;
      if (raw.linkedin_url) firm.linkedin_url = raw.linkedin_url;
      if (raw.email) firm.email = raw.email;
      if (raw.year_founded) {
        const y = parseInt(raw.year_founded, 10);
        if (!isNaN(y)) firm.year_founded = y;
      }
      if (raw.description) firm.description = raw.description;

      valid.push({ firm, row: rowIdx + 2 });
    });

    return { valid, skipped };
  }, [csvData, mapping, user]);

  const handleImport = async () => {
    setStage("importing");
    const { valid, skipped } = buildFirms();
    let successCount = 0;
    const failed = [];

    try {
      const BATCH = 100;
      for (let i = 0; i < valid.length; i += BATCH) {
        const batch = valid.slice(i, i + BATCH);
        try {
          await base44.entities.Firm.bulkCreate(batch.map((b) => b.firm));
          successCount += batch.length;
        } catch (err) {
          batch.forEach((b) => failed.push({ row: b.row, error: err.message || "Create failed" }));
        }
      }

      setResults({ total: csvData.rows.length, success: successCount, skipped, failed });
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      setStage("results");
      if (successCount > 0) toast({ title: `✅ ${successCount} firm${successCount === 1 ? "" : "s"} imported` });
    } catch (err) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
      setStage("mapping");
    }
  };

  const downloadTemplate = () => {
    const headers = IMPORTABLE_FIELDS.map((f) => f.key).join(",");
    const sample = "Example Capital,Investment Manager;Allocator,https://example.com/logo.png,https://example.com,https://linkedin.com/company/example,info@example.com,2005,Example Capital is a global investment manager.";
    const blob = new Blob([headers + "\n" + sample + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "firm_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setCsvData(null);
    setMapping({});
    setResults(null);
    setStage("upload");
  };

  if (stage === "upload") {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-indigo-600" onClick={downloadTemplate}>
            <Download className="w-3.5 h-3.5" /> Download Template
          </Button>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => document.getElementById("firm-csv-file-input").click()}
          className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer text-center ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-white hover:border-indigo-300"}`}
        >
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
            <Upload className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Upload Firm CSV File</p>
            <p className="text-xs text-gray-400 mt-1">Drag & drop or click to browse</p>
          </div>
          <input id="firm-csv-file-input" type="file" accept=".csv,.txt" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        </div>
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
          <p className="font-semibold text-gray-600">Supported fields:</p>
          <p>{IMPORTABLE_FIELDS.map((f) => f.label).join(", ")}</p>
          <p className="text-gray-400 mt-1">Firm Name is required. Firm Types can be multiple, separated by semicolons.</p>
        </div>
      </div>
    );
  }

  if (stage === "mapping" && csvData) {
    const { valid, skipped } = buildFirms();
    const activeFields = IMPORTABLE_FIELDS.filter((f) => Object.values(mapping).includes(f.key));
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Map Columns</p>
            <p className="text-xs text-gray-400">{csvData.rows.length} rows · {valid.length} valid · {skipped.length} will skip</p>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={reset}>
            <ArrowLeft className="w-3.5 h-3.5" /> Start Over
          </Button>
        </div>

        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-4">CSV Column</div>
            <div className="col-span-4">Map to Field</div>
            <div className="col-span-4">Preview (row 1)</div>
          </div>
          {mappedFields.map((f, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-gray-100 items-center text-sm">
              <div className="col-span-4 font-medium text-gray-700 truncate">{f.header}</div>
              <div className="col-span-4">
                <Select value={f.fieldKey || "__skip__"} onValueChange={(v) => setMapping({ ...mapping, [i]: v === "__skip__" ? "" : v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">— Skip —</SelectItem>
                    {IMPORTABLE_FIELDS.map((field) => (
                      <SelectItem key={field.key} value={field.key}>
                        {field.label}{field.required ? " *" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4 text-xs text-gray-500 truncate">{f.previewValue || "—"}</div>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preview (first 5 rows)</p>
          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {activeFields.map((f) => (
                    <th key={f.key} className="px-2 py-1.5 text-left font-semibold text-gray-500 whitespace-nowrap">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.rows.slice(0, 5).map((row, ri) => {
                  const raw = {};
                  csvData.headers.forEach((_, i) => {
                    const fk = mapping[i];
                    if (fk) raw[fk] = (row[i] || "").trim();
                  });
                  const missing = !raw.name;
                  return (
                    <tr key={ri} className={missing ? "bg-red-50" : ri % 2 ? "bg-gray-50/50" : ""}>
                      {activeFields.map((f) => (
                        <td key={f.key} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{raw[f.key] || <span className="text-gray-300">—</span>}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleImport} disabled={valid.length === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Upload className="w-4 h-4 mr-1" /> Import {valid.length} Firm{valid.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "importing") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-gray-700">Importing firms...</p>
      </div>
    );
  }

  if (stage === "results" && results) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${results.success > 0 ? "bg-green-50" : "bg-red-50"}`}>
            {results.success > 0 ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Import Complete</p>
            <p className="text-xs text-gray-400">{results.success} imported · {results.skipped.length} skipped · {results.failed.length} failed · {results.total} total</p>
          </div>
        </div>

        {results.skipped.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Skipped ({results.skipped.length})</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {results.skipped.slice(0, 20).map((s, i) => (
                <div key={i} className="px-3 py-2 text-xs flex justify-between gap-2">
                  <span className="text-gray-500">Row {s.row}</span>
                  <span className="text-gray-700 truncate">{s.reason}</span>
                </div>
              ))}
              {results.skipped.length > 20 && <div className="px-3 py-2 text-xs text-gray-400 text-center">... and {results.skipped.length - 20} more</div>}
            </div>
          </div>
        )}

        {results.failed.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Failed ({results.failed.length})</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 divide-y divide-red-100">
              {results.failed.slice(0, 20).map((f, i) => (
                <div key={i} className="px-3 py-2 text-xs flex justify-between gap-2">
                  <span className="text-gray-500">Row {f.row}</span>
                  <span className="text-red-600 truncate">{f.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={reset} className="bg-indigo-600 hover:bg-indigo-700 text-white">Import Another File</Button>
        </div>
      </div>
    );
  }

  return null;
}