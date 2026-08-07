import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, AlertTriangle, Loader2, Download, ArrowLeft } from "lucide-react";

// ── Importable contact fields ──────────────────────────────────────────────
const IMPORTABLE_FIELDS = [
  { key: "first_name", label: "First Name", required: true },
  { key: "last_name", label: "Last Name", required: true },
  { key: "middle_name", label: "Middle Name" },
  { key: "salutation", label: "Salutation", enum: ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof.", "Hon."] },
  { key: "suffix", label: "Suffix", enum: ["Jr.", "Sr.", "II", "III", "IV", "Esq.", "CFA", "CPA", "MBA", "PhD", "MD"] },
  { key: "title", label: "Job Title" },
  { key: "email", label: "Email" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "employee_status", label: "Employee Status", enum: ["Employee", "Non-Employee"] },
  { key: "contact_status", label: "Contact Status", enum: ["Active", "Inactive"] },
  { key: "contact_type", label: "Contact Type", enum: ["Allocator", "Investment Consultant", "Investment Manager", "Securities Broker", "Trade Organization Representative"] },
  { key: "biography", label: "Biography" },
  { key: "notes", label: "Notes" },
  { key: "firm_name", label: "Firm Name (lookup)", virtual: true },
  { key: "phone", label: "Phone", virtual: true },
];

const FIELD_BY_KEY = Object.fromEntries(IMPORTABLE_FIELDS.map(f => [f.key, f]));

const FIELD_ALIASES = {
  first_name: ["firstname", "fname", "givenname", "first"],
  last_name: ["lastname", "lname", "surname", "familyname", "last"],
  middle_name: ["middlename", "mname", "middle"],
  salutation: ["salutation", "prefix", "honorific", "titleprefix", "nameprefix"],
  suffix: ["suffix", "namesuffix"],
  title: ["title", "jobtitle", "position", "role", "job"],
  email: ["email", "emailaddress", "mail", "emailaddress1", "email1"],
  linkedin_url: ["linkedin", "linkedinurl", "linkedinprofile", "linkedinprofileurl"],
  employee_status: ["employeestatus", "employeetype", "employmentstatus", "employmenttype"],
  contact_status: ["contactstatus", "status"],
  contact_type: ["contacttype", "type"],
  biography: ["biography", "bio", "summary", "about", "description"],
  notes: ["notes", "note", "comments", "comment", "remarks"],
  firm_name: ["firm", "firmname", "company", "companyname", "organization", "organizationname", "org"],
  phone: ["phone", "phonenumber", "tel", "telephone", "mobile", "cell", "workphone", "phonenumber1"],
};

function normalizeKey(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function autoMapHeader(header) {
  const norm = normalizeKey(header);
  for (const [fieldKey, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some(a => normalizeKey(a) === norm)) return fieldKey;
  }
  return "";
}

// ── CSV parser ──────────────────────────────────────────────────────────────
function detectDelimiter(text) {
  const firstLine = text.split("\n")[0] || "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && counts[ch] !== undefined) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
}

function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(clean);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const next = clean[i + 1];
    if (inQuotes) {
      if (char === '"') {
        if (next === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field); field = "";
      } else if (char === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ""));
}

// ── Phone parser ───────────────────────────────────────────────────────────
function parsePhone(str) {
  if (!str || !str.trim()) return null;
  const m = str.trim().match(/^(?:\+?(\d{1,3}))?[\s().-]*\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})$/);
  if (!m) return null;
  return {
    id: crypto.randomUUID(),
    country_code: m[1] || "",
    area_code: m[2] || "",
    number_mid: m[3] || "",
    number_last: m[4] || "",
    phone_type: "",
    is_default: true,
  };
}

