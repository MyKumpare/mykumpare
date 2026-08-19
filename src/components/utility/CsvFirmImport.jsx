import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, AlertTriangle, Loader2, Download, ArrowLeft, Globe } from "lucide-react";
import { parseCSV, autoMapHeader, validateEnum } from "./csvUtils";
import { enrichFirmFromWeb, mergeEnrichmentData, mergeContactEnrichment, parsePhoneString } from "../ai/firmEnrichment";
import { detectDesignations } from "../contacts/designationDetector";
import { findFirmNameDuplicates } from "../firms/firmNameDuplicateCheck";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

// Only name + firm_types are required. Everything else is auto-filled from the
// firm's website after the record is created. The optional fields below are
// still mappable if a user happens to include them in their file.
const IMPORTABLE_FIELDS = [
  { key: "name", label: "Firm Name", required: true },
  { key: "firm_types", label: "Firm Types (semicolon-separated)", required: true, isArray: true, enum: FIRM_TYPES },
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

// Run web enrichment for a created firm and apply the results: fill empty
// firm fields and create/link contacts discovered on the website. Mutates
// `existingContacts` so subsequent firms dedupe against newly created ones.
async function enrichAndApplyFirm(firm, existingContacts, tenantId) {
  const summary = { name: firm.name, fieldsUpdated: 0, contactsCreated: 0, contactsUpdated: 0, error: null };
  let enriched;
  try {
    enriched = await enrichFirmFromWeb(firm.name, firm.website || "");
  } catch (err) {
    summary.error = err.message || "Enrichment failed";
    return summary;
  }

  // Firm-level: fill only empty fields (append-only merge).
  try {
    const { updates } = mergeEnrichmentData(firm, enriched);
    if (updates && Object.keys(updates).length > 0) {
      await base44.entities.Firm.update(firm.id, updates);
      summary.fieldsUpdated = Object.keys(updates).length;
    }
  } catch { /* non-fatal */ }

  // Contacts: update existing matches (fill missing fields), create new ones.
  const people = (enriched.people || []).filter((p) => p.first_name || p.last_name);
  if (people.length > 0) {
    const { contactUpdates, newPeople } = mergeContactEnrichment(people, existingContacts, firm.id);
    for (const cu of contactUpdates) {
      try {
        await base44.entities.Contact.update(cu.id, cu.updates);
        summary.contactsUpdated++;
      } catch { /* non-fatal */ }
    }
    for (const person of newPeople) {
      try {
        const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
        const designations = detectDesignations(fullName, person.biography);
        const contactData = {
          tenant_id: tenantId,
          first_name: person.first_name || "",
          last_name: person.last_name || "",
          title: person.title || "",
          email: person.email || "",
          linkedin_url: person.linkedin_url || "",
          biography: person.biography || "",
          photo_url: person.photo_url || "",
          bio_url: person.bio_url || "",
          firm_ids: [firm.id],
          employee_status: "Employee",
        };
        if (designations.length > 0) contactData.designations = designations;
        const parsedPhone = person.phone ? parsePhoneString(person.phone) : null;
        if (parsedPhone) contactData.phones = [parsedPhone];
        if (person.education?.length) {
          contactData.education = person.education
            .filter((e) => e && (e.institution || e.degree || e.area_of_specialization))
            .map((e) => ({ ...e, id: crypto.randomUUID() }));
        }
        if (person.professional_experience?.length) {
          contactData.professional_experience = person.professional_experience
            .filter((e) => e && (e.company_name || e.title))
            .map((e) => ({ ...e, id: crypto.randomUUID() }));
        }
        const created = await base44.entities.Contact.create(contactData);
        existingContacts.push(created);
        summary.contactsCreated++;
      } catch { /* non-fatal */ }
    }
  }
  return summary;
}

export default function CsvFirmImport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState("upload");
  const [csvData, setCsvData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(null);
  const [reviewItems, setReviewItems] = useState(null);

  const { data: existingFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(null, 5000),
  });

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
      if (!raw.firm_types) {
        skipped.push({ row: rowIdx + 2, reason: "Missing firm type(s)" });
        return;
      }

      const types = raw.firm_types
        .split(/[;|]/).map((t) => t.trim()).filter(Boolean)
        .map((t) => validateEnum(t, FIRM_TYPES)).filter(Boolean);
      if (types.length === 0) {
        skipped.push({ row: rowIdx + 2, reason: `Invalid firm type: ${raw.firm_types}` });
        return;
      }

      const firm = { tenant_id, name: raw.name, firm_types: [...new Set(types)] };
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

  const handleImportClick = () => {
    const { valid, skipped: validationSkipped } = buildFirms();
    if (valid.length === 0) return;
    // Check each firm against existing firms + earlier firms in the same file
    // for exact/similar names. Flagged firms need explicit accept/reject before
    // they're created — mirrors the duplicate check used when adding a firm manually.
    const seenNames = [];
    const items = valid.map((b) => {
      const dups = findFirmNameDuplicates(b.firm.name, [...(existingFirms || []), ...seenNames]);
      seenNames.push({ name: b.firm.name, id: `batch_${b.row}` });
      return { firm: b.firm, row: b.row, duplicates: dups, accept: dups.length === 0 };
    });
    const flagged = items.filter((it) => it.duplicates.length > 0);
    if (flagged.length > 0) {
      setReviewItems({ items, validationSkipped });
      setStage("review");
    } else {
      runImport(items, validationSkipped);
    }
  };

  const runImport = async (items, validationSkipped) => {
    setStage("importing");
    const accepted = items.filter((it) => it.accept);
    const duplicateSkipped = items
      .filter((it) => !it.accept)
      .map((it) => ({ row: it.row, reason: "Skipped — duplicate firm name" }));
    const skipped = [...(validationSkipped || []), ...duplicateSkipped];
    const createdFirms = [];
    const failed = [];

    try {
      const BATCH = 100;
      for (let i = 0; i < accepted.length; i += BATCH) {
        const batch = accepted.slice(i, i + BATCH);
        try {
          const created = await base44.entities.Firm.bulkCreate(batch.map((b) => b.firm));
          (Array.isArray(created) ? created : []).forEach((f) => createdFirms.push(f));
        } catch (err) {
          batch.forEach((b) => failed.push({ row: b.row, error: err.message || "Create failed" }));
        }
      }

      const successCount = createdFirms.length;
      queryClient.invalidateQueries({ queryKey: ["firms"] });

      // Auto-fill each created firm from its website. Enrichment is slow
      // (30-90s/firm), so run sequentially with a live progress indicator.
      const enrichmentSummaries = [];
      if (createdFirms.length > 0) {
        setStage("enriching");
        setEnrichProgress({ current: 0, total: createdFirms.length, currentName: createdFirms[0].name, summaries: [] });
        let existingContacts = [];
        try {
          existingContacts = await base44.entities.Contact.list(null, 5000);
        } catch { /* start empty */ }
        const tenantId = user?.linked_firm_id;
        for (let i = 0; i < createdFirms.length; i++) {
          const firm = createdFirms[i];
          setEnrichProgress({ current: i, total: createdFirms.length, currentName: firm.name, summaries: enrichmentSummaries });
          const summary = await enrichAndApplyFirm(firm, existingContacts, tenantId);
          enrichmentSummaries.push(summary);
        }
        setEnrichProgress({ current: createdFirms.length, total: createdFirms.length, currentName: "", summaries: enrichmentSummaries });
        queryClient.invalidateQueries({ queryKey: ["firms"] });
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
      }

      setResults({
        total: csvData.rows.length,
        success: successCount,
        skipped,
        failed,
        enrichmentSummaries,
      });
      setEnrichProgress(null);
      setStage("results");
      if (successCount > 0) toast({ title: `✅ ${successCount} firm${successCount === 1 ? "" : "s"} imported` });
    } catch (err) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
      setStage("mapping");
    }
  };

  const downloadTemplate = () => {
    const headers = "name,firm_types";
    const sample = "Example Capital,Investment Manager";
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
    setEnrichProgress(null);
    setReviewItems(null);
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
          <p className="font-semibold text-gray-600">Only two columns are required:</p>
          <p><strong>Firm Name</strong> and <strong>Firm Types</strong> (semicolon-separated for multiple).</p>
          <p className="text-gray-400 mt-1">After import, each firm is automatically enriched from its public website — logo, description, address, phone, LinkedIn, and key personnel are filled in for you. This takes ~30-90 seconds per firm.</p>
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
                  const missing = !raw.name || !raw.firm_types;
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

        <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 flex items-start gap-2">
          <Globe className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700">
            After creating the firms, each one is automatically enriched from its public website (logo, description, address, phone, LinkedIn, personnel). This runs sequentially and takes ~30-90 seconds per firm.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleImportClick} disabled={valid.length === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Upload className="w-4 h-4 mr-1" /> Import {valid.length} Firm{valid.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "review" && reviewItems) {
    const { items, validationSkipped } = reviewItems;
    const flagged = items.filter((it) => it.duplicates.length > 0);
    const autoAccepted = items.length - flagged.length;
    const toggleItem = (idx) => {
      const next = items.map((it, i) => (i === idx ? { ...it, accept: !it.accept } : it));
      setReviewItems({ items: next, validationSkipped });
    };
    const acceptedCount = items.filter((it) => it.accept).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Review duplicates</p>
            <p className="text-xs text-gray-400">
              {flagged.length} firm{flagged.length === 1 ? "" : "s"} match existing names · {autoAccepted} will import automatically
            </p>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={reset}>
            <ArrowLeft className="w-3.5 h-3.5" /> Start Over
          </Button>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Uncheck a firm to skip it. Checked firms will be created and then auto-filled from the web.
          </p>
        </div>

        <div className="space-y-2 max-h-[45vh] overflow-y-auto">
          {flagged.map((it, i) => (
            <div key={i} className={`rounded-lg border p-3 ${it.accept ? "border-indigo-200 bg-white" : "border-gray-200 bg-gray-50 opacity-70"}`}>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={it.accept} onCheckedChange={() => toggleItem(i)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{it.firm.name}</p>
                  <p className="text-[11px] text-gray-400">Row {it.row} · {(it.firm.firm_types || []).join(", ")}</p>
                  <div className="mt-1.5 space-y-1">
                    {it.duplicates.map((d, di) => (
                      <div key={di} className="text-xs text-amber-700 flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>Matches <strong>{d.name}</strong> — {d.reasons.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </label>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={reset}>Cancel</Button>
          <Button
            onClick={() => runImport(items, validationSkipped)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Upload className="w-4 h-4 mr-1" /> Import {acceptedCount} Firm{acceptedCount === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "importing") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-gray-700">Creating firms...</p>
      </div>
    );
  }

  if (stage === "enriching" && enrichProgress) {
    const pct = enrichProgress.total > 0 ? (enrichProgress.current / enrichProgress.total) * 100 : 0;
    return (
      <div className="space-y-4 py-2">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-700">Auto-filling from the web...</p>
            <p className="text-xs text-gray-500 truncate">
              {enrichProgress.current < enrichProgress.total
                ? `Firm ${enrichProgress.current + 1} of ${enrichProgress.total}: ${enrichProgress.currentName}`
                : `Completing ${enrichProgress.total} firm${enrichProgress.total === 1 ? "" : "s"}`}
            </p>
          </div>
          <span className="text-xs text-gray-400 tabular-nums">{enrichProgress.current}/{enrichProgress.total}</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        {enrichProgress.summaries.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {enrichProgress.summaries.map((s, i) => (
              <div key={i} className="px-3 py-2 text-xs flex justify-between gap-2">
                <span className="text-gray-700 font-medium truncate">{s.name}</span>
                <span className={s.error ? "text-amber-600" : "text-gray-500"}>
                  {s.error ? "⚠ " + s.error : `✓ ${s.fieldsUpdated} field(s), ${s.contactsCreated} new, ${s.contactsUpdated} updated`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (stage === "results" && results) {
    const enriched = results.enrichmentSummaries || [];
    const enrichedOk = enriched.filter((s) => !s.error);
    const enrichedFail = enriched.filter((s) => s.error);
    const totalContactsCreated = enriched.reduce((sum, s) => sum + (s.contactsCreated || 0), 0);
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

        {enriched.length > 0 && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-1">
            <p className="text-xs font-semibold text-indigo-700">Web auto-fill</p>
            <p className="text-xs text-gray-600">
              {enrichedOk.length} firm{enrichedOk.length === 1 ? "" : "s"} enriched · {totalContactsCreated} contact{totalContactsCreated === 1 ? "" : "s"} created
              {enrichedFail.length > 0 ? ` · ${enrichedFail.length} could not be enriched` : ""}
            </p>
          </div>
        )}

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