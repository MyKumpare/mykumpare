import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Sparkles, Loader2, ClipboardPaste } from "lucide-react";
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewStructure, setPreviewStructure] = useState(null);

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploadedFile(file);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploadedFileUrl(file_url);
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
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
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition-colors">
            <Upload className="w-5 h-5 text-gray-400 mb-1" />
            <span className="text-xs text-gray-500">
              {uploadedFile ? uploadedFile.name : "Click to upload PDF, Word, or text file"}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.xlsx,.xls"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
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
          }}
          onDiscard={() => {
            setPreviewStructure(null);
            setPastedText("");
            setUploadedFile(null);
            setUploadedFileUrl("");
          }}
        />
      )}
    </div>
  );
}