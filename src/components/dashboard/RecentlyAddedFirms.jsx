import React from "react";
import { Clock, Building2, ChevronRight } from "lucide-react";

/**
 * Shows the five most recently created firm records below the category chart.
 *
 * Props:
 *  - firms: array of active (non-deleted) firm records
 */
export default function RecentlyAddedFirms({ firms }) {
  const recent = React.useMemo(() => {
    if (!firms || firms.length === 0) return [];
    return [...firms]
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 5);
  }, [firms]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Clock className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-700">Recently Added Firms</h3>
        <span className="text-xs text-gray-400">({recent.length})</span>
      </div>

      {recent.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No firms yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {recent.map((firm) => (
            <li
              key={firm.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center overflow-hidden">
                {firm.logo_url ? (
                  <img
                    src={firm.logo_url}
                    alt={firm.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-4 h-4 text-indigo-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{firm.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {firm.firm_type || "Uncategorized"}
                  {firm.year_founded ? ` · Founded ${firm.year_founded}` : ""}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-gray-400">
                  {firm.created_date
                    ? new Date(firm.created_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}