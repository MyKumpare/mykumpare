import React from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "active", label: "Active" },
  { key: "pending_approval", label: "Pending Approval" },
  { key: "completed", label: "Completed" },
];

/** Categorize a single DD record into active / pending_approval / completed. */
export function categorizeDdRecord(rec) {
  const stages = rec.stages || [];

  // Completed: process is marked completed
  if (rec.process_status === "Completed") return "completed";

  // Pending Approval: any stage has all sub-stages completed but supervisor hasn't decided
  const hasPendingApproval = stages.some((stage) => {
    const subs = stage.sub_stages || [];
    if (subs.length === 0) return false;
    const allSubsCompleted = subs.every((ss) => (ss.status || "not_started") === "completed");
    return allSubsCompleted && stage.supervisor_status === "pending";
  });
  if (hasPendingApproval) return "pending_approval";

  return "active";
}

export function getDdCounts(records) {
  const counts = { active: 0, pending_approval: 0, completed: 0 };
  records.forEach((rec) => {
    const cat = categorizeDdRecord(rec);
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return counts;
}

export function filterDdRecords(records, tab) {
  if (!tab || tab === "all") return records;
  return records.filter((rec) => categorizeDdRecord(rec) === tab);
}

export default function DdFilterTabs({ activeTab, onChange, counts }) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors border-b-2 -mb-px",
            activeTab === tab.key
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          )}
        >
          {tab.label}
          {counts && counts[tab.key] != null && (
            <span
              className={cn(
                "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full",
                activeTab === tab.key ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-500"
              )}
            >
              {counts[tab.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}