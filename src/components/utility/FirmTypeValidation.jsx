import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Building, CheckCircle, Loader2, Tag } from "lucide-react";

export default function FirmTypeValidation({ onFirmClick }) {
  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });

  const issues = useMemo(() => {
    return firms
      .filter(f => !f.deleted_at)
      .map(f => {
        const types = f.firm_types?.length
          ? f.firm_types
          : f.firm_type ? [f.firm_type] : [];
        const hasMultiple = types.length > 1;
        const inconsistent = f.firm_type && f.firm_types?.length && !f.firm_types.includes(f.firm_type);
        return { firm: f, types, hasMultiple, inconsistent };
      })
      .filter(item => item.hasMultiple || item.inconsistent);
  }, [firms]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-indigo-500" />
        <p className="text-sm font-medium text-gray-700">
          {issues.length === 0
            ? "All firms have a single firm type."
            : `${issues.length} firm(s) have multiple or inconsistent firm types.`}
        </p>
      </div>

      {issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-dashed border-gray-200 bg-white text-center">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
          <p className="text-sm text-gray-500">No validation issues found. Every firm has exactly one type.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {issues.map(({ firm, types, hasMultiple, inconsistent }) => (
            <button
              key={firm.id}
              onClick={() => onFirmClick?.(firm)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-left transition-colors"
            >
              <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100">
                {firm.logo_url ? (
                  <img src={firm.logo_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Building className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{firm.name}</p>
                <p className="text-xs text-amber-700 truncate">
                  {types.join(", ")}
                  {inconsistent && <span className="ml-1 text-amber-500">(legacy type mismatch)</span>}
                </p>
              </div>
              <span className="text-xs text-indigo-600 font-medium whitespace-nowrap">Fix →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}