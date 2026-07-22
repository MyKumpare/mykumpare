/**
 * Minimal browser-side HTML sanitizer for rich-text content (e.g. Quill output)
 * that is rendered via `dangerouslySetInnerHTML`.
 *
 * Strips executable content (scripts, event handlers, javascript:/vbscript:
 * URLs, dangerous CSS expressions) and removes elements that can execute
 * code or load remote resources unsafely, while preserving safe formatting
 * tags (p, strong, em, ul/ol, blockquote, etc.).
 *
 * This is a defense-in-depth layer; the content is also produced by a
 * constrained rich-text editor, but it may originate from external sources
 * (e.g. extracted biographies), so we sanitize before rendering.
 */

const DANGEROUS_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "template",
  "meta", "link", "base", "form", "input", "button", "textarea",
  "select", "option", "svg", "math", "applet", "frame", "frameset",
  "audio", "video", "source", "track",
]);

function sanitizeElement(el) {
  const name = el.tagName.toLowerCase();
  // Remove entire dangerous elements (and their contents).
  if (DANGEROUS_TAGS.has(name)) {
    el.remove();
    return;
  }
  // Strip event-handler attributes and dangerous URLs.
  for (const attr of Array.from(el.attributes || [])) {
    const an = attr.name.toLowerCase();
    const av = (attr.value || "").trim().toLowerCase();
    if (an.startsWith("on")) {
      el.removeAttribute(attr.name);
      continue;
    }
    if ((an === "href" || an === "src" || an === "xlink:href" || an === "formaction" || an === "data") &&
      (av.startsWith("javascript:") || av.startsWith("vbscript:") || av.startsWith("data:text/html"))) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (an === "style" && /expression\s*\(|url\s*\(|javascript:|@import/i.test(attr.value || "")) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (an === "srcdoc") {
      el.removeAttribute(attr.name);
      continue;
    }
  }
}

export function sanitizeHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  // querySelectorAll returns a static NodeList, so removing during iteration is safe.
  const all = doc.body.querySelectorAll("*");
  for (const el of all) {
    sanitizeElement(el);
  }
  return doc.body.innerHTML;
}