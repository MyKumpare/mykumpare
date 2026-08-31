import React, { useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Wand2 } from "lucide-react";

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
 * Clean up messy HTML from scraped biographies:
 * - Convert <div> and <br> chains into proper paragraph breaks
 * - Strip inline styles, <span>, <font> wrappers that add no semantic value
 * - Normalize whitespace (collapse runs of spaces, decode &nbsp;)
 * - Remove empty paragraphs and trailing whitespace
 * - Wrap any loose text nodes in <p> tags
 * Preserves meaningful formatting: bold, italic, headers, lists, links.
 */
function cleanBiographyHtml(html) {
  if (!html) return "";
  const container = document.createElement("div");
  container.innerHTML = html;

  // Unwrap <span> and <font> tags — keep their text content and any bold/italic
  container.querySelectorAll("span, font").forEach((el) => {
    const bold = el.tagName === "B" || el.style.fontWeight === "bold" || /bold/i.test(el.style.fontWeight);
    const italic = el.tagName === "I" || /italic/i.test(el.style.fontStyle);
    const link = el.tagName === "A";
    let inner = el.innerHTML;
    if (bold) inner = `<strong>${inner}</strong>`;
    if (italic) inner = `<em>${inner}</em>`;
    if (link) inner = `<a href="${el.getAttribute("href") || ""}">${inner}</a>`;
    el.outerHTML = inner;
  });

  // Remove inline style attributes from all remaining elements
  container.querySelectorAll("*").forEach((el) => el.removeAttribute("style"));

  // Convert <div> to <p> (browsers often use divs for paragraphs)
  container.querySelectorAll("div").forEach((div) => {
    const p = document.createElement("p");
    p.innerHTML = div.innerHTML;
    div.replaceWith(p);
  });

  // Convert runs of <br> into paragraph breaks
  container.querySelectorAll("br").forEach((br) => {
    // If a <br> is preceded by another <br>, split into a new paragraph
    const prev = br.previousSibling;
    if (prev && prev.tagName === "BR") {
      const p = document.createElement("p");
      let sibling = br.nextSibling;
      const moved = [];
      while (sibling && sibling.tagName !== "BR") {
        moved.push(sibling);
        sibling = sibling.nextSibling;
      }
      moved.forEach((n) => p.appendChild(n));
      br.replaceWith(p);
    }
  });

  // Now remove all remaining <br> (single ones become spaces within a paragraph)
  container.querySelectorAll("br").forEach((br) => {
    const txt = document.createTextNode(" ");
    br.replaceWith(txt);
  });

  // Normalize whitespace inside each <p>
  container.querySelectorAll("p").forEach((p) => {
    p.innerHTML = p.innerHTML
      .replace(/&nbsp;/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/^\s+|\s+$/g, "");
    if (!p.textContent.trim()) p.remove();
  });

  // Merge paragraphs that were incorrectly split at abbreviations during
  // scraping. Scrapers often treat "Mr.", "S.A.", "U.S." as sentence ends and
  // start a new <p>, fragmenting the bio mid-word. Join them back together.
  const ABBR_END = /(?:[A-Z]\.|Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Hon\.|St\.|Sr\.|Jr\.|Sgt\.|Inc\.|Ltd\.|Co\.|Corp\.|vs\.|etc\.|e\.g\.|i\.e\.|a\.m\.|p\.m\.|No\.|Vol\.|Fig\.|Jan\.|Feb\.|Mar\.|Apr\.|Jun\.|Jul\.|Aug\.|Sep\.|Sept\.|Oct\.|Nov\.|Dec\.)\s*$/;
  const paragraphs = Array.from(container.querySelectorAll("p"));
  const merged = [];
  for (const p of paragraphs) {
    if (merged.length && ABBR_END.test(merged[merged.length - 1].textContent.trim())) {
      const prev = merged[merged.length - 1];
      prev.innerHTML = prev.innerHTML.replace(/\s+$/, "") + " " + p.innerHTML;
    } else {
      merged.push(p);
    }
  }

  // Wrap any loose text nodes (outside <p>) in <p> tags
  const wrapped = [];
  container.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      const p = document.createElement("p");
      p.textContent = node.textContent.trim();
      wrapped.push({ node, p });
    }
  });
  wrapped.forEach(({ node, p }) => node.replaceWith(p));

  // Collapse consecutive empty paragraphs
  const result = container.innerHTML
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/(<p>\s*<\/p>\s*)+/g, "");

  return result;
}

/**
 * Rich-text biography editor (edit mode) and formatted preview (view mode).
 *
 * Props:
 *   value: string (plain text or HTML)
 *   onChange: (html) => void
 *   viewMode: boolean
 */
export default function BiographyEditor({ value = "", onChange, onPersist, viewMode = false }) {
  const quillRef = useRef(null);
  const [cleaning, setCleaning] = useState(false);

  const handleCleanFormatting = async () => {
    let current;
    if (viewMode) {
      current = toHtmlIfPlain(value);
    } else {
      const editor = quillRef.current?.getEditor?.();
      current = editor?.root?.innerHTML || toHtmlIfPlain(value);
    }
    const cleaned = cleanBiographyHtml(current);

    if (viewMode && onPersist) {
      // View mode: persist the cleaned bio directly to the database
      setCleaning(true);
      try {
        await onPersist(cleaned);
      } finally {
        setCleaning(false);
      }
      return;
    }

    // Edit mode: push the cleaned HTML directly into the Quill editor
    // (ReactQuill ignores external value prop changes after mount).
    if (!viewMode) {
      const editor = quillRef.current?.getEditor?.();
      if (editor) {
        editor.clipboard.dangerouslyPasteHTML(cleaned);
        onChange(cleaned);
        return;
      }
    }
    onChange(cleaned);
  };

  if (viewMode) {
    const html = toHtmlIfPlain(value);
    if (!html || html === "<p></p>" || html === "<p><br></p>") {
      return <div className="text-sm text-gray-400 italic px-1">—</div>;
    }
    return (
      <div className="space-y-1">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCleanFormatting}
            disabled={cleaning}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
            title="Normalize paragraph breaks, remove extra whitespace, and strip messy formatting from scraped bios"
          >
            <Wand2 className={`h-3.5 w-3.5 ${cleaning ? "animate-pulse" : ""}`} />
            {cleaning ? "Cleaning…" : "Clean Formatting"}
          </button>
        </div>
        <div
          className="quill-preview text-sm text-gray-900 px-1 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500">Tip: press Enter twice for a paragraph break</span>
        <button
          type="button"
          onClick={handleCleanFormatting}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="Normalize paragraph breaks, remove extra whitespace, and strip messy formatting from scraped bios"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Clean Formatting
        </button>
      </div>
      <ReactQuill
        ref={quillRef}
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