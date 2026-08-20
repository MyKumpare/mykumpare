import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, AlertTriangle, Loader2, Download, ArrowLeft } from "lucide-react";
import { parseCSV, autoMapHeader, validateEnum } from "./csvUtils";
import { findFirmNameDuplicates } from "../firms/firmNameDuplicateCheck";
import { findProductDuplicates } from "../products/productNameDuplicateCheck";
import MergeTargetPicker from "./MergeTargetPicker";
import ImportJobsDashboard from "./ImportJobsDashboard";

const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];
const PRODUCT_STATUSES = ["Not Reviewed", "In-Process", "On-Hold", "Rejected", "Approved", "Removed"];

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

// Required: name, product_type, firm_name, firm_type. firm_type is used to
// create the associated firm when it isn't already in the system.
const IMPORTABLE_FIELDS = [
  { key: "name", label: "Product Name", required: true },
  { key: "product_type", label: "Product Type", required: true, enum: PRODUCT_TYPES },
  { key: "firm_name", label: "Associated Firm Name", required: true, virtual: true },
  { key: "firm_type", label: "Associated Firm Type", required: true, virtual: true, enum: FIRM_TYPES },
  { key: "product_status", label: "Product Status", enum: PRODUCT_STATUSES },
  { key: "asset_class", label: "Asset Class" },
  { key: "geography", label: "Geography" },
  { key: "market_cap", label: "Market Cap" },
  { key: "style", label: "Style" },
  { key: "investment_process", label: "Investment Process" },
  { key: "implementation_process", label: "Implementation Process" },
  { key: "diversification_classification", label: "Diversification Classification" },
  { key: "aapryl_style", label: "Aapryl Style" },
  { key: "vehicle_offerings", label: "Vehicle Offerings (semicolon-separated)", isArray: true },
  { key: "description", label: "Description" },
];

const FIELD_ALIASES = {
  name: ["name", "productname", "product", "strategy", "strategyname"],
  product_type: ["producttype", "type", "offeringtype"],
  firm_name: ["firm", "firmname", "company", "companyname", "organization", "org", "manager"],
  firm_type: ["firmtype", "associatedfirmtype", "companytype", "firmcategory"],
  product_status: ["productstatus", "status", "reviewstatus"],
  asset_class: ["assetclass", "asset", "class"],
  geography: ["geography", "geo", "region", "focus"],
  market_cap: ["marketcap", "marketcapitalization", "cap"],
  style: ["style", "investmentstyle"],
  investment_process: ["investmentprocess", "process"],
  implementation_process: ["implementationprocess", "implementation", "approach"],
  diversification_classification: ["diversificationclassification", "diversification", "concentration"],
  aapryl_style: ["aaprylstyle", "aapryl"],
  vehicle_offerings: ["vehicleofferings", "vehicle", "vehicles", "shareclass", "shareclasses"],
  description: ["description", "desc", "summary", "about", "overview"],
};

// Build a product object from mapped raw CSV values. `firm` is the resolved
// existing firm (exact match or user-chosen); may be null when the firm is
// still pending review.
function buildProductFromRaw(raw, productType, firm, tenantId) {
  const product = {
    tenant_id: tenantId,
    name: raw.name,
    product_type: productType,
    firm_id: firm ? firm.id : "",
    firm_name: firm ? firm.name : raw.firm_name,
  };
  if (raw.product_status) {
    const s = validateEnum(raw.product_status, PRODUCT_STATUSES);
    if (s) product.product_status = s;
  }
  if (raw.asset_class) product.asset_class = raw.asset_class;
  if (raw.geography) product.geography = raw.geography;
  if (raw.market_cap) product.market_cap = raw.market_cap;
  if (raw.style) product.style = raw.style;
  if (raw.investment_process) product.investment_process = raw.investment_process;
  if (raw.implementation_process) product.implementation_process = raw.implementation_process;
  if (raw.diversification_classification) product.diversification_classification = raw.diversification_classification;
  if (raw.aapryl_style) product.aapryl_style = raw.aapryl_style;
  if (raw.vehicle_offerings) {
    const v = raw.vehicle_offerings.split(/[;|]/).map((t) => t.trim()).filter(Boolean);
    if (v.length > 0) product.vehicle_offerings = v;
  }
  if (raw.description) product.description = raw.description;
  return product;
}

