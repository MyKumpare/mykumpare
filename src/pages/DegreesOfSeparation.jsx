import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Building2, User, Search, X, Network } from "lucide-react";
import DegreesOfSeparationPanel from "@/components/shared/DegreesOfSeparationPanel";

export default function DegreesOfSeparation() {
  const [entityType, setEntityType] = useState("firm");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // { id, name }

  // Load entities for the source picker
  const entitiesQuery = useQuery({
    queryKey: ["dosEntities", entityType],
    queryFn: async () => {
      if (entityType === "firm") {
        const list = await base44.entities.Firm.list("-name", 2000);
        return (list || []).filter((f) => !f.deleted_at).map((f) => ({ id: f.id, name: f.name }));
      } else {
        const list = await base44.entities.Contact.list("-created_date", 3000);
        return (list || [])
          .filter((c) => !c.deleted_at)
          .map((c) => ({
            id: c.id,
            name: [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ").trim() || "Unknown",
          }));
      }
    },
    staleTime: 120_000,
  });

  const filtered = useMemo(() => {
    if (!entitiesQuery.data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return entitiesQuery.data.slice(0, 50);
    return entitiesQuery.data.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 50);
  }, [entitiesQuery.data, search]);

  const handleSelect = (entity) => {
    setSelected(entity);
    setSearch("");
  };

  const handleTypeSwitch = (type) => {
    setEntityType(type);
    setSelected(null);
    setSearch("");
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" />
          Degrees of Separation
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Explore how {entityType === "firm" ? "firms" : "contacts"} are connected through{" "}
          {entityType === "firm"
            ? "business relationships, board meetings, shared contacts, and news"
            : "shared education, employers, and board memberships"}
        </p>
      </div>

      {/* Entity type toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => handleTypeSwitch("firm")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            entityType === "firm"
              ? "bg-primary text-white shadow-sm"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <Building2 className="w-4 h-4" /> Firms
        </button>
        <button
          onClick={() => handleTypeSwitch("contact")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            entityType === "contact"
              ? "bg-primary text-white shadow-sm"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <User className="w-4 h-4" /> Contacts
        </button>
      </div>

      {/* Source selector */}
      <div className="mb-4 relative">
        <label className="text-xs font-medium text-gray-500 mb-1 block">
          Search for a source {entityType === "firm" ? "firm" : "contact"}:
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${entityType === "firm" ? "firms" : "contacts"}…`}
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {search && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {entitiesQuery.isLoading ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No matches found</div>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleSelect(e)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 text-left text-sm border-b border-gray-50 last:border-0"
                >
                  {entityType === "firm" ? (
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-700 truncate">{e.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected source + results */}
      {selected ? (
        <div>
          <div className="flex items-center gap-2 mb-3 p-2.5 bg-indigo-50 rounded-lg border border-indigo-100">
            <span className="text-xs font-medium text-indigo-600">Source:</span>
            {entityType === "firm" ? (
              <Building2 className="w-4 h-4 text-indigo-500" />
            ) : (
              <User className="w-4 h-4 text-indigo-500" />
            )}
            <span className="text-sm font-semibold text-gray-800">{selected.name}</span>
            <button
              onClick={() => setSelected(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <DegreesOfSeparationPanel
            entityType={entityType}
            sourceId={selected.id}
            sourceName={selected.name}
            onNodeClick={(node) => {
              // Navigate to the entity profile (could be enhanced)
              if (node?.entity_id && node?.entity_id !== selected.id) {
                setSelected({ id: node.entity_id, name: node.entity_name || node.label });
              }
            }}
          />
        </div>
      ) : (
        <div className="text-center py-16 text-sm text-gray-400">
          <Network className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          Search and select a {entityType === "firm" ? "firm" : "contact"} above to explore its degrees of separation.
        </div>
      )}
    </div>
  );
}