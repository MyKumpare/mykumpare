import React, { useState, useMemo } from "react";
import { Search, X, Crown, Building2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ContactNetworkSidebar({
  firms,
  contacts,
  highlightFirmId,
  onHighlightFirm,
}) {
  const [search, setSearch] = useState("");

  const activeFirms = useMemo(
    () => firms.filter((f) => !f.deleted_at),
    [firms]
  );

  // Investment Manager firms only, with FDM count per firm
  const investmentFirms = useMemo(() => {
    const q = search.toLowerCase().trim();
    return activeFirms
      .filter((f) => {
        const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
        return types.includes("Investment Manager");
      })
      .map((f) => {
        const fdmCount = contacts.filter(
          (c) =>
            !c.deleted_at &&
            (c.firm_ids || []).includes(f.id) &&
            c.influence_level === "Final Decision Maker"
        ).length;
        return { ...f, _fdmCount: fdmCount };
      })
      .filter((f) => !q || (f.name || "").toLowerCase().includes(q))
      .sort((a, b) => b._fdmCount - a._fdmCount || (a.name || "").localeCompare(b.name || ""));
  }, [activeFirms, contacts, search]);

  const selectedFirm = activeFirms.find((f) => f.id === highlightFirmId);
  const selectedFdmCount = selectedFirm
    ? contacts.filter(
        (c) =>
          !c.deleted_at &&
          (c.firm_ids || []).includes(highlightFirmId) &&
          c.influence_level === "Final Decision Maker"
      ).length
    : 0;

  return (
    <div className="w-64 flex-shrink-0 flex flex-col gap-3">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-gray-800">Final Decision Makers</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Pick a firm to highlight its top decision makers
          </p>
        </div>

        <div className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search investment firms…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-8 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {highlightFirmId && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-xs font-medium text-amber-800 truncate">
                {selectedFirm?.name || "Selected firm"}
              </span>
              <button
                type="button"
                onClick={() => onHighlightFirm(null)}
                className="text-amber-600 hover:text-amber-800 flex-shrink-0"
                title="Clear highlight"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="max-h-[calc(100vh-420px)] overflow-y-auto px-2 pb-2 space-y-0.5">
          {investmentFirms.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              No investment firms found
            </p>
          ) : (
            investmentFirms.map((firm) => {
              const isActive = firm.id === highlightFirmId;
              return (
                <button
                  key={firm.id}
                  type="button"
                  onClick={() => onHighlightFirm(isActive ? null : firm.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                    isActive
                      ? "bg-amber-100 text-amber-900 font-medium ring-1 ring-amber-300"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5 min-w-0">
                    <Building2 className="w-3 h-3 flex-shrink-0 text-gray-400" />
                    {firm.name}
                  </span>
                  {firm._fdmCount > 0 && (
                    <span
                      className={`flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        isActive
                          ? "bg-amber-200 text-amber-900"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      <Crown className="w-2.5 h-2.5" />
                      {firm._fdmCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {highlightFirmId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-amber-800">
            <Users className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {selectedFdmCount} Final Decision Maker{selectedFdmCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-amber-700 mt-1">
            Graph shows only this firm's top decision makers. Other contacts are hidden.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => onHighlightFirm(null)}
          >
            Show full network
          </Button>
        </div>
      )}
    </div>
  );
}