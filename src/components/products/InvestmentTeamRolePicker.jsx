import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search, Plus, Settings2, Check } from "lucide-react";
import InvestmentTeamRoleManager from "./InvestmentTeamRoleManager";

// Built-in presets always offered even before the DB library is seeded, so the
// picker is never empty on a fresh install.
const PRESET_ROLES = [
  "Lead Analyst",
  "Compliance Officer",
  "Portfolio Manager",
  "Senior Analyst",
  "Analyst",
  "Associate",
  "Research Analyst",
  "Trader",
  "Risk Manager",
  "CIO",
  "Managing Director",
  "Partner",
];

// Quick-pick role dropdown backed by the shared InvestmentTeamRole library.
// Users pick a predefined role with one click (no typing), search to narrow,
// or type to add a new role — which is persisted to the library for everyone.
// A "Manage roles" link opens the management dialog.
export default function InvestmentTeamRolePicker({ value, onChange, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showManager, setShowManager] = useState(false);
  const inputRef = useRef(null);

  const { data: dbRoles = [] } = useQuery({
    queryKey: ["investment-team-roles"],
    queryFn: () => base44.entities.InvestmentTeamRole.list("name", 500),
  });

  const allRoles = useMemo(() => {
    const map = new Map();
    [...PRESET_ROLES, ...dbRoles.map((r) => r.name)].forEach((n) => {
      const key = n.toLowerCase().trim();
      if (!map.has(key)) map.set(key, n);
    });
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }, [dbRoles]);

  const createRole = useMutation({
    mutationFn: (name) => base44.entities.InvestmentTeamRole.create({ name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["investment-team-roles"] }),
  });

  const trimmed = search.trim();
  const canCreate = trimmed && !allRoles.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const filtered = trimmed
    ? allRoles.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()))
    : allRoles;

  useEffect(() => { inputRef.current?.focus(); }, []);

  const select = (role) => { onChange(role); setSearch(""); onClose?.(); };
  const addAndSelect = () => {
    const v = trimmed;
    createRole.mutate(v, { onSuccess: () => select(v) });
  };

  return (
    <div className="w-56">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100">
        <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 text-xs bg-transparent outline-none placeholder:text-gray-400 min-w-0"
          placeholder="Search roles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canCreate) addAndSelect(); }}
        />
      </div>
      <div className="max-h-44 overflow-y-auto p-1">
        {filtered.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => select(role)}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs hover:bg-indigo-50 text-left"
          >
            {value === role ? (
              <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}
            <span className={value === role ? "text-indigo-700 font-medium" : "text-gray-700"}>{role}</span>
          </button>
        ))}
        {canCreate && (
          <button
            type="button"
            onClick={addAndSelect}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 text-left border-t border-gray-100 mt-0.5"
          >
            <Plus className="w-3.5 h-3.5 flex-shrink-0" /> Add "{trimmed}"
          </button>
        )}
        {filtered.length === 0 && !canCreate && (
          <p className="px-2 py-2 text-xs text-gray-400 italic">No roles found</p>
        )}
      </div>
      <div className="border-t border-gray-100 px-2 py-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowManager(true)}
          className="text-[11px] text-gray-400 hover:text-indigo-600 flex items-center gap-1"
        >
          <Settings2 className="w-3 h-3" /> Manage roles
        </button>
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); onClose?.(); }}
            className="text-[11px] text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {showManager && (
        <InvestmentTeamRoleManager open={showManager} onOpenChange={setShowManager} />
      )}
    </div>
  );
}