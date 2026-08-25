import React, { useState, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Search, SlidersHorizontal, MapPin, Package, Tag, Users, Shield, Building2, Briefcase, ChevronDown, ChevronRight, GripVertical, GraduationCap, Phone, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DateRangeFilter from "@/components/common/DateRangeFilter";

// Filter categories for the main Contacts section.
// Each category maps to Contact entity fields (or derived data for address/products/firm).
const FIELD_GROUPS = [
  {
    label: "Info",
    icon: User,
    fields: [
      { key: "salutation", label: "Salutation" },
      { key: "suffix", label: "Suffix" },
    ],
  },
  {
    label: "Address",
    icon: MapPin,
    fields: [
      { key: "addr_city", label: "City" },
      { key: "addr_state", label: "State" },
      { key: "addr_country", label: "Country" },
      { key: "addr_postal_code", label: "Postal Code" },
    ],
  },
  {
    label: "Phones",
    icon: Phone,
    fields: [
      { key: "phone_type", label: "Phone Type" },
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
    label: "Portfolios",
    icon: Briefcase,
    fields: [
      { key: "portfolio_name", label: "Portfolio" },
    ],
  },
  {
    label: "Education",
    icon: GraduationCap,
    fields: [
      { key: "edu_institution", label: "Institution" },
      { key: "edu_degree", label: "Degree" },
      { key: "edu_specialization", label: "Area of Specialization" },
      { key: "edu_majors", label: "Major(s)", isArray: true },
      { key: "edu_minors", label: "Minor(s)", isArray: true },
      { key: "designations", label: "Professional Designations", isArray: true },
    ],
  },
  {
    label: "Experience",
    icon: Briefcase,
    fields: [
      { key: "exp_company", label: "Company" },
      { key: "exp_title", label: "Title" },
    ],
  },
  {
    label: "Classification",
    icon: Tag,
    fields: [
      { key: "contact_status", label: "Contact Status" },
      { key: "contact_type", label: "Contact Type", isArray: true },
      { key: "contact_role", label: "Priority" },
      { key: "contact_roles", label: "Contact Role", isArray: true },
      { key: "contact_firm_roles", label: "Contact Department", isArray: true },
      { key: "tags", label: "Tags", isArray: true },
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
    label: "Firm",
    icon: Building2,
    fields: [
      { key: "firm_name", label: "Firm" },
    ],
  },
];

const FILTER_ORDER_KEY = "contacts-filter-order";

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

// Build a reverse map: contactId -> array of portfolio names
// A contact is associated with a portfolio if any of their firm_ids matches
// the portfolio's allocator firm (firm_id) or advisor firm (advisor_firm_id).
function buildContactPortfolioMap(portfolios, contacts) {
  const map = {};
  if (!portfolios || !contacts) return map;
  // Build firmId -> [portfolio names] lookup
  const firmPortfolioMap = {};
  for (const p of portfolios) {
    if (p.deleted_at) continue;
    const firmIds = [p.firm_id, p.advisor_firm_id].filter(Boolean);
    for (const fid of firmIds) {
      if (!firmPortfolioMap[fid]) firmPortfolioMap[fid] = [];
      if (!firmPortfolioMap[fid].includes(p.portfolio_name)) firmPortfolioMap[fid].push(p.portfolio_name);
    }
  }
  // Map each contact to portfolio names via their firm_ids
  for (const c of contacts) {
    const firmIds = c.firm_ids || [];
    const names = new Set();
    for (const fid of firmIds) {
      for (const name of firmPortfolioMap[fid] || []) names.add(name);
    }
    if (names.size > 0) map[c.id] = Array.from(names);
  }
  return map;
}

function getAddrValues(c, fieldKey) {
  const addrs = c.addresses || [];
  const propMap = { addr_city: "city", addr_state: "state", addr_country: "country", addr_postal_code: "postal_code" };
  const prop = propMap[fieldKey];
  if (!prop) return [];
  const vals = addrs.map((a) => a[prop]).filter(Boolean);
  return [...new Set(vals)];
}

function getFieldValue(c, f, firmMap, contactProductMap, contactPortfolioMap) {
  if (f.key.startsWith("addr_")) {
    return getAddrValues(c, f.key);
  }
  if (f.key === "product_name") {
    return contactProductMap[c.id] || [];
  }
  if (f.key === "portfolio_name") {
    return contactPortfolioMap[c.id] || [];
  }
  if (f.key === "firm_name") {
    const firmIds = c.firm_ids || [];
    return firmIds.map((fid) => firmMap[fid]?.name).filter(Boolean);
  }
  if (f.key === "phone_type") {
    const phones = c.phones || [];
    return [...new Set(phones.map((p) => p.phone_type).filter(Boolean))];
  }
  if (f.key.startsWith("edu_")) {
    const edu = c.education || [];
    const propMap = {
      edu_institution: "institution",
      edu_degree: "degree",
      edu_specialization: "area_of_specialization",
      edu_majors: "majors",
      edu_minors: "minors",
    };
    const prop = propMap[f.key];
    if (!prop) return [];
    if (f.isArray) {
      return [...new Set(edu.flatMap((e) => e[prop] || []))];
    }
    return [...new Set(edu.map((e) => e[prop]).filter(Boolean))];
  }
  if (f.key.startsWith("exp_")) {
    const exp = c.professional_experience || [];
    const propMap = { exp_company: "company_name", exp_title: "title" };
    const prop = propMap[f.key];
    if (!prop) return [];
    return [...new Set(exp.map((e) => e[prop]).filter(Boolean))];
  }
  const v = c[f.key];
  return f.isArray ? (Array.isArray(v) ? v : []) : v ? [v] : [];
}

// Pure filter function: text search + per-field multi-select + optional date range
export function filterSectionContacts(contacts, text, selected, firmMap, contactProductMap, contactPortfolioMap, dateRange) {
  const keywords = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const start = dateRange?.start ? new Date(dateRange.start + "T00:00:00") : null;
  const end = dateRange?.end ? new Date(dateRange.end + "T23:59:59") : null;
  return contacts.filter((c) => {
    if (start || end) {
      if (!c.created_date) return false;
      const d = new Date(c.created_date);
      if (start && d < start) return false;
      if (end && d > end) return false;
    }
    if (keywords.length) {
      const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
        .filter(Boolean).join(" ").toLowerCase();
      const firmNames = (c.firm_ids || []).map(fid => firmMap[fid]?.name || "").filter(Boolean).join(" ");
      const designations = (c.designations || []).join(" ");
      const eduText = (c.education || []).map(e =>
        [e.institution, e.degree, e.area_of_specialization, ...(e.majors || []), ...(e.minors || [])].filter(Boolean).join(" ")
      ).join(" ");
      const expText = (c.professional_experience || []).map(e =>
        [e.company_name, e.title].filter(Boolean).join(" ")
      ).join(" ");
      const tagsText = (c.tags || []).join(" ");
      const haystack = [name, c.title || "", c.email || "", (Array.isArray(c.contact_type) ? c.contact_type.join(" ") : c.contact_type || ""),
        designations, firmNames, eduText, expText, tagsText].join(" ").toLowerCase();
      // AND logic: every keyword must appear somewhere in the haystack so
      // "tina williams" matches "Tina Byles Williams" (words need not be adjacent).
      if (!keywords.every((kw) => haystack.includes(kw))) return false;
    }
    for (const group of FIELD_GROUPS) {
      for (const f of group.fields) {
        const sel = selected[f.key];
        if (!sel || sel.size === 0) continue;
        const vals = getFieldValue(c, f, firmMap, contactProductMap, contactPortfolioMap);
        if (!vals.some((v) => sel.has(v))) return false;
      }
    }
    return true;
  });
}

export default function ContactsSectionFilters({ contacts, firms, products, portfolios, text, onTextChange, selected, onToggle, onClear, dateRange, onDateRangeChange }) {
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(FIELD_GROUPS.map((g) => g.label)));

  // Persisted drag-and-drop ordering of filter categories
  const [groupOrder, setGroupOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(FILTER_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const labels = FIELD_GROUPS.map((g) => g.label);
        const ordered = parsed.filter((l) => labels.includes(l));
        labels.forEach((l) => { if (!ordered.includes(l)) ordered.push(l); });
        return ordered;
      }
    } catch {}
    return FIELD_GROUPS.map((g) => g.label);
  });

  const orderedGroups = useMemo(
    () => groupOrder.map((label) => FIELD_GROUPS.find((g) => g.label === label)).filter(Boolean),
    [groupOrder]
  );

  const onDragEnd = (result) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    setGroupOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, moved);
      try { localStorage.setItem(FILTER_ORDER_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const toggleGroup = (label) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const firmMap = useMemo(
    () => Object.fromEntries((firms || []).map((f) => [f.id, f])),
    [firms]
  );

  const contactProductMap = useMemo(
    () => buildContactProductMap(products),
    [products]
  );

  const contactPortfolioMap = useMemo(
    () => buildContactPortfolioMap(portfolios, contacts),
    [portfolios, contacts]
  );

  // Derive available options from the current contact set
  const options = useMemo(() => {
    const opts = {};
    for (const group of FIELD_GROUPS) {
      for (const f of group.fields) {
        const set = new Set();
        for (const c of contacts) {
          getFieldValue(c, f, firmMap, contactProductMap, contactPortfolioMap).forEach((v) => v && set.add(v));
        }
        opts[f.key] = Array.from(set).sort();
      }
    }
    return opts;
  }, [contacts, firmMap, contactProductMap, contactPortfolioMap]);

  const activeCount = Object.values(selected).reduce((n, s) => n + (s ? s.size : 0), 0) + (text.trim() ? 1 : 0) + ((dateRange?.start || dateRange?.end) ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-1 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Search by name, firm, title, or type..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <DateRangeFilter
          value={dateRange || { start: "", end: "" }}
          onChange={onDateRangeChange}
          label="Filter by date added"
        />
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

      {/* Tag quick-filter — always visible when tags are in use */}
      {(() => {
        const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags || []))).filter(Boolean).sort();
        if (allTags.length === 0) return null;
        const activeTags = selected["tags"] || new Set();
        return (
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="text-[11px] text-gray-500 font-medium mr-0.5 inline-flex items-center gap-0.5">
              <Tag className="w-3 h-3" /> Tags:
            </span>
            {allTags.map((t) => {
              const isActive = activeTags.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onToggle("tags", t)}
                  className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${isActive ? "bg-pink-600 text-white border-pink-600" : "bg-white text-gray-700 border-gray-300 hover:border-pink-400"}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        );
      })()}

      {showFilters && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3 max-h-[28vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Filter contacts <span className="text-gray-400 font-normal">(drag to reorder)</span></span>
            {activeCount > 0 && (
              <button type="button" onClick={onClear} className="text-xs text-pink-600 hover:underline">
                Clear all
              </button>
            )}
          </div>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="filter-groups">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                  {orderedGroups.map((group, index) => {
                    const GroupIcon = group.icon;
                    const hasAny = group.fields.some((f) => (options[f.key] || []).length > 0);
                    if (!hasAny) return null;
                    const isCollapsed = collapsedGroups.has(group.label);
                    const groupActiveCount = group.fields.reduce(
                      (n, f) => n + ((selected[f.key] || new Set()).size),
                      0
                    );
                    return (
                      <Draggable key={group.label} draggableId={group.label} index={index}>
                        {(dragProvided) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className="space-y-1.5 bg-white rounded-md p-1.5 shadow-sm"
                          >
                            <div className="flex items-center gap-1 w-full">
                              <span
                                {...dragProvided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
                              >
                                <GripVertical className="w-3 h-3" />
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleGroup(group.label)}
                                className="flex items-center gap-1.5 flex-1 text-left"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-3 h-3 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-gray-400" />
                                )}
                                <GroupIcon className="w-3 h-3 text-gray-500" />
                                <p className="text-xs font-semibold text-gray-700">{group.label}</p>
                                {groupActiveCount > 0 && (
                                  <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-pink-600 text-white text-[10px]">
                                    {groupActiveCount}
                                  </span>
                                )}
                              </button>
                            </div>
                            {!isCollapsed && group.fields.map((f) => {
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
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}
    </div>
  );
}