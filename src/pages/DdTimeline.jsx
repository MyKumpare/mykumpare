import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Calendar, Search, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import DdTimelineView from "@/components/firms/DdTimelineView";

export default function DdTimeline() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: ddRecords = [], isLoading } = useQuery({
    queryKey: ["dd_timeline_records"],
    queryFn: () => base44.entities.DueDiligence.list("-updated_date", 5000),
  });

  const activeRecords = useMemo(
    () => ddRecords.filter((r) => !r.deleted_at),
    [ddRecords]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return activeRecords;
    return activeRecords.filter(
      (r) =>
        (r.firm_name || "").toLowerCase().includes(q) ||
        (r.product_name || "").toLowerCase().includes(q) ||
        (r.template_name || "").toLowerCase().includes(q)
    );
  }, [activeRecords, search]);

  const selectedRecord = activeRecords.find((r) => r.id === selectedId) || activeRecords[0] || null;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Calendar className="w-7 h-7 text-white" />
          <div>
            <h1 className="text-xl font-bold text-white">Due Diligence Timeline</h1>
            <p className="text-sm text-indigo-100">
              Visual timeline of stage dates, milestones, and completion history
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Process selector */}
        <div className="mb-5">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Select Due Diligence Process</label>
          <div className="relative max-w-xl">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full h-10 px-3 flex items-center justify-between border border-gray-300 rounded-md bg-white text-sm hover:border-gray-400"
            >
              <span className="truncate">
                {selectedRecord
                  ? `${selectedRecord.firm_name} · ${selectedRecord.product_name}`
                  : "Select a process..."}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
            {dropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-96 flex flex-col">
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search firm, product, or template..."
                      className="h-8 pl-7 pr-7 text-sm"
                      autoFocus
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-y-auto max-h-72">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">
                      {isLoading ? "Loading..." : "No processes found"}
                    </p>
                  ) : (
                    filtered.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedId(r.id);
                          setDropdownOpen(false);
                          setSearch("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-800 truncate">{r.firm_name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {r.product_name} · {r.template_name} · {r.status}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        {selectedRecord ? (
          <DdTimelineView record={selectedRecord} />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {isLoading ? "Loading due diligence records..." : "No due diligence processes found."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}