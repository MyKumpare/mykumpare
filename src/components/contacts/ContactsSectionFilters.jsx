import React, { useState, useMemo } from "react";
import { Search, SlidersHorizontal, MapPin, Package, Tag, Users, Shield, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Filter categories for the main Contacts section.
// Each category maps to Contact entity fields (or derived data for address/products/firm).
const FIELD_GROUPS = [
  {
    label: "Address",
    icon: MapPin,
    fields: [
      { key: "addr_city", label: "City" },
      { key: "addr_state", label: "State" },
      { key: "addr_country", label: "Country" },
    ],
  },
  {
    label: "Products",
    icon: Package,
    fields: [
      { key: "product_name", label: "Product" },
    ],
  },
  {
    label: "Classification",
    icon: Tag,
    fields: [
      { key: "contact_type", label: "Contact Type" },
      { key: "contact_role", label: "Role" },
      { key: "employee_status", label: "Employee Status" },
    ],
  },
  {
    label: "Demographics",
    icon: Users,
    fields: [
      { key: "gender", label: "Gender" },
      { key: "ethnicity", label: "Ethnicity", isArray: true },
      { key: "disability_status", label: "Disability Status" },
    ],
  },
  {
    label: "Ownership",
    icon: Shield,
    fields: [
      { key: "veteran_status", label: "Veteran Ownership" },
    ],
  },
  {
    label: "Firm Name",
    icon: Building2,
    fields: [
      { key: "firm_name", label: "Firm" },
    ],
  },
];

// Build a reverse map: contactId -> array of product names
function buildContactProductMap(products) {
  const map = {};
  for (const p of products || []) {
    const team = p.investment_team || [];
    for (const member of team) {
      const cid = member.contact_id;
      if (!cid) continue;
      if (!map[cid]) map[cid] = [];
      if (!map[cid].includes(p.name)) map[cid].push(p.name);
    }
  }
  return map;
}

function getAddrValues(c, fieldKey) {
  const addrs = c.addresses || [];
  const propMap = { addr_city: "city", addr_state: "state", addr_country: "country" };
  const prop = propMap[fieldKey];
  if (!prop) return [];
  const vals = addrs.map((a) => a[prop]).filter(Boolean);
  return [...new Set(vals)];
}

function getFieldValue(c, f, firmMap, contactProductMap) {
  if (f.key.startsWith("addr_")) {
    return getAddrValues(c, f.key);
  }
  if (f.key === "product_name") {
    return contactProductMap[c.id] || [];
  }
  if (f.key === "firm_name") {
    const firmIds = c.firm_ids || [];
    return firmIds.map((fid) => firmMap[fid]?.name).filter(Boolean);
  }
  const v = c[f.key];
  return f.isArray ? (Array.isArray(v) ? v : []) : v ? [v] : [];
}

// Pure filter function: text search + per-field multi-select
export function filterSectionContacts(contacts, text, selected, firmMap, contactProductMap) {
  const q = text.trim().toLowerCase();
  return contacts.filter((c) => {
    if (q) {
      const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
        .filter(Boolean).join(" ").toLowerCase();
      const firmNames = (c.firm_ids || []).map(fid => firmMap[fid]?.name || "").filter(Boolean).join(" ");
      const haystack = [name, c.title || "", c.email || "", c.contact_type || "",
        (c.designations || []).join(" "), firmNames].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    for (const group of FIELD_GROUPS) {
      for (const f of group.fields) {
        const sel = selected[f.key];
        if (!sel || sel.size === 0) continue;
        const vals = getFieldValue(c, f, firmMap, contactProductMap);
        if (!vals.some((v) => sel.has(v))) return false;
      }
    }
    return true;
  });
}

export default function ContactsSectionFilters({ contacts, firms, products, text, onTextChange, selected, onToggle, onClear }) {
  const [showFilters, setShowFilters] = useState(false);

  const firmMap = useMemo(
    () => Object.fromEntries((firms || []).map((f) => [f.id, f])),
    [firms]
  );

  const contactProductMap = useMemo(
    () => buildContactProductMap(products),
    [products]
  );

  // Derive available options from the current contact set
  const options = useMemo(() => {
    const opts = {};
    for (const group of FIELD_GROUPS) {
      for (const f of group.fields) {
        const set = new Set();
        for (const c of contacts) {
          getFieldValue(c, f, firmMap, contactProductMap).forEach((v) => v && set.add(v));
        }
        opts[f.key] = Array.from(set).sort();
      }
    }
    return opts;
  }, [contacts, firmMap, contactProductMap]);

  const activeCount = Object.values(selected).reduce((n, s) => n + (s ? s.size : 0), 0) + (text.trim() ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Search by name, firm, title, or type..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs whitespace-nowrap"
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-pink-600 text-white text-[10px]">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Filter contacts</span>
            {activeCount > 0 && (
              <button type="button" onClick={onClear} className="text-xs text-pink-600 hover:underline">
                Clear all
              </button>
            )}
          </div>
          {FIELD_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            const hasAny = group.fields.some((f) => (options[f.key] || []).length > 0);
            if (!hasAny) return null;
            return (
              <div key={group.label} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <GroupIcon className="w-3 h-3 text-gray-500" />
                  <p className="text-xs font-semibold text-gray-700">{group.label}</p>
                </div>
                {group.fields.map((f) => {
                  const opts = options[f.key] || [];
                  if (opts.length === 0) return null;
                  return (
                    <div key={f.key} className="space-y-1 pl-4">
                      <span className="text-[11px] text-gray-500">{f.label}</span>
                      <div className="flex flex-wrap gap-1">
                        {opts.map((v) => {
                          const isActive = selected[f.key]?.has(v);
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => onToggle(f.key, v)}
                              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${isActive ? "bg-pink-600 text-white border-pink-600" : "bg-white text-gray-700 border-gray-300 hover:border-pink-400"}`}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}