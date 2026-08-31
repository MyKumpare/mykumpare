import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    [{ size: ["small", "normal", "large"] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ align: [] }, { list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    ["blockquote", "link"],
    ["clean"],
  ],
};

const QUILL_FORMATS = [
  "header", "size",
  "bold", "italic", "underline", "strike",
  "color", "background",
  "align", "list", "indent",
  "blockquote", "link",
];

// Convert plain-text bios (no HTML tags) into HTML paragraphs so they render
// nicely in the rich-text view. Bios scraped from the web are already HTML.
function toHtmlIfPlain(text) {
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.trim().replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/**
 * Rich-text biography editor (edit mode) and formatted preview (view mode).
 *
 * Props:
 *   value: string (plain text or HTML)
 *   onChange: (html) => void
 *   viewMode: boolean
 */
export default function BiographyEditor({ value = "", onChange, viewMode = false }) {
  if (viewMode) {
    const html = toHtmlIfPlain(value);
    if (!html || html === "<p></p>" || html === "<p><br></p>") {
      return <div className="text-sm text-gray-400 italic px-1">—</div>;
    }
    return (
      <div
        className="quill-preview text-sm text-gray-900 px-1 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <ReactQuill
        theme="snow"
        value={toHtmlIfPlain(value)}
        onChange={onChange}
        modules={QUILL_MODULES}
        formats={QUILL_FORMATS}
        placeholder="Brief biography…"
        style={{ fontSize: "13px" }}
      />
    </div>
  );
}