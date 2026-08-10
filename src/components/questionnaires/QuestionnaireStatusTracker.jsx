import React from "react";
import { Check } from "lucide-react";

/**
 * Visual 3-step status tracker for a questionnaire.
 * Maps the 6 internal statuses into 3 user-facing stages:
 *   Pending      → Draft, Sent, In Progress
 *   Under Review → Submitted, Under Review
 *   Completed    → Completed
 *
 * Props:
 *   status — the questionnaire's current status string
 */
const STAGES = [
  { key: "pending", label: "Pending", statuses: ["Draft", "Sent", "In Progress"] },
  { key: "review", label: "Under Review", statuses: ["Submitted", "Under Review"] },
  { key: "completed", label: "Completed", statuses: ["Completed"] },
];

export default function QuestionnaireStatusTracker({ status }) {
  const activeIndex = STAGES.findIndex((s) => s.statuses.includes(status));

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, idx) => {
        const isDone = activeIndex > idx;
        const isActive = activeIndex === idx;
        const isReached = activeIndex >= idx;

        return (
          <React.Fragment key={stage.key}>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`flex items-center justify-center w-4 h-4 rounded-full border text-[8px] transition-colors ${
                  isDone
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : isActive
                    ? "bg-indigo-500 border-indigo-500 text-white"
                    : "bg-gray-50 border-gray-300 text-gray-300"
                }`}
              >
                {isDone ? (
                  <Check className="w-2.5 h-2.5" />
                ) : (
                  <span className="font-bold">{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-[9px] font-medium transition-colors ${
                  isReached ? "text-gray-700" : "text-gray-400"
                }`}
              >
                {stage.label}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div
                className={`h-px flex-1 min-w-[8px] transition-colors ${
                  activeIndex > idx ? "bg-emerald-400" : "bg-gray-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}