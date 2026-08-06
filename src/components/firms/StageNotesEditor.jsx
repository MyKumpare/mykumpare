import React, { useState, useRef, useEffect } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StickyNote, ChevronDown, ChevronRight, History } from "lucide-react";
import { cn } from "@/lib/utils";
import StageNotesHistoryDialog from "./StageNotesHistoryDialog";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    [{ font: [] }],
    [{ size: ["small", "normal", "large", "huge"] }],
    ["bold", "italic", "underline", "strike"],
    [{ script: "sub" }, { script: "super" }],
    [{ color: [] }, { background: [] }],
    [{ align: [] }, { list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    ["blockquote", "code-block"],
    ["link"],
    ["clean"],
  ],
};

const QUILL_FORMATS = [
  "header", "font", "size",
  "bold", "italic", "underline", "strike",
  "script", "color", "background",
  "align", "list", "indent",
  "blockquote", "code-block", "link",
];

/**
 * A Word-style rich text notes editor for due diligence stages and sub-stages.
 * Collapsible: shows a summary label when collapsed, full editor when expanded.
 *
 * Props:
 *   value: string (HTML)
 *   onChange: (html) => void
 *   label: string (optional, defaults to "Notes")
 *   dueDiligenceId: string (optional — enables History button when provided)
 *   stageId: string (optional — enables History button when provided)
 *   stageName: string (optional — for display in the history dialog)
 */
export default function StageNotesEditor({ value = "", onChange, label = "Notes", dueDiligenceId = "", stageId = "", stageName = "" }) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const quillRef = useRef(null);

  // Auto-expand if there's existing content on first mount
  useEffect(() => {
    if (value && value.trim() && value !== "<p><br></p>") {
      setExpanded(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasContent = value && value.trim() && value !== "<p><br></p>";
  const canShowHistory = !!dueDiligenceId && !!stageId;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 font-medium"
        >
          {expanded
            ? <ChevronDown className="w-2.5 h-2.5" />
            : <ChevronRight className="w-2.5 h-2.5" />
          }
          <StickyNote className="w-2.5 h-2.5" />
          {label}
          {hasContent && !expanded && (
            <span className="ml-1 text-[9px] text-indigo-500">(has notes)</span>
          )}
        </button>

        {canShowHistory && (
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-indigo-600 font-medium"
            title="View edit history"
          >
            <History className="w-2.5 h-2.5" />
            History
          </button>
        )}
      </div>

      {expanded && (
        <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={value || ""}
            onChange={onChange}
            modules={QUILL_MODULES}
            formats={QUILL_FORMATS}
            placeholder="Enter notes here..."
            style={{ fontSize: "13px" }}
          />
        </div>
      )}

      {canShowHistory && (
        <StageNotesHistoryDialog
          open={showHistory}
          onOpenChange={setShowHistory}
          dueDiligenceId={dueDiligenceId}
          stageId={stageId}
          stageName={stageName || label}
        />
      )}
    </div>
  );
}