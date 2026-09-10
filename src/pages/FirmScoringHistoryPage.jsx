import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import EntityScoringHistory from "@/components/templates/EntityScoringHistory";

export default function FirmScoringHistoryPage() {
  const [search, setSearch] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState(null);

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["firmsForScoringHistory"],
    queryFn: () => base44.entities.Firm.list("-name", 500)
  });

  const filtered = (firms || []).filter((f) =>
    !search.trim() || (f.name || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  const selectedFirm = (firms || []).find((f) => f.id === selectedFirmId);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Firm Scoring History</h2>
        <p className="text-sm text-gray-500">
          Track how a firm's evaluation results have changed over time across all products and scoring matrices.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Firm list / picker */}
        <div className="border border-gray-200 rounded-lg p-2 bg-white md:max-h-[70vh] overflow-y-auto">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search firms..."
              className="pl-8 h-8 text-sm"
            />
          </div>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFirmId(f.id)}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                    selectedFirmId === f.id
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  {f.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-4">No firms found.</div>
              )}
            </div>
          )}
        </div>

        {/* History panel */}
        <div className="md:col-span-2">
          {selectedFirm ? (
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <h3 className="text-sm font-semibold mb-3">{selectedFirm.name}</h3>
              <EntityScoringHistory firmId={selectedFirm.id} />
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 text-center text-sm text-gray-400 h-full flex items-center justify-center">
              Select a firm to view its scoring history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}