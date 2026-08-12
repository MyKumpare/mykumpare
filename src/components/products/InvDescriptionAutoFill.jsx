import React, { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, Sparkles, Loader2, AlertTriangle, Check, GitMerge, X, Upload } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Fields the LLM extracts, mapped to product inv_desc keys + UI labels.
// text fields support "merge" (append); arrays merge as union; numerics accept/reject only.
const TEXT_FIELDS = [
  { key: "investment_edge", label: "Investment Edge" },
  { key: "investment_philosophy", label: "Investment Philosophy" },
  { key: "investment_universe", label: "Investment Universe" },
  { key: "investment_process", label: "Investment Process" },
  { key: "investment_process_buy_discipline", label: "Buy Discipline" },
  { key: "investment_process_sell_discipline", label: "Sell Discipline" },
  { key: "portfolio_expectations", label: "Product Expectations" },
];
const ARRAY_FIELDS = [{ key: "market_positioning", label: "Market Positioning" }];
const NUMERIC_FIELDS = [
  { key: "tracking_error_min", label: "Tracking Error Min" },
  { key: "tracking_error_max", label: "Tracking Error Max" },
  { key: "excess_return_min", label: "Excess Return Min" },
  { key: "excess_return_max", label: "Excess Return Max" },
  { key: "holdings_min", label: "Holdings Min" },
  { key: "holdings_max", label: "Holdings Max" },
];
const ALL_FIELDS = [...TEXT_FIELDS, ...ARRAY_FIELDS, ...NUMERIC_FIELDS];

const CAT_KEYWORDS = ["new manager", "igc"];

const isRelevantDoc = (d) => {
  const cats = (d.categories || []).join(" ").toLowerCase();
  return CAT_KEYWORDS.some((k) => cats.includes(k));
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    investment_edge: { type: "string" },
    investment_philosophy: { type: "string" },
    investment_universe: { type: "string" },
    investment_process: { type: "string" },
    investment_process_buy_discipline: { type: "string" },
    investment_process_sell_discipline: { type: "string" },
    market_positioning: { type: "array", items: { type: "string" } },
    portfolio_expectations: { type: "string" },
    tracking_error_min: { type: "number" },
    tracking_error_max: { type: "number" },
    excess_return_min: { type: "number" },
    excess_return_max: { type: "number" },
    holdings_min: { type: "number" },
    holdings_max: { type: "number" },
  },
};

const isEmpty = (v) =>
  v === null ||
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0);

const sameValue = (a, b) => {
  if (isEmpty(a) || isEmpty(b)) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : [a];
    const bb = Array.isArray(b) ? b : [b];
    return aa.every((x) => bb.some((y) => String(x) === String(y)));
  }
  return String(a).trim() === String(b).trim();
};

// Build the merged descriptions from user decisions per field.
// decision: "accept" | "merge" | "reject"
function applyDecisions(current, extracted, decisions) {
  const result = { ...current };
  for (const f of ALL_FIELDS) {
    const ex = extracted?.[f.key];
    if (isEmpty(ex)) continue;
    const cur = current?.[f.key];
    const dec = decisions[f.key];
    if (dec === "reject") continue;
    if (dec === "accept") {
      result[f.key] = ex;
    } else if (dec === "merge") {
      if (ARRAY_FIELDS.includes(f)) {
        const curArr = Array.isArray(cur) ? cur : [];
        result[f.key] = Array.from(new Set([...curArr, ...(Array.isArray(ex) ? ex : [ex])]));
      } else {
        const curStr = isEmpty(cur) ? "" : String(cur);
        const exStr = String(ex);
        result[f.key] = curStr
          ? `${curStr}\n\n--- Extracted ---\n${exStr}`
          : exStr;
      }
    }
  }
  return result;
}

