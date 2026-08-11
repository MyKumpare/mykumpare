import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Label } from "@/components/ui/label";
import { ScrollText } from "lucide-react";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    ["link"],
    ["clean"],
  ],
};

const GUIDELINE_SECTIONS = [
  { key: "investments", label: "Investment Guidelines" },
  { key: "program", label: "Program Guidelines" },
  { key: "compliance", label: "Compliance Guidelines" },
];

export default function PortfolioGuidelinesTab({
  investments = "",
  program = "",
  compliance = "",
  isEditing = false,
  onInvestmentsChange,
  onProgramChange,
  onComplianceChange,
}) {
  const values = { investments, program, compliance };
  const handlers = {
    investments: onInvestmentsChange,
    program: onProgramChange,
    compliance: onComplianceChange,
  };

  if (!isEditing) {
    return (
      <div className="space-y-5 py-2">
        {GUIDELINE_SECTIONS.map((sec) => {
          const html = values[sec.key] || "";
          const hasContent = html && html.trim() && html !== "<p><br></p>";
          return (
            <div key={sec.key}>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                {sec.label}
              </Label>
              {hasContent ? (
                <div
                  className="quill-preview text-sm text-gray-800 px-3 py-2.5 rounded-md border bg-gray-50 min-h-[60px] prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : (
                <div className="text-sm text-gray-400 italic px-3 py-2.5 rounded-md border bg-gray-50 min-h-[60px] flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-gray-300" />
                  No {sec.label.toLowerCase()} provided
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      {GUIDELINE_SECTIONS.map((sec) => (
        <div key={sec.key}>
          <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
            {sec.label}
          </Label>
          <ReactQuill
            theme="snow"
            modules={QUILL_MODULES}
            value={values[sec.key] || ""}
            onChange={handlers[sec.key]}
            className="bg-white rounded-md border border-gray-200"
            style={{ minHeight: "100px" }}
          />
        </div>
      ))}
    </div>
  );
}