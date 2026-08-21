// Shared style constants for news alert levels and sentiment status.
// Extracted to avoid circular imports between FirmNewsTab and NewsStatusBadge.

export const ALERT_STYLES = {
  High: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: "AlertTriangle" },
  Medium: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: "AlertTriangle" },
  Low: { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", icon: "ChevronDown" },
};

export const STATUS_STYLES = {
  Positive: { color: "text-green-600", bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500" },
  Negative: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
  Neutral: { color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", dot: "bg-gray-400" },
};