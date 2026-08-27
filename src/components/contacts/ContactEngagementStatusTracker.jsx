import React from "react";
import { Sparkles, Handshake, Archive } from "lucide-react";

const STATUSES = [
  { value: "New", label: "New", icon: Sparkles, color: "sky", dot: "bg-sky-500", text: "text-sky-700", bg: "bg-sky-100", border: "border-sky-300", ring: "ring-sky-400" },
  { value: "Engaged", label: "Engaged", icon: Handshake, color: "emerald", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-300", ring: "ring-emerald-400" },
  { value: "Archived", label: "Archived", icon: Archive, color: "gray", dot: "bg-gray-500", text: "text-gray-600", bg: "bg-gray-100", border: "border-gray-300", ring: "ring-gray-400" },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

/**
 * Visual stepper showing a contact's relationship status: New → Engaged → Archived.
 *
 * @param {string} value     - Current engagement_status ("New" | "Engaged" | "Archived")
 * @param {function} onChange - Called with the new value when a step is clicked (omit for read-only)
 * @param {boolean} compact - Smaller variant for tight spaces (e.g. dialog headers)
 */
export default function ContactEngagementStatusTracker({ value = "New", onChange, compact = false }) {
  const currentIdx = STATUSES.findIndex((s) => s.value === value);
  const readOnly = !onChange;

  return (
    <div className={`inline-flex items-center rounded-full border border-gray-200 bg-gray-50/80 p-0.5 ${compact ? "" : "p-1"}`}>
      {STATUSES.map((status, idx) => {
        const Icon = status.icon;
        const isCurrent = idx === currentIdx;
        const isPast = idx < currentIdx;
        const isReachable = !readOnly;

        return (
          <React.Fragment key={status.value}>
            {idx > 0 && (
              <div
                className={`h-0.5 ${compact ? "w-3" : "w-5"} rounded-full transition-colors ${
                  isPast ? "bg-emerald-400" : "bg-gray-200"
                }`}
              />
            )}
            <button
              type="button"
              disabled={!isReachable}
              onClick={() => isReachable && onChange(status.value)}
              className={`
                inline-flex items-center gap-1 rounded-full font-medium transition-all
                ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}
                ${isCurrent
                  ? `${status.bg} ${status.text} ${status.border} border shadow-sm`
                  : isPast
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-white text-gray-400 border border-gray-200"
                }
                ${isReachable ? "cursor-pointer hover:scale-105" : "cursor-default"}
              `}
              title={readOnly ? `Status: ${status.label}` : `Set to ${status.label}`}
            >
              <Icon className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
              <span>{status.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export { STATUSES as ENGAGEMENT_STATUSES, STATUS_MAP as ENGAGEMENT_STATUS_MAP };