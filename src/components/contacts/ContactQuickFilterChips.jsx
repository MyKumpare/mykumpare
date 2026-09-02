import React, { useMemo } from "react";
import { Building2, Briefcase, X } from "lucide-react";

// Quick-toggle filter chips for contact departments (contact_firm_roles) and
// roles (contact_roles). Clicking a chip toggles membership in the parent's
// Set-based filterValues, which already drive the existing contact filtering.
export default function ContactQuickFilterChips({ contacts, values, onChange }) {
  const { departments, roles } = useMemo(() => {
    const dept = new Set();
    const role = new Set();
    for (const c of contacts || []) {
      if (c.deleted_at) continue;
      (c.contact_firm_roles || []).forEach((v) => v && dept.add(v));
      (c.contact_roles || []).forEach((v) => v && role.add(v));
    }
    return {
      departments: Array.from(dept).sort((a, b) => a.localeCompare(b)),
      roles: Array.from(role).sort((a, b) => a.localeCompare(b)),
    };
  }, [contacts]);

  const toggle = (key, value) => {
    onChange(key, value);
  };

  const renderChips = (key, items, accent) => {
    if (!items.length) return null;
    const sel = values[key] || new Set();
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item) => {
          const active = sel.has(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(key, item)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? `${accent.active} border-transparent`
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              {item}
              {active && <X className="w-3 h-3" />}
            </button>
          );
        })}
      </div>
    );
  };

  const hasDepts = departments.length > 0;
  const hasRoles = roles.length > 0;
  if (!hasDepts && !hasRoles) return null;

  return (
    <div className="mb-3 space-y-2">
      {hasDepts && (
        <div className="flex items-start gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 pt-1 w-24 flex-shrink-0">
            <Building2 className="w-3 h-3" /> Department
          </span>
          {renderChips("contact_firm_roles", departments, {
            active: "bg-blue-600 text-white",
          })}
        </div>
      )}
      {hasRoles && (
        <div className="flex items-start gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 pt-1 w-24 flex-shrink-0">
            <Briefcase className="w-3 h-3" /> Role
          </span>
          {renderChips("contact_roles", roles, {
            active: "bg-purple-600 text-white",
          })}
        </div>
      )}
    </div>
  );
}