export default function CsvProductImport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState("upload");
  const [csvData, setCsvData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [reviewItems, setReviewItems] = useState(null);
  const [firmPickerIdx, setFirmPickerIdx] = useState(null);

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(null, 5000),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(null, 5000),
  });

  const firmByName = useMemo(() => {
    const map = {};
    (firms || []).forEach((f) => {
      if (!f.deleted_at) map[f.name.toLowerCase().trim()] = { id: f.id, name: f.name };
    });
    return map;
  }, [firms]);

  // Existing products grouped by firm_id, for duplicate-product checks.
  const productsByFirm = useMemo(() => {
    const map = {};
    (products || []).forEach((p) => {
      if (p.deleted_at) return;
      if (!map[p.firm_id]) map[p.firm_id] = [];
      map[p.firm_id].push(p);
    });
    return map;
  }, [products]);

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

  // Build the full review set: every valid row becomes an item. Items with an
  // exact firm match are checked for product duplicates immediately; items
  // whose firm isn't an exact match but is similar to an existing firm go to
  // firm review; rows missing required fields or with no similar firm are
  // skipped.
  const buildReview = useCallback(() => {
    if (!csvData) return { items: [], skipped: [] };
    const tenant_id = user?.linked_firm_id;
    const items = [];
    const skipped = [];

    csvData.rows.forEach((row, rowIdx) => {
      const raw = {};
      csvData.headers.forEach((_, i) => {
        const fk = mapping[i];
        if (fk) raw[fk] = (row[i] || "").trim();
      });

      const baseSkip = { product_name: raw.name || '', product_type: raw.product_type || '', firm_name: raw.firm_name || '', firm_type: raw.firm_type || '' };
      if (!raw.name) { skipped.push({ row: rowIdx + 2, reason: "Missing product name", ...baseSkip, product_name: '' }); return; }
      if (!raw.product_type) { skipped.push({ row: rowIdx + 2, reason: "Missing product type", ...baseSkip, product_type: '' }); return; }
      if (!raw.firm_name) { skipped.push({ row: rowIdx + 2, reason: "Missing associated firm name", ...baseSkip, firm_name: '' }); return; }
      if (!raw.firm_type) { skipped.push({ row: rowIdx + 2, reason: "Missing associated firm type", ...baseSkip, firm_type: '' }); return; }

      const productType = validateEnum(raw.product_type, PRODUCT_TYPES);
      if (!productType) { skipped.push({ row: rowIdx + 2, reason: `Invalid product type: ${raw.product_type}`, ...baseSkip }); return; }
      const firmType = validateEnum(raw.firm_type, FIRM_TYPES);
      if (!firmType) { skipped.push({ row: rowIdx + 2, reason: `Invalid firm type: ${raw.firm_type}`, ...baseSkip }); return; }

      const exactFirm = firmByName[raw.firm_name.toLowerCase().trim()];

      if (exactFirm) {
        const product = buildProductFromRaw(raw, productType, exactFirm, tenant_id);
        const dups = findProductDuplicates(raw.name, productsByFirm[exactFirm.id] || []);
        const isExactProduct = dups.some((d) => d.score === 1);
        items.push({
          product, row: rowIdx + 2, firmName: raw.firm_name,
          firmId: exactFirm.id, firmDups: [], productDups: dups,
          accept: dups.length === 0,
          autoSkipped: isExactProduct,
          createFirm: false, firmType,
        });
      } else {
        // No exact firm match — look for similar firms so the user can map to
        // the existing one, or create a new firm using the firm_type column.
        const firmDups = findFirmNameDuplicates(raw.firm_name, firms || []);
        const product = buildProductFromRaw(raw, productType, null, tenant_id);
        if (firmDups.length > 0) {
          items.push({
            product, row: rowIdx + 2, firmName: raw.firm_name,
            firmId: null, firmDups, productDups: [],
            accept: false,
            createFirm: false, firmType,
          });
        } else {
          // No similar firm either — auto-create a new firm using firm_type.
          items.push({
            product, row: rowIdx + 2, firmName: raw.firm_name,
            firmId: null, firmDups: [], productDups: [],
            accept: true,
            createFirm: true, firmType,
          });
        }
      }
    });

    return { items, skipped };
  }, [csvData, mapping, user, firmByName, firms, productsByFirm]);

  const handleImportClick = () => {
    const { items, skipped } = buildReview();
    if (items.length === 0) return;
    const needsReview = items.some((it) => (!it.firmId && !it.createFirm) || (it.firmId && it.productDups.length > 0 && !it.accept && !it.autoSkipped));
    if (needsReview) {
      setReviewItems({ items, skipped });
      setStage("review");
    } else {
      runImport(items, skipped);
    }
  };

  // Submit the reviewed items to the server-side import job. The backend
  // bulk-creates the accepted products and records an ImportJob. The job
  // completes server-side, so the import survives navigation/close. We hand
  // off to the Import Jobs dashboard so the user can watch progress.
  const runImport = async (items, skipped) => {
    setStage("importing");
    try {
      const res = await base44.functions.invoke("startImportJob", {
        source: "product",
        items,
        validationSkipped: skipped,
        tenant_id: user?.linked_firm_id,
      });
      const data = res?.data || res || {};
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
      setStage("job_status");
      if ((data.created || 0) > 0) {
        toast({ title: `✅ ${data.created} product${data.created === 1 ? "" : "s"} submitted` });
      }
    } catch (err) {
      toast({ title: "Import failed", description: err?.message || "Failed to start import job", variant: "destructive" });
      setStage("mapping");
    }
  };

  const downloadTemplate = () => {
    const headers = "name,product_type,firm_name,firm_type";
    const sample = "US Large Cap Equity,Investment Manager Product,Example Capital,Investment Manager";
    const blob = new Blob([headers + "\n" + sample + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setCsvData(null);
    setMapping({});
    setResults(null);
    setReviewItems(null);
    setFirmPickerIdx(null);
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
          onClick={() => document.getElementById("product-csv-file-input").click()}
          className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer text-center ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-white hover:border-indigo-300"}`}
        >
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
            <Upload className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Upload Product CSV File</p>
            <p className="text-xs text-gray-400 mt-1">Drag & drop or click to browse</p>
          </div>
          <input id="product-csv-file-input" type="file" accept=".csv,.txt" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        </div>
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
          <p className="font-semibold text-gray-600">Four columns are required:</p>
          <p><strong>Product Name</strong>, <strong>Product Type</strong>, <strong>Associated Firm Name</strong>, and <strong>Associated Firm Type</strong>.</p>
          <p className="text-gray-400 mt-1">Firm Name is matched to existing firms in your database. If the firm isn't found, a new firm is created using the Associated Firm Type and the product is linked to it. If the name is similar to an existing firm, you'll be asked to map it, create a new firm, or skip. Products that already exist (exact or similar name) in the associated firm will be flagged for you to accept or reject.</p>
        </div>
      </div>
    );
  }

  if (stage === "mapping" && csvData) {
    const { items, skipped } = buildReview();
    const validCount = items.length;
    const activeFields = IMPORTABLE_FIELDS.filter((f) => Object.values(mapping).includes(f.key));
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Map Columns</p>
            <p className="text-xs text-gray-400">{csvData.rows.length} rows · {validCount} valid · {skipped.length} will skip</p>
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
                  const missing = !raw.name || !raw.product_type || !raw.firm_name || !raw.firm_type;
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
          <Button onClick={handleImportClick} disabled={validCount === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Upload className="w-4 h-4 mr-1" /> Import {validCount} Product{validCount === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "review" && reviewItems) {
    const { items, skipped } = reviewItems;
    const firmReviewItems = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.firmId && !it.createFirm && it.firmDups.length > 0);
    const productReviewItems = items.map((it, i) => ({ it, i })).filter(({ it }) => it.firmId && it.productDups.length > 0 && !it.autoSkipped);
    const createFirmItems = items.map((it, i) => ({ it, i })).filter(({ it }) => it.createFirm && it.accept);
    const autoAccepted = items.filter((it) => it.firmId && it.productDups.length === 0).length;
    const exactSkipped = items.filter((it) => it.autoSkipped).length;

    const updateItem = (idx, patch) => {
      const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
      setReviewItems({ items: next, skipped });
    };
    const applyFirmMapping = (idx, firmId, firmName) => {
      const it = items[idx];
      const product = { ...it.product, firm_id: firmId, firm_name: firmName };
      const dups = findProductDuplicates(it.product.name, productsByFirm[firmId] || []);
      const isExactProduct = dups.some((d) => d.score === 1);
      return { firmId, product, productDups: dups, accept: dups.length === 0, autoSkipped: isExactProduct, createFirm: false, mergeTargetName: firmName };
    };
    const setFirm = (idx, firmId, firmName) => {
      const sourceName = items[idx].firmName;
      const next = items.map((it, i) => {
        if (i === idx) return { ...it, ...applyFirmMapping(i, firmId, firmName) };
        // Auto-map all other pending firm-review items with the same imported
        // firm name so the user doesn't have to map them one by one.
        if (it.firmName === sourceName && !it.firmId && !it.createFirm && it.firmDups.length > 0) {
          return { ...it, ...applyFirmMapping(i, firmId, firmName) };
        }
        return it;
      });
      setReviewItems({ items: next, skipped });
      setFirmPickerIdx(null);
    };
    const skipFirmReview = (idx) => {
      updateItem(idx, { accept: false, productDups: [] });
      setFirmPickerIdx(null);
    };
    const createNewFirm = (idx) => {
      updateItem(idx, { createFirm: true, accept: true, firmId: null, productDups: [], autoSkipped: false });
      setFirmPickerIdx(null);
    };
    const setAccept = (idx, val) => updateItem(idx, { accept: val });
    const isExact = (dups) => dups.some((d) => d.score === 1);

    // Final accepted = items with a resolved firm or a new firm to create, and accept=true.
    const finalAccepted = items.filter((it) => it.accept && (it.firmId || it.createFirm)).length;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Review before import</p>
            <p className="text-xs text-gray-400">
              {firmReviewItems.length} firm{firmReviewItems.length === 1 ? "" : "s"} to confirm · {productReviewItems.length} duplicate product{productReviewItems.length === 1 ? "" : "s"} · {autoAccepted} will import automatically{exactSkipped > 0 ? ` · ${exactSkipped} exact duplicate${exactSkipped === 1 ? "" : "s"} skipped` : ""}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={reset}>
            <ArrowLeft className="w-3.5 h-3.5" /> Start Over
          </Button>
        </div>

        {firmReviewItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Firms not found — confirm to avoid duplicates</p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {firmReviewItems.map(({ it, i }) => (
                <div key={i} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{it.firmName}</p>
                      <p className="text-[11px] text-gray-400">Row {it.row} · Product: {it.product.name}</p>
                      <div className="mt-1.5 space-y-1">
                        {it.firmDups.map((d, di) => (
                          <div key={di} className="text-xs text-amber-700 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>Similar to <strong>{d.name}</strong> — {d.reasons.join(", ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => skipFirmReview(i)} className="px-2.5 py-1 text-xs rounded-md border bg-white text-gray-600 border-gray-300 hover:bg-gray-50">Skip</button>
                      <button onClick={() => createNewFirm(i)} className="px-2.5 py-1 text-xs rounded-md border bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50">Create new</button>
                      <button onClick={() => setFirmPickerIdx(firmPickerIdx === i ? null : i)} className="px-2.5 py-1 text-xs rounded-md border bg-white text-teal-700 border-teal-300 hover:bg-teal-50">Map to firm</button>
                    </div>
                  </div>
                  {firmPickerIdx === i && (
                    <MergeTargetPicker
                      duplicates={it.firmDups}
                      allFirms={firms}
                      importedName={it.firmName}
                      onPick={(firmId, chosenName) => {
                        const f = (firms || []).find((x) => x.id === firmId);
                        setFirm(i, firmId, chosenName || (f ? f.name : it.firmName));
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {createFirmItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New firms to be created ({createFirmItems.length})</p>
            <div className="space-y-2 max-h-[30vh] overflow-y-auto">
              {createFirmItems.map(({ it, i }) => (
                <div key={i} className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{it.firmName}</p>
                    <p className="text-[11px] text-gray-400">Row {it.row} · Type: {it.firmType} · Product: {it.product.name}</p>
                  </div>
                  <button onClick={() => updateItem(i, { createFirm: false, accept: false })} className="px-2.5 py-1 text-xs rounded-md border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 flex-shrink-0">Skip</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {productReviewItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Duplicate products — review</p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {productReviewItems.map(({ it, i }) => (
                <div key={i} className={`rounded-lg border p-3 ${it.accept ? "border-indigo-200 bg-white" : "border-gray-200 bg-gray-50"}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{it.product.name}</p>
                      <p className="text-[11px] text-gray-400">Row {it.row} · {it.product.firm_name}</p>
                      <div className="mt-1.5 space-y-1">
                        {it.productDups.map((d, di) => (
                          <div key={di} className="text-xs text-amber-700 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>{isExact([d]) ? "Exact match" : "Similar match"}: <strong>{d.name}</strong> — {d.reasons.join(", ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setAccept(i, false)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${!it.accept ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => setAccept(i, true)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${it.accept ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {skipped.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-500 mb-1">Will skip ({skipped.length})</p>
            <div className="max-h-24 overflow-y-auto divide-y divide-gray-100">
              {skipped.slice(0, 20).map((s, i) => (
                <div key={i} className="py-1 text-xs flex justify-between gap-2">
                  <span className="text-gray-500">Row {s.row}</span>
                  <span className="text-gray-700 truncate">{s.reason}</span>
                </div>
              ))}
              {skipped.length > 20 && <div className="py-1 text-[11px] text-gray-400 text-center">…and {skipped.length - 20} more</div>}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={reset}>Cancel</Button>
          <Button onClick={() => runImport(items, skipped)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Upload className="w-4 h-4 mr-1" /> Import {finalAccepted} Product{finalAccepted === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "importing") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-gray-700">Importing products...</p>
      </div>
    );
  }

  if (stage === "job_status") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700">
            Your product import has been submitted and is processing in the background — this survives navigation and close. Track progress below or reopen <strong>Import Jobs</strong> anytime from the Utility menu.
          </p>
        </div>
        <ImportJobsDashboard />
        <div className="flex justify-end">
          <Button onClick={reset} className="bg-indigo-600 hover:bg-indigo-700 text-white">Import Another File</Button>
        </div>
      </div>
    );
  }

  return null;
}