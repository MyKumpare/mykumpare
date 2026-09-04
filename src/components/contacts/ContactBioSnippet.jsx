import React, { useMemo } from "react";

/**
 * Extracts plain text from an HTML biography string and renders a short
 * truncated snippet (max ~180 chars). Returns null when there is no bio.
 */
export default function ContactBioSnippet({ biography, maxLength = 180 }) {
  const snippet = useMemo(() => {
    if (!biography) return "";
    const doc = new DOMParser().parseFromString(String(biography), "text/html");
    const text = (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
  }, [biography, maxLength]);

  if (!snippet) return null;
  return <p className="text-xs text-gray-500 leading-snug line-clamp-2 mt-0.5">{snippet}</p>;
}