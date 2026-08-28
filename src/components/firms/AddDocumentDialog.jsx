import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FileText,
  Upload,
  Save,
  X,
  Building,
  Search,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import DocumentCategoryPicker from "./DocumentCategoryPicker";
import DocumentProductTagSelect from "./DocumentProductTagSelect";
import SimilarDocumentDialog from "./SimilarDocumentDialog";
import UploadStatusCard, { formatFileSize } from "@/components/common/UploadStatusCard";
import { toast } from "@/components/ui/use-toast";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso + "T00:00:00"), "MM/dd/yyyy");
  } catch {
    return iso || "—";
  }
};
const getFirmTypes = (f) =>
  f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
const normalizeName = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "");

// Standalone "Add Document" dialog used from the Documents Dashboard.
// Mirrors the firm-scoped document creation flow, but requires the user to
// pick the firm (and the firm type associated with that firm) so the system
// knows where to associate the document.
export default function AddDocumentDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const [firmId, setFirmId] = useState("");
  const [firmType, setFirmType] = useState("");
  const [file, setFile] = useState(null); // { file_url, file_name, file_type }
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [entryDate] = useState(todayISO());
  const [asOfDate, setAsOfDate] = useState("");
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState("");
  const [productIds, setProductIds] = useState([]);
  const [summarizing, setSummarizing] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState(null);
  const [firmSearch, setFirmSearch] = useState("");
  const [firmPopoverOpen, setFirmPopoverOpen] = useState(false);

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 1000),
    enabled: open,
  });

  const selectedFirm = useMemo(
    () => firms.find((f) => f.id === firmId),
    [firms, firmId]
  );

  const firmTypeOptions = useMemo(
    () => (selectedFirm ? getFirmTypes(selectedFirm) : []),
    [selectedFirm]
  );

  const { data: existingDocs = [] } = useQuery({
    queryKey: ["firm-documents", firmId],
    queryFn: () =>
      base44.entities.FirmDocument.filter({ firm_id: firmId }, "-created_date", 500),
    enabled: !!firmId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FirmDocument.create(data),
  });

  const reset = () => {
    setFirmId("");
    setFirmType("");
    setFile(null);
    setAsOfDate("");
    setCategories([]);
    setSubCategories([]);
    setDescription("");
    setSummary("");
    setProductIds([]);
    setDuplicateCheck(null);
    setFirmSearch("");
    setUploadingFile(null);
    setUploadError("");
  };

  const handleClose = (o) => {
    if (!o) {
      reset();
      onOpenChange(false);
    }
  };

  const handleFirmSelect = (f) => {
    setFirmId(f.id);
    const types = getFirmTypes(f);
    if (types.length === 1) setFirmType(types[0]);
    else setFirmType("");
    setFirmPopoverOpen(false);
    setFirmSearch("");
  };

  const handleFile = async (files) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    setUploadingFile(f);
    setUploadError("");
    try {
      const res = await base44.integrations.Core.UploadFile({ file: f });
      const file_url = res?.file_url || "";
      if (!file_url) throw new Error("Upload failed");
      setFile({
        file_url,
        file_name: f.name,
        file_type: f.type || f.name.split(".").pop() || "",
      });
    } catch (e) {
      setUploadError(e?.message || "Upload failed");
      toast({
        title: "Upload failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSummarize = async () => {
    if (!file?.file_url) {
      toast({ title: "Upload a document first.", variant: "destructive" });
      return;
    }
    setSummarizing(true);
    try {
      const prompt =
        "Summarize the attached document concisely. Capture its purpose, key points, and notable details in 4-6 sentences. Use only information present in the document; do not invent content.";
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [file.file_url],
        add_context_from_internet: false,
      });
      const text = typeof res === "string" ? res : res?.summary || String(res || "");
      setSummary(text.trim());
      toast({ title: "Summary generated from document." });
    } catch (e) {
      toast({
        title: "Summarization failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSummarizing(false);
    }
  };

  const buildPayload = () => ({
    firm_id: firmId,
    firm_name: selectedFirm?.name || "",
    firm_type: firmType || undefined,
    tenant_id: user?.linked_firm_id,
    file_url: file.file_url,
    file_name: file.file_name,
    file_type: file.file_type,
    entry_date: entryDate,
    document_as_of_date: asOfDate || undefined,
    categories,
    sub_categories: subCategories,
    description: description || undefined,
    summary: summary || undefined,
    product_ids: productIds,
  });

  const doCreate = async () => {
    try {
      await createMutation.mutateAsync(buildPayload());
      queryClient.invalidateQueries({ queryKey: ["all-firm-documents"] });
      queryClient.invalidateQueries({ queryKey: ["firm-documents", firmId] });
      toast({ title: "Document saved", description: file.file_name });
      handleClose(false);
    } catch (e) {
      toast({
        title: "Could not save document",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const handleSave = () => {
    const matches = existingDocs.filter(
      (d) => normalizeName(d.file_name) === normalizeName(file?.file_name)
    );
    if (matches.length > 0) {
      setDuplicateCheck({
        draft: { file_name: file.file_name, entry_date: entryDate, document_as_of_date: asOfDate, categories, sub_categories: subCategories },
        matches,
      });
      return;
    }
    doCreate();
  };

  const canSave =
    !!firmId && !!firmType && !!file && !createMutation.isPending && !uploading;

  const filteredFirms = useMemo(() => {
    const q = firmSearch.toLowerCase();
    return firms
      .filter((f) => !f.deleted_at)
      .filter((f) => !q || (f.name || "").toLowerCase().includes(q));
  }, [firms, firmSearch]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              Add Document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Firm selection */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">
                Firm <span className="text-red-500">*</span>
              </Label>
              <Popover open={firmPopoverOpen} onOpenChange={setFirmPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between h-9 text-sm font-normal"
                  >
                    {selectedFirm ? (
                      <span className="text-gray-800 truncate">
                        {selectedFirm.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">Search and select firm...</span>
                    )}
                    <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[440px] p-0" align="start">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        placeholder="Search firms..."
                        value={firmSearch}
                        onChange={(e) => setFirmSearch(e.target.value)}
                        className="h-8 text-sm pl-8"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {filteredFirms.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-400 italic">
                        No firms found.
                      </p>
                    ) : (
                      filteredFirms.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleFirmSelect(f)}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
                        >
                          <Building className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{f.name}</span>
                          {f.id === firmId && (
                            <Check className="w-3.5 h-3.5 text-teal-600 ml-auto" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Firm type selection */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">
                Firm Type <span className="text-red-500">*</span>
              </Label>
              {firmId && firmTypeOptions.length === 0 ? (
                <p className="text-xs text-amber-600 italic">
                  This firm has no associated firm type. Assign a type to the firm
                  first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {firmTypeOptions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFirmType(t)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        firmType === t
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-teal-300"
                      } ${!firmId ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={!firmId}
                    >
                      {t}
                    </button>
                  ))}
                  {!firmId && (
                    <span className="text-xs text-gray-400 self-center">
                      Select a firm first.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* File upload */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">
                Document File <span className="text-red-500">*</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFile(e.target.files)}
              />
              {uploading ? (
                <UploadStatusCard
                  fileName={uploadingFile?.name || "Uploading..."}
                  fileSize={uploadingFile ? formatFileSize(uploadingFile.size) : ""}
                  status="uploading"
                  accent="teal"
                />
              ) : file ? (
                <UploadStatusCard
                  fileName={file.file_name}
                  status="success"
                  onRemove={() => setFile(null)}
                  accent="teal"
                />
              ) : uploadError ? (
                <UploadStatusCard
                  fileName={uploadingFile?.name || "File"}
                  status="error"
                  error={uploadError}
                  onRemove={() => { setUploadError(""); setUploadingFile(null); }}
                  accent="teal"
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9 text-sm gap-1.5 text-teal-700 hover:text-teal-800 hover:bg-teal-50 border-teal-200"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Document
                </Button>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Entry Date</Label>
                <div className="h-9 px-2 flex items-center rounded-md border bg-gray-50 text-xs text-gray-700">
                  {fmtDate(entryDate)}{" "}
                  <span className="text-gray-400 ml-1">(auto)</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">
                  Document As of Date
                </Label>
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Category</Label>
                <DocumentCategoryPicker
                  value={categories}
                  onChange={setCategories}
                  entityName="DocumentCategory"
                  placeholder="Search or add category..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Sub-Category</Label>
                <DocumentCategoryPicker
                  value={subCategories}
                  onChange={setSubCategories}
                  entityName="DocumentSubCategory"
                  placeholder="Search or add sub-category..."
                  accent="amber"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Description</Label>
              <Textarea
                placeholder="Add a description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-16 text-xs"
              />
            </div>

            {/* Summary */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600">Summary</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSummarize}
                  disabled={summarizing || !file}
                  className="gap-1.5 text-teal-700 border-teal-200 hover:bg-teal-50 h-7"
                >
                  {summarizing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {summarizing ? "Summarizing..." : "Summarize Document"}
                </Button>
              </div>
              <Textarea
                placeholder="Add a summary of this document..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="min-h-20 text-xs"
              />
            </div>

            {/* Products */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Products</Label>
              <DocumentProductTagSelect
                firmId={firmId}
                value={productIds}
                onChange={setProductIds}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canSave}
              onClick={handleSave}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Save className="w-3.5 h-3.5" />
              {createMutation.isPending ? "Saving..." : "Save Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SimilarDocumentDialog
        open={!!duplicateCheck}
        newDoc={duplicateCheck?.draft}
        matches={duplicateCheck?.matches}
        onAccept={() => {
          setDuplicateCheck(null);
          doCreate();
        }}
        onReject={() => {
          setDuplicateCheck(null);
          toast({
            title: "Document rejected",
            description: "The duplicate upload was discarded.",
          });
        }}
      />
    </>
  );
}