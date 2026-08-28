import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Sparkles, Loader2, ClipboardPaste, CheckCircle2, X, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import TemplateStructurePreview from "./TemplateStructurePreview";

/**
 * Component for uploading a document or pasting text to analyze and generate
 * a scoring matrix or process template structure preview. The AI-generated
 * structure is shown in a read-only preview first; the user must confirm
 * before it is applied to the template editor.
 */
export default function ScoringMatrixDocumentAnalyzer({ templateCategory, onAnalyzed }) {
  const [activeTab, setActiveTab] = useState("upload");
  const [pastedText, setPastedText] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewStructure, setPreviewStructure] = useState(null);

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    setUploadedFileUrl("");
    setUploadError("");
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploadError("");
    setUploadedFile(file);
    setUploadedFileUrl("");
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploadedFileUrl(file_url);
    } catch (err) {
      setUploadError(err?.message || "Upload failed");
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFileUrl && !pastedText.trim()) {
      toast({ title: "Nothing to analyze", description: "Upload a file or paste text first.", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    try {
      const response = await base44.functions.invoke("analyzeScoringMatrixDocument", {
        file_url: uploadedFileUrl || undefined,
        pasted_text: pastedText.trim() || undefined,
        template_category: templateCategory
      });
      const data = response.data?.data || response.data;
      if (data) {
        setPreviewStructure({ type: "scoring", blocks: data.blocks || [] });
        toast({ title: "Analysis complete", description: "Review the generated structure below before applying." });
      }
    } catch (err) {
      toast({ title: "Analysis failed", description: err?.message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="border border-cyan-200 rounded-lg p-3 bg-cyan-50/30 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-cyan-800">
        <Sparkles className="w-4 h-4" />
        AI Document Analysis
      </div>
      <p className="text-xs text-gray-500">
        Upload a document or paste text. The AI will analyze it and generate a{" "}
        {templateCategory === "Scoring Matrix" ? "scoring matrix" : "process template"} structure you can preview and edit.
      </p>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="text-xs">
            <Upload className="w-3 h-3 mr-1" /> Upload File
          </TabsTrigger>
          <TabsTrigger value="paste" className="text-xs">
            <ClipboardPaste className="w-3 h-3 mr-1" /> Paste Text
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-2">
          {uploadedFile && !isUploading ? (
            <div className={`rounded-lg border p-3 ${uploadError ? "border-red-200 bg-red-50/50" : "border-green-200 bg-green-50/50"}`}>
              <div className="flex items-center gap-2">
                {uploadError ? (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                )}
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-800 truncate">{uploadedFile.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {uploadedFile.size ? formatFileSize(uploadedFile.size) : ""}
                    {uploadError ? ` · ${uploadError}` : " · Uploaded successfully"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearUploadedFile}
                  className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {!uploadError && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Ready for analysis
                  </span>
                  <span className="text-[11px] text-gray-400">Click the box to choose a different file</span>
                </div>
              )}
            </div>
          ) : null}
          <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 transition-colors ${isUploading ? "border-cyan-400 bg-cyan-50/50 cursor-wait" : "border-gray-300 cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50"} ${uploadedFile && !isUploading ? "mt-2 pt-2 pb-3" : ""}`}>
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 text-cyan-500 mb-1 animate-spin" />
                <span className="text-xs text-cyan-700 font-medium">Uploading {uploadedFile?.name}...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500">
                  {uploadedFile ? "Click to replace with a different file" : "Click to upload PDF, Word, Excel, or text file"}
                </span>
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.xlsx,.xls"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              disabled={isUploading}
            />
          </label>
        </TabsContent>
        <TabsContent value="paste" className="mt-2">
          <Textarea
            placeholder="Paste the document text here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="min-h-[100px] text-xs"
          />
        </TabsContent>
      </Tabs>
      <Button
        type="button"
        size="sm"
        onClick={handleAnalyze}
        disabled={isAnalyzing || (!uploadedFileUrl && !pastedText.trim())}
        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" /> Analyze & Generate Preview
          </>
        )}
      </Button>

      {previewStructure && (
        <TemplateStructurePreview
          structure={previewStructure}
          onApply={() => {
            onAnalyzed({ blocks: previewStructure.blocks });
            setPreviewStructure(null);
            setPastedText("");
            setUploadedFile(null);
            setUploadedFileUrl("");
            setUploadError("");
          }}
          onDiscard={() => {
            setPreviewStructure(null);
            setPastedText("");
            setUploadedFile(null);
            setUploadedFileUrl("");
            setUploadError("");
          }}
        />
      )}
    </div>
  );
}