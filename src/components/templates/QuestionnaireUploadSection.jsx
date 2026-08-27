import React, { useState, useRef } from "react";
import { UploadCloud, Loader2, FileText, X, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import TemplateStructurePreview from "./TemplateStructurePreview";

let _tid = 0;
const nextId = () => `tstage_${Date.now()}_${++_tid}`;

/**
 * Upload a questionnaire file (PDF, DOCX, image, etc.) and use AI to
 * automatically extract the structure into main sections and sub-sections.
 * On success, calls onExtracted(stages) so the parent can populate the
 * editable stages list.
 *
 * Props:
 *   onExtracted — (stages: Array<{id,name,sub_stages:Array<{id,name}>}>) => void
 *   sectionLabel — "Section" | "Stage" (display only)
 */
export default function QuestionnaireUploadSection({ onExtracted, sectionLabel = "Section" }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewStages, setPreviewStages] = useState(null);
  const inputRef = useRef(null);

  const ACCEPTED = ".pdf,.doc,.docx,.txt,.rtf,.html,.htm,.png,.jpg,.jpeg,.csv,.xlsx";

  const reset = () => {
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const processFile = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      // 1. Upload the file
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });

      // 2. Ask the LLM to extract the section/sub-section structure
      const prompt = `You are analyzing a questionnaire document. Extract its structure into main sections and their sub-sections.

Rules:
- Identify the main sections (top-level categories/numbered sections of the questionnaire).
- Under each main section, identify its sub-sections (individual questions or sub-topics grouped under that section).
- Preserve the original ordering as they appear in the document.
- Use the exact section/sub-section names/titles as they appear in the document (trimmed, no numbering prefixes unless part of the title).
- If a section has no identifiable sub-sections, include an empty sub_sections array.
- If the document has no clear structure, create a single section named after the document title with each question as a sub-section.

Return ONLY the structured JSON per the schema.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Main section title" },
                  sub_sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Sub-section or question title" }
                      },
                      required: ["name"]
                    }
                  }
                },
                required: ["name", "sub_sections"]
              }
            }
          },
          required: ["sections"]
        },
      });

      const rawSections = Array.isArray(result?.sections) ? result.sections : [];
      if (rawSections.length === 0) {
        toast({
          title: "No sections found",
          description: "The AI couldn't identify any sections in the uploaded document. You can add them manually below.",
          variant: "destructive",
        });
        reset();
        return;
      }

      // 3. Map to the template stages shape with ids
      const stages = rawSections
        .filter((s) => s && typeof s.name === "string" && s.name.trim())
        .map((s) => ({
          id: nextId(),
          name: s.name.trim(),
          sub_stages: (Array.isArray(s.sub_sections) ? s.sub_sections : [])
            .filter((ss) => ss && typeof ss.name === "string" && ss.name.trim())
            .map((ss) => ({ id: nextId(), name: ss.name.trim() })),
        }));

      if (stages.length === 0) {
        toast({
          title: "Extraction failed",
          description: "No valid sections could be extracted. Please try another file or add manually.",
          variant: "destructive",
        });
        reset();
        return;
      }

      setPreviewStages(stages);
      toast({
        title: "Sections generated",
        description: `${stages.length} ${sectionLabel.toLowerCase()}${stages.length === 1 ? "" : "s"} extracted. Review the preview below before applying.`,
      });
      reset();
    } catch (err) {
      console.error("Questionnaire upload extraction error:", err);
      toast({
        title: "Upload failed",
        description: err?.message || "Could not process the file. Please try again or add sections manually.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-md border border-violet-200 bg-violet-50/40 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-violet-600" />
        <span className="text-xs font-semibold text-gray-700">
          Auto-generate from a questionnaire file
        </span>
      </div>
      <p className="text-[11px] text-gray-500 -mt-1">
        Upload a questionnaire (PDF, Word, image, etc.) and we'll extract the sections and sub-sections for you. You can edit them after.
      </p>

      {!selectedFile ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`cursor-pointer border-2 border-dashed rounded-md px-3 py-5 text-center transition-colors ${
            dragOver ? "border-violet-500 bg-violet-100/60" : "border-violet-300 hover:border-violet-400 hover:bg-violet-100/40"
          }`}
        >
          <UploadCloud className="w-6 h-6 mx-auto text-violet-500 mb-1.5" />
          <p className="text-xs text-gray-600 font-medium">Click to upload or drag & drop</p>
          <p className="text-[10px] text-gray-400 mt-0.5">PDF, DOCX, TXT, HTML, images</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-violet-200 bg-white px-2.5 py-2">
          <FileText className="w-4 h-4 text-violet-600 flex-shrink-0" />
          <span className="text-xs text-gray-700 truncate flex-1">{selectedFile.name}</span>
          <span className="text-[10px] text-gray-400">{(selectedFile.size / 1024).toFixed(0)} KB</span>
          {!isProcessing && (
            <button type="button" onClick={reset} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {selectedFile && (
        <Button
          type="button"
          size="sm"
          onClick={processFile}
          disabled={isProcessing}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Extracting sections...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Generate {sectionLabel}s from file
            </>
          )}
        </Button>
      )}

      {previewStages && (
        <TemplateStructurePreview
          structure={{ type: "process", stages: previewStages }}
          onApply={() => {
            onExtracted(previewStages);
            setPreviewStages(null);
          }}
          onDiscard={() => setPreviewStages(null)}
        />
      )}
    </div>
  );
}