// ── Enum validator ─────────────────────────────────────────────────────────
function validateEnum(value, options) {
  if (!value || !value.trim()) return undefined;
  const v = value.trim();
  if (options.includes(v)) return v;
  return options.find(o => o.toLowerCase() === v.toLowerCase());
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CsvContactImport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState("upload");
  const [csvData, setCsvData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(),
  });

  const firmByName = useMemo(() => {
    const map = {};
    (firms || []).forEach(f => {
      if (!f.deleted_at) map[f.name.toLowerCase().trim()] = f.id;
    });
    return map;
  }, [firms]);

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
      const headers = rows[0].map(h => h.trim());
      const dataRows = rows.slice(1);
      const auto = {};
      headers.forEach((h, i) => { auto[i] = autoMapHeader(h); });
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

  const buildContacts = useCallback(() => {
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

      if (!raw.first_name || !raw.last_name) {
        skipped.push({ row: rowIdx + 2, reason: "Missing first or last name" });
        return;
      }

      const contact = {
        tenant_id,
        first_name: raw.first_name,
        last_name: raw.last_name,
        contact_status: "Active",
      };

      if (raw.middle_name) contact.middle_name = raw.middle_name;
      if (raw.title) contact.title = raw.title;
      if (raw.email) contact.email = raw.email;
      if (raw.linkedin_url) contact.linkedin_url = raw.linkedin_url;
      if (raw.biography) contact.biography = raw.biography;
      if (raw.notes) contact.notes = raw.notes;

      for (const key of ["salutation", "suffix", "employee_status", "contact_status", "contact_type"]) {
        if (raw[key]) {
          const v = validateEnum(raw[key], FIELD_BY_KEY[key].enum);
          if (v) contact[key] = v;
        }
      }

      let firmName = "";
      if (raw.firm_name) {
        firmName = raw.firm_name;
        const fid = firmByName[raw.firm_name.toLowerCase().trim()];
        if (fid) contact.firm_ids = [fid];
      }

      if (raw.phone) {
        const phone = parsePhone(raw.phone);
        if (phone) contact.phones = [phone];
      }

      valid.push({ contact, row: rowIdx + 2, firmName });
    });

    return { valid, skipped };
  }, [csvData, mapping, user, firmByName]);

  const handleImport = async () => {
    setStage("importing");
    const { valid, skipped } = buildContacts();
    let successCount = 0;
    const failed = [];
    const firmsNotFound = [];

    try {
      const BATCH = 100;
      for (let i = 0; i < valid.length; i += BATCH) {
        const batch = valid.slice(i, i + BATCH);
        try {
          await base44.entities.Contact.bulkCreate(batch.map(b => b.contact));
          successCount += batch.length;
          batch.forEach(b => { if (b.firmName && !b.contact.firm_ids) firmsNotFound.push(b.firmName); });
        } catch (err) {
          batch.forEach(b => failed.push({ row: b.row, error: err.message || "Create failed" }));
        }
      }

      setResults({ total: csvData.rows.length, success: successCount, skipped, failed, firmsNotFound });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setStage("results");
      if (successCount > 0) toast({ title: `✅ ${successCount} contact${successCount === 1 ? "" : "s"} imported` });
    } catch (err) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
      setStage("mapping");
    }
  };

  const downloadTemplate = () => {
    const headers = IMPORTABLE_FIELDS.map(f => f.key).join(",");
    const sample = "John,Doe,,Mr.,,Portfolio Manager,john@example.com,https://linkedin.com/in/johndoe,Employee,Active,Investment Manager,,Notes here,Example Firm,555-123-4567";
    const blob = new Blob([headers + "\n" + sample + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contact_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setCsvData(null);
    setMapping({});
    setResults(null);
    setStage("upload");
  };

  // ── Upload stage ──
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
          onClick={() => document.getElementById("csv-file-input").click()}
          className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer text-center ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-white hover:border-indigo-300"}`}
        >
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
            <Upload className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Upload CSV File</p>
            <p className="text-xs text-gray-400 mt-1">Drag & drop or click to browse</p>
          </div>
          <input id="csv-file-input" type="file" accept=".csv,.txt" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        </div>
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
          <p className="font-semibold text-gray-600">Supported fields:</p>
          <p>{IMPORTABLE_FIELDS.map(f => f.label).join(", ")}</p>
          <p className="text-gray-400 mt-1">First Name and Last Name are required. Firm Name is matched to existing firms in your database.</p>
        </div>
      </div>
    );
  }

  // ── Mapping stage ──
  if (stage === "mapping" && csvData) {
    const { valid, skipped } = buildContacts();
    const activeFields = IMPORTABLE_FIELDS.filter(f => Object.values(mapping).includes(f.key));
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
                    {IMPORTABLE_FIELDS.map(field => (
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
                  {activeFields.map(f => (
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
                  const missing = !raw.first_name || !raw.last_name;
                  return (
                    <tr key={ri} className={missing ? "bg-red-50" : ri % 2 ? "bg-gray-50/50" : ""}>
                      {activeFields.map(f => (
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
            <Upload className="w-4 h-4 mr-1" /> Import {valid.length} Contact{valid.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Importing stage ──
  if (stage === "importing") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-gray-700">Importing contacts...</p>
      </div>
    );
  }

  // ── Results stage ──
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

        {results.firmsNotFound?.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">Firms not found ({results.firmsNotFound.length})</p>
            <p className="text-xs text-amber-600">Contacts imported but not linked: {results.firmsNotFound.slice(0, 5).join(", ")}{results.firmsNotFound.length > 5 ? "..." : ""}</p>
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