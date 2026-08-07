import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import StageNotesEditor from "@/components/firms/StageNotesEditor";
import DocumentCategoryPicker from "@/components/firms/DocumentCategoryPicker";
import {
  Play,
  CheckCircle2,
  Clock,
  Upload,
  FileText,
  Trash2,
  Save,
  Tag,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "@/components/ui/use-toast";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

const STATUS_CONFIG = {
  not_started: { label: "Not Started", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Play },
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
};

/**
 * Individual sub-section answering component for questionnaires.
 * Handles: start answering (auto start_date), notes editing, file uploads
 * with categorization (pushed to FirmDocument), and mark complete (auto end_date).
 *
 * Props:
 *   subSection: object — the sub-section data
 *   sectionName: string — parent section name (for display)
 *   questionnaireId: string
 *   firmId, firmName: string — for FirmDocument creation
 *   products: [{ id, name }] — for product tagging on uploaded documents
 *   readOnly: boolean — when true, renders in read-only/review mode
 *   onChange: (updatedSubSection) => void
 */
export default function QuestionnaireSubSectionItem({
  subSection,
  sectionName,
  questionnaireId,
  firmId,
  firmName,
  products = [],
  readOnly = false,
  onChange,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileCategories, setFileCategories] = useState([]);
  const [fileProductIds, setFileProductIds] = useState([]);
  const [showCategorize, setShowCategorize] = useState(false);

  const status = subSection.status || "not_started";
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const StatusIcon = statusConfig.icon;

  const handleStartAnswering = () => {
    onChange({
      ...subSection,
      start_date: subSection.start_date || todayISO(),
      status: "in_progress",
    });
  };

  const handleNotesChange = (notes) => {
    onChange({
      ...subSection,
      notes,
      start_date: subSection.start_date || todayISO(),
      status: subSection.status === "not_started" ? "in_progress" : subSection.status,
    });
  };

  const handleMarkComplete = () => {
    onChange({
      ...subSection,
      end_date: todayISO(),
      status: "completed",
    });
    toast({ title: "Sub-section completed", description: `"${subSection.name}" has been marked as complete.` });
  };

  const handleReopen = () => {
    onChange({
      ...subSection,
      status: "in_progress",
      end_date: "",
    });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPendingFile({ url: file_url, name: file.name, type: file.type });
      setFileName(file.name);
      setShowCategorize(true);
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDocument = async () => {
    if (!pendingFile || !fileName.trim()) return;

    try {
      // Create FirmDocument record
      const doc = await base44.entities.FirmDocument.create({
        firm_id: firmId,
        firm_name: firmName,
        file_url: pendingFile.url,
        file_name: fileName.trim(),
        file_type: pendingFile.type,
        entry_date: todayISO(),
        categories: fileCategories,
        product_ids: fileProductIds,
        tenant_id: undefined, // will be set by RLS/creator
      });

      // Add attachment to sub-section
      const newAttachment = {
        id: `att_${Date.now()}`,
        name: fileName.trim(),
        file_url: pendingFile.url,
        file_type: pendingFile.type,
        categories: fileCategories,
        product_ids: fileProductIds,
        firm_document_id: doc.id,
        uploaded_at: new Date().toISOString(),
      };

      onChange({
        ...subSection,
        attachments: [...(subSection.attachments || []), newAttachment],
      });

      toast({ title: "Document saved", description: `"${fileName}" has been uploaded and categorized.` });

      // Reset
      setPendingFile(null);
      setFileName("");
      setFileCategories([]);
      setFileProductIds([]);
      setShowCategorize(false);
    } catch (err) {
      toast({ title: "Failed to save document", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  const handleCancelUpload = () => {
    setPendingFile(null);
    setFileName("");
    setFileCategories([]);
    setFileProductIds([]);
    setShowCategorize(false);
  };

  const handleRemoveAttachment = (attId) => {
    onChange({
      ...subSection,
      attachments: (subSection.attachments || []).filter((a) => a.id !== attId),
    });
  };

  const toggleProductTag = (productId) => {
    setFileProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-700 truncate">{subSection.name}</span>
        </div>
        <Badge variant="outline" className={`text-[10px] ${statusConfig.color} flex-shrink-0`}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Dates */}
      {(subSection.start_date || subSection.end_date) && (
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          {subSection.start_date && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> Started: {fmtDate(subSection.start_date)}
            </span>
          )}
          {subSection.end_date && (
            <span className="flex items-center gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" /> Completed: {fmtDate(subSection.end_date)}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {!readOnly && status === "not_started" && (
        <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={handleStartAnswering}>
          <Play className="w-3 h-3" /> Start Answering
        </Button>
      )}

      {/* Notes editor */}
      {(status !== "not_started" || readOnly) && (
        <StageNotesEditor
          value={subSection.notes || ""}
          onChange={handleNotesChange}
          label="Notes"
          readOnly={readOnly}
        />
      )}

      {/* File uploads */}
      {(status !== "not_started" || readOnly) && !readOnly && (
        <div className="space-y-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-3 h-3" />
            {uploading ? "Uploading..." : "Upload File"}
          </Button>

          {/* Categorization form */}
          {showCategorize && pendingFile && (
            <div className="rounded-md border border-blue-200 bg-blue-50/40 p-2 space-y-2">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-medium text-blue-700">Categorize Document</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-gray-600">Document Name *</Label>
                <Input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Enter document name..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-gray-600">Categories</Label>
                <DocumentCategoryPicker value={fileCategories} onChange={setFileCategories} />
              </div>
              {products.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-gray-600 flex items-center gap-0.5">
                    <Tag className="w-2.5 h-2.5" /> Tag to Products
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProductTag(p.id)}
                        className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                          fileProductIds.includes(p.id)
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                            : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-1.5">
                <Button type="button" size="sm" className="h-6 text-[10px] gap-1" onClick={handleSaveDocument} disabled={!fileName.trim()}>
                  <Save className="w-2.5 h-2.5" /> Save Document
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={handleCancelUpload}>
                  <X className="w-2.5 h-2.5" /> Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attachments list */}
      {(subSection.attachments || []).length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-400 font-medium">Attached Documents</span>
          {(subSection.attachments || []).map((att) => (
            <div key={att.id} className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50/50 px-2 py-1">
              <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline truncate flex-1">
                {att.name}
              </a>
              {(att.categories || []).length > 0 && (
                <div className="flex gap-0.5 flex-shrink-0">
                  {att.categories.slice(0, 2).map((cat, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] bg-gray-100">{cat}</Badge>
                  ))}
                </div>
              )}
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-gray-400 hover:text-red-600 flex-shrink-0"
                  onClick={() => handleRemoveAttachment(att.id)}
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mark complete / reopen */}
      {!readOnly && status === "in_progress" && (
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleMarkComplete}>
          <CheckCircle2 className="w-3 h-3" /> Mark Complete
        </Button>
      )}
      {!readOnly && status === "completed" && (
        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-gray-500" onClick={handleReopen}>
          Reopen
        </Button>
      )}
    </div>
  );
}