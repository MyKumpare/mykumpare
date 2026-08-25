// Shared progress-status definitions for RFP/RFI records.
// Used by the card, dialog, tab, dashboard, and the "due this week" summary.

export const PROGRESS_OPTIONS = [
  "Draft",
  "Submitted",
  "Under Review",
  "Awarded",
  "Not Awarded",
  "Cancelled",
];

// Terminal (completed) progress states — hidden by the "Hide completed" toggle.
export const TERMINAL_PROGRESS = ["Awarded", "Not Awarded", "Cancelled"];

export const PROGRESS_STYLES = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Submitted: "bg-primary/15 text-primary border-primary/30",
  "Under Review": "bg-amber-100 text-amber-700 border-amber-200",
  Awarded: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Not Awarded": "bg-red-100 text-red-700 border-red-200",
  Cancelled: "bg-gray-100 text-gray-400 border-gray-200 line-through",
};

export function progressStyle(status) {
  return PROGRESS_STYLES[status] || PROGRESS_STYLES.Draft;
}

export function isCompleted(record) {
  return TERMINAL_PROGRESS.includes(record?.progress_status);
}

// ─── Decision status (go/no-go tag) ───
export const DECISION_OPTIONS = ["Needs Review", "Submitted", "Passed"];

export const DECISION_STYLES = {
  "Needs Review": "bg-amber-100 text-amber-700 border-amber-200",
  "Submitted": "bg-primary/15 text-primary border-primary/30",
  "Passed": "bg-gray-100 text-gray-500 border-gray-200 line-through",
};

export function decisionStyle(status) {
  return DECISION_STYLES[status] || DECISION_STYLES["Needs Review"];
}

// ─── Product match status ───
export const PRODUCT_MATCH_STYLES = {
  "Match": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Near Match": "bg-amber-100 text-amber-700 border-amber-200",
  "No Match": "bg-red-100 text-red-700 border-red-200",
  "Not Checked": "bg-gray-100 text-gray-400 border-gray-200",
};

export function productMatchStyle(status) {
  return PRODUCT_MATCH_STYLES[status] || PRODUCT_MATCH_STYLES["Not Checked"];
}