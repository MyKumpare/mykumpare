import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

// Essential fields we validate against after scraping / manual entry.
// Each entry: key -> human-readable label shown in the tooltip.
const ESSENTIAL_FIELDS = [
  { key: "title", label: "Title" },
  { key: "email", label: "Email" },
];

export function getMissingEssentialFields(contact) {
  const missing = [];
  for (const { key } of ESSENTIAL_FIELDS) {
    const val = contact?.[key];
    if (!val || String(val).trim() === "") missing.push(key);
  }
  return missing;
}

export function isContactComplete(contact) {
  return getMissingEssentialFields(contact).length === 0;
}

export function getMissingFieldLabels(contact) {
  const missing = getMissingEssentialFields(contact);
  return ESSENTIAL_FIELDS.filter((f) => missing.includes(f.key)).map((f) => f.label);
}

/**
 * Small status indicator for a contact row.
 * - Green check when all essential fields are present.
 * - Amber warning badge when one or more essential fields are missing,
 *   with a tooltip listing exactly what's missing.
 */
export default function ContactCompletenessBadge({ contact }) {
  const missingLabels = getMissingFieldLabels(contact);
  const isComplete = missingLabels.length === 0;

  if (isComplete) {
    return (
      <span
        title="All essential details present"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 flex-shrink-0"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
      </span>
    );
  }

  const tooltip = `Missing: ${missingLabels.join(", ")}`;

  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0"
    >
      <AlertTriangle className="w-3 h-3" />
      {missingLabels.length} missing
    </span>
  );
}