export default function InvDescriptionAutoFill({
  firmId,
  productName,
  descriptions,
  onApply,
  onRequestEdit,
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [uploadedUrls, setUploadedUrls] = useState([]); // {url, name}
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [decisions, setDecisions] = useState({});
  const fileInputRef = useRef(null);

  const { data: firmDocs = [] } = useQuery({
    queryKey: ["firm-documents", firmId],
    queryFn: () =>
      base44.entities.FirmDocument.filter({ deleted_at: { $exists: false }, firm_id: firmId }, "-created_date", 500),
    enabled: !!firmId && open,
  });

  const relevantDocs = useMemo(() => {
    const rel = firmDocs.filter(isRelevantDoc);
    return rel.length ? rel : firmDocs;
  }, [firmDocs]);

  const selectedDocs = relevantDocs.filter((d) => selectedIds.includes(d.id));
  const allSources = [
    ...selectedDocs.map((d) => ({ url: d.file_url, name: d.file_name })),
    ...uploadedUrls,
  ];

  const reset = () => {
    setSelectedIds([]);
    setUploadedUrls([]);
    setExtracted(null);
    setDecisions({});
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const toggleDoc = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (f) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
          return { url: file_url, name: f.name };
        })
      );
      setUploadedUrls((prev) => [...prev, ...uploaded]);
    } catch (err) {
      toast({ title: "Upload failed", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeUploaded = (url) =>
    setUploadedUrls((prev) => prev.filter((u) => u.url !== url));

  const handleExtract = async () => {
    if (!allSources.length) {
      toast({ title: "Select at least one document source.", variant: "destructive" });
      return;
    }
    setExtracting(true);
    setExtracted(null);
    setDecisions({});
    try {
      const prompt = `You are an investment analyst assistant. From the attached document(s) for the investment product "${productName || "(unnamed)"}", extract the investment description fields below. Return ONLY the structured JSON. Use the exact verbatim text from the document where possible (do not summarize or invent). If a field is not present, return an empty string (or empty array for market_positioning). For numeric ranges, provide numbers only (percentages as numbers, e.g. 2.5). market_positioning values should be one of: Recovery Cycle, Mid Cycle, Late Cycle, Recession Cycle if mentioned.`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: allSources.map((s) => s.url),
        response_json_schema: EXTRACTION_SCHEMA,
        add_context_from_internet: false,
      });
      const data = res || {};
      setExtracted(data);
      // default decisions
      const init = {};
      for (const f of ALL_FIELDS) {
        const ex = data[f.key];
        const cur = descriptions?.[f.key];
        if (isEmpty(ex)) {
          init[f.key] = "reject";
        } else if (isEmpty(cur) || sameValue(cur, ex)) {
          init[f.key] = "accept"; // new or identical -> accept
        } else {
          init[f.key] = "reject"; // conflict -> default reject (user must choose)
        }
      }
      setDecisions(init);
    } catch (err) {
      toast({
        title: "Extraction failed",
        description: String(err?.message || err),
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const conflicts = extracted
    ? ALL_FIELDS.filter((f) => {
        const ex = extracted[f.key];
        const cur = descriptions?.[f.key];
        return !isEmpty(ex) && !isEmpty(cur) && !sameValue(cur, ex);
      })
    : [];
  const newFields = extracted
    ? ALL_FIELDS.filter((f) => {
        const ex = extracted[f.key];
        const cur = descriptions?.[f.key];
        return !isEmpty(ex) && (isEmpty(cur) || sameValue(cur, ex));
      })
    : [];

  const handleApply = () => {
    const merged = applyDecisions(descriptions, extracted, decisions);
    onApply(merged);
    onRequestEdit?.();
    toast({ title: "Investment description updated from documents." });
    close();
  };

  const openDialog = () => {
    onRequestEdit?.();
    setOpen(true);
  };

  const setDecision = (key, val) =>
    setDecisions((prev) => ({ ...prev, [key]: val }));

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openDialog}
        className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Auto-Populate from Documents
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Auto-Populate Inv. Description
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              Select a New Manager Document and/or IGC Package for this firm, then
              extract the investment description fields. Review any conflicts before
              applying.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {!extracted ? (
              <>
                {/* Source selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Firm Documents
                  </Label>
                  {relevantDocs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      No documents found for this firm. Upload one below.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {relevantDocs.map((d) => {
                        const rel = isRelevantDoc(d);
                        return (
                          <label
                            key={d.id}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-md border bg-white hover:bg-indigo-50/40 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedIds.includes(d.id)}
                              onCheckedChange={() => toggleDoc(d.id)}
                            />
                            <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {d.file_name}
                              </p>
                              <p className="text-[11px] text-gray-400 truncate">
                                {(d.categories || []).join(", ") || "Uncategorized"}
                              </p>
                            </div>
                            {rel && (
                              <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                NMD/IGC
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Upload new */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Or Upload Document(s)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      Upload
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  {uploadedUrls.length > 0 && (
                    <div className="space-y-1">
                      {uploadedUrls.map((u) => (
                        <div
                          key={u.url}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-gray-50"
                        >
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs text-gray-700 truncate flex-1">
                            {u.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeUploaded(u.url)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Review */}
                {conflicts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <p className="text-xs font-medium">
                        {conflicts.length} field(s) have similar/existing data.
                        Choose Accept, Merge, or Reject for each.
                      </p>
                    </div>
                    {conflicts.map((f) => {
                      const ex = extracted[f.key];
                      const cur = descriptions?.[f.key];
                      const isArr = ARRAY_FIELDS.includes(f);
                      return (
                        <div
                          key={f.key}
                          className="rounded-md border border-amber-200 bg-amber-50/30 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold text-gray-800">
                              {f.label}
                            </Label>
                            <div className="flex items-center gap-1">
                              <DecButton
                                active={decisions[f.key] === "accept"}
                                onClick={() => setDecision(f.key, "accept")}
                                icon={Check}
                                label="Accept"
                                color="indigo"
                              />
                              <DecButton
                                active={decisions[f.key] === "merge"}
                                onClick={() => setDecision(f.key, "merge")}
                                icon={GitMerge}
                                label="Merge"
                                color="teal"
                              />
                              <DecButton
                                active={decisions[f.key] === "reject"}
                                onClick={() => setDecision(f.key, "reject")}
                                icon={X}
                                label="Reject"
                                color="gray"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="rounded border bg-white p-2">
                              <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">
                                Current
                              </p>
                              <p className="text-xs text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {isArr ? (Array.isArray(cur) ? cur.join(", ") : cur) : String(cur || "—")}
                              </p>
                            </div>
                            <div className="rounded border bg-indigo-50/40 p-2">
                              <p className="text-[10px] uppercase text-indigo-400 font-semibold mb-1">
                                Extracted
                              </p>
                              <p className="text-xs text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {isArr ? (Array.isArray(ex) ? ex.join(", ") : ex) : String(ex)}
                              </p>
                            </div>
                          </div>
                          {decisions[f.key] === "merge" && (
                            <p className="text-[10px] text-teal-600 italic">
                              Merge will combine extracted content with the current value.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {newFields.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      New fields (no existing data)
                    </p>
                    <div className="space-y-1.5">
                      {newFields.map((f) => {
                        const ex = extracted[f.key];
                        const isArr = ARRAY_FIELDS.includes(f);
                        return (
                          <div
                            key={f.key}
                            className="flex items-start gap-2 px-3 py-2 rounded-md border bg-green-50/40"
                          >
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-800">
                                {f.label}
                              </p>
                              <p className="text-xs text-gray-600 whitespace-pre-wrap">
                                {isArr ? (Array.isArray(ex) ? ex.join(", ") : ex) : String(ex)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="px-5 py-3 border-t border-gray-100 gap-2">
            {extracted ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setExtracted(null)}>
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Check className="w-3.5 h-3.5" />
                  Apply to Inv. Description
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={close}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleExtract}
                  disabled={extracting || !allSources.length}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {extracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Extract Fields
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DecButton({ active, onClick, icon: Icon, label, color }) {
  const colorMap = {
    indigo: "bg-indigo-600 text-white border-indigo-600",
    teal: "bg-teal-600 text-white border-teal-600",
    gray: "bg-gray-500 text-white border-gray-500",
  };
  const idleMap = {
    indigo: "text-indigo-600 border-indigo-200 hover:bg-indigo-50",
    teal: "text-teal-600 border-teal-200 hover:bg-teal-50",
    gray: "text-gray-500 border-gray-200 hover:bg-gray-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${
        active ? colorMap[color] : idleMap[color]
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}