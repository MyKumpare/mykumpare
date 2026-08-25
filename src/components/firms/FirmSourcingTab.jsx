import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";

const SOURCING_SOURCE_OPTIONS = [
  "Consultant Recommendation",
  "Conference/Event",
  "News/Media",
  "Network/Referral",
  "Database/Screen",
  "Internal Research",
  "RFP/RFI Response",
  "Existing Relationship",
  "Board Member Referral",
  "Other",
];

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
 * Sourcing tab for the firm form.
 * Tracks how/where the manager idea was sourced: the source(s), date, a
 * contact person name, and rich-text notes.
 *
 * Props:
 *   sources: string[]
 *   onSourcesChange: (string[]) => void
 *   date: string (YYYY-MM-DD)
 *   onDateChange: (string) => void
 *   contactName: string
 *   onContactNameChange: (string) => void
 *   notes: string (HTML)
 *   onNotesChange: (html) => void
 *   isEditing: boolean
 */
export default function FirmSourcingTab({
  sources = [],
  onSourcesChange,
  date = "",
  onDateChange,
  contactName = "",
  onContactNameChange,
  notes = "",
  onNotesChange,
  isEditing = false,
}) {
  const toggleSource = (option) => {
    if (sources.includes(option)) {
      onSourcesChange(sources.filter((s) => s !== option));
    } else {
      onSourcesChange([...sources, option]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sources of Manager Idea — multi-select */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Source(s) of Manager Idea</Label>
        {!isEditing ? (
          <div className="px-3 py-2 flex flex-wrap gap-1.5 rounded-md border bg-gray-50 min-h-9">
            {sources.length > 0
              ? sources.map((s) => (
                  <span key={s} className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700">{s}</span>
                ))
              : <span className="text-sm text-gray-400">—</span>
            }
          </div>
        ) : (
          <div className="rounded-md border bg-white p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {SOURCING_SOURCE_OPTIONS.map((option) => {
              const checked = sources.includes(option);
              return (
                <label
                  key={option}
                  className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-md transition-colors ${checked ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSource(option)}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${checked ? "bg-primary border-primary" : "border-gray-300"}`}
                  >
                    {checked && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Date of Sourcing */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Date of Sourcing</Label>
        {!isEditing ? (
          <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700">
            {date || <span className="text-gray-400">—</span>}
          </div>
        ) : (
          <Input
            type="date"
            value={date || ""}
            onChange={(e) => onDateChange(e.target.value)}
            className="h-9 max-w-xs"
          />
        )}
      </div>

      {/* Contact Person Name */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Contact Person</Label>
        {!isEditing ? (
          <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700">
            {contactName || <span className="text-gray-400">—</span>}
          </div>
        ) : (
          <Input
            placeholder="Enter contact person name..."
            value={contactName}
            onChange={(e) => onContactNameChange(e.target.value)}
            className="h-9 max-w-md"
          />
        )}
      </div>

      {/* Sourcing Notes — rich text (Word format) */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Sourcing Notes</Label>
        {!isEditing ? (
          <div
            className="px-3 py-2 rounded-md border bg-gray-50 text-sm text-gray-700 min-h-20 quill-preview"
            dangerouslySetInnerHTML={{ __html: notes || '<span class="text-gray-400">—</span>' }}
          />
        ) : (
          <div className="rounded-md border border-gray-200">
            <ReactQuill
              theme="snow"
              value={notes || ""}
              onChange={onNotesChange}
              modules={QUILL_MODULES}
              formats={QUILL_FORMATS}
              placeholder="Enter notes about the sourcing..."
            />
          </div>
        )}
      </div>
    </div>
  );
}