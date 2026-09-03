import React, { useState, useMemo } from "react";
import { UserCircle2, LayoutGrid, BarChart3 } from "lucide-react";
import AnalystAssignmentChart from "@/components/coverage/AnalystAssignmentChart";

const THEME = {
  indigo: { active: "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300", hover: "border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30", iconBg: "bg-indigo-100", iconText: "text-indigo-400" },
  violet: { active: "border-violet-400 bg-violet-50 ring-2 ring-violet-300", hover: "border-gray-100 hover:border-violet-200 hover:bg-violet-50/30", iconBg: "bg-violet-100", iconText: "text-violet-400" },
  emerald: { active: "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300", hover: "border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30", iconBg: "bg-emerald-100", iconText: "text-emerald-400" },
};

const getContactName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

/**
 * Reusable Xponance analyst assignment breakdown section with a Cards / Chart toggle.
 * The card grid doubles as a click-to-filter control (via onCoveredAnalystClick).
 */
export default function AnalystBreakdownSection({
  title,
  icon,
  theme = "indigo",
  xponanceContacts,
  assignmentCounts,
  coveredAnalystId,
  onCoveredAnalystClick,
  emptyText = "No contacts found related to the Xponance firm.",
  coveredLabel = "Click to show what this analyst covers",
}) {
  const [view, setView] = useState("cards");
  const t = THEME[theme] || THEME.indigo;

  const sortedContacts = useMemo(() => {
    return [...xponanceContacts].sort((a, b) => {
      const ta = (assignmentCounts[a.id]?.primary || 0) + (assignmentCounts[a.id]?.secondary || 0);
      const tb = (assignmentCounts[b.id]?.primary || 0) + (assignmentCounts[b.id]?.secondary || 0);
      if (tb !== ta) return tb - ta;
      const an = [a.first_name, a.last_name].filter(Boolean).join(" ");
      const bn = [b.first_name, b.last_name].filter(Boolean).join(" ");
      return an.localeCompare(bn);
    });
  }, [xponanceContacts, assignmentCounts]);

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          {icon}
          {title} ({xponanceContacts.length})
        </h3>
        {xponanceContacts.length > 0 && (
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === "cards" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              title="View as cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setView("chart")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === "chart" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              title="View as chart"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Chart
            </button>
          </div>
        )}
      </div>

      {xponanceContacts.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{emptyText}</p>
      ) : view === "chart" ? (
        <AnalystAssignmentChart xponanceContacts={xponanceContacts} assignmentCounts={assignmentCounts} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sortedContacts.map((c) => {
            const counts = assignmentCounts[c.id] || { primary: 0, secondary: 0 };
            const total = counts.primary + counts.secondary;
            const isActive = coveredAnalystId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCoveredAnalystClick?.(isActive ? "" : c.id)}
                title={isActive ? "Click to clear filter" : coveredLabel}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-colors text-left w-full ${isActive ? t.active : t.hover}`}
              >
                {c.photo_url ? (
                  <img src={c.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${t.iconBg}`}>
                    <UserCircle2 className={`w-4 h-4 ${t.iconText}`} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{getContactName(c)}</p>
                  {c.title && <p className="text-xs text-gray-400 truncate">{c.title}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {counts.primary > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200" title={`${counts.primary} primary assignments`}>
                      P: {counts.primary}
                    </span>
                  )}
                  {counts.secondary > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200" title={`${counts.secondary} secondary assignments`}>
                      S: {counts.secondary}
                    </span>
                  )}
                  {total === 0 && (
                    <span className="text-xs text-gray-300">No assignments</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}