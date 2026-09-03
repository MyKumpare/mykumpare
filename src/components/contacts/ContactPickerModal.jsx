import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, User, Plus, ChevronRight, ChevronDown, Building, Users, GripVertical, List, Share2, Network, Trophy } from "lucide-react";
import ContactsSectionFilters, { filterSectionContacts } from "./ContactsSectionFilters";

const getFullName = (c) => {
  const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
  return c.designations?.length ? `${name}, ${c.designations.join(", ")}` : name;
};

const SALUTATIONS = ["mr.", "mrs.", "ms.", "dr.", "prof.", "hon.", "mr", "mrs", "ms", "dr", "prof", "hon"];
const stripSalutation = (name) => {
  const n = (name || "").trim();
  const first = n.split(/\s+/)[0]?.toLowerCase().replace(".", "") || "";
  return SALUTATIONS.includes(first) ? n.split(/\s+/).slice(1).join(" ") : n;
};
const byFirstName = (a, b) => {
  const fn = stripSalutation(a.first_name).localeCompare(stripSalutation(b.first_name), undefined, { sensitivity: "base" });
  if (fn !== 0) return fn;
  return (a.last_name || "").localeCompare(b.last_name || "", undefined, { sensitivity: "base" });
};

export default function ContactPickerModal({ open, onClose, contacts, firms, products = [], portfolios = [], onContactClick, onAddContact, onFirmClick }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterSelected, setFilterSelected] = useState({});
  const [collapsedTypes, setCollapsedTypes] = useState({});
  const [collapsedFirms, setCollapsedFirms] = useState({});
  const [view, setView] = useState("list"); // "list" | "network" | "relationship" | "influence"

  const handleViewChange = (v) => {
    if (v === "list") { setView("list"); return; }
    onClose();
    if (v === "network") navigate("/ContactNetwork");
    else if (v === "relationship") navigate("/RelationshipNetworkMap");
    else if (v === "influence") navigate("/InfluenceLevelDashboard");
  };

  const toggleType = (type) => setCollapsedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  const toggleFirm = (key) => setCollapsedFirms(prev => ({ ...prev, [key]: !prev[key] }));

  const firmMap = useMemo(() => Object.fromEntries((firms || []).map(f => [f.id, f])), [firms]);

  const contactProductMap = useMemo(() => {
    const map = {};
    for (const p of products || []) {
      for (const member of (p.investment_team || [])) {
        const cid = member.contact_id;
        if (!cid) continue;
        if (!map[cid]) map[cid] = [];
        if (!map[cid].includes(p.name)) map[cid].push(p.name);
      }
    }
    return map;
  }, [products]);

  const contactPortfolioMap = useMemo(() => {
    const map = {};
    if (!portfolios || !contacts) return map;
    const firmPortfolioMap = {};
    for (const p of portfolios) {
      if (p.deleted_at) continue;
      for (const fid of [p.firm_id, p.advisor_firm_id].filter(Boolean)) {
        if (!firmPortfolioMap[fid]) firmPortfolioMap[fid] = [];
        if (!firmPortfolioMap[fid].includes(p.portfolio_name)) firmPortfolioMap[fid].push(p.portfolio_name);
      }
    }
    for (const c of contacts) {
      const names = new Set();
      for (const fid of c.firm_ids || []) {
        for (const name of firmPortfolioMap[fid] || []) names.add(name);
      }
      if (names.size > 0) map[c.id] = Array.from(names);
    }
    return map;
  }, [portfolios, contacts]);

  const handleToggleFilter = (fieldKey, value) => {
    setFilterSelected(prev => {
      const next = { ...prev };
      const s = new Set(next[fieldKey] || []);
      if (s.has(value)) s.delete(value); else s.add(value);
      if (s.size === 0) delete next[fieldKey]; else next[fieldKey] = s;
      return next;
    });
  };
  const handleClearFilters = () => { setFilterSelected({}); setSearch(""); };

  const firmTypeMap = useMemo(() => {
    const map = {};
    (firms || []).forEach(f => {
      const types = f.firm_types?.length ? f.firm_types : (f.firm_type ? [f.firm_type] : []);
      map[f.id] = types;
    });
    return map;
  }, [firms]);

  const activeContacts = useMemo(() => contacts.filter(c => !c.deleted_at), [contacts]);

  const hasFilters = search.trim() || Object.keys(filterSelected).length > 0;
  const filtered = useMemo(() => {
    if (!hasFilters) return activeContacts;
    return filterSectionContacts(activeContacts, search, filterSelected, firmMap, contactProductMap, contactPortfolioMap);
  }, [activeContacts, search, filterSelected, firmMap, contactProductMap, contactPortfolioMap, hasFilters]);

  // Group: firm_type → firm_name → contacts (all sorted ascending alphabetically)
  const grouped = useMemo(() => {
    const result = {};
    filtered.forEach(c => {
      const primaryFirmId = (c.firm_ids || [])[0];
      const firmTypes = primaryFirmId ? (firmTypeMap[primaryFirmId] || []) : [];
      const type = firmTypes[0] || "Other";
      const firmName = primaryFirmId ? (firmMap[primaryFirmId]?.name || "Unknown Firm") : "No Firm";
      if (!result[type]) result[type] = {};
      if (!result[type][firmName]) result[type][firmName] = [];
      result[type][firmName].push(c);
    });

    const sortedResult = {};
    Object.keys(result).sort((a, b) => a.localeCompare(b)).forEach(type => {
      sortedResult[type] = Object.keys(result[type])
        .sort((a, b) => a.localeCompare(b))
        .map(firm => ({
          firm,
          contacts: result[type][firm].sort(byFirstName),
        }));
    });
    return sortedResult;
  }, [filtered, firmMap, firmTypeMap]);

  if (!open) return null;

  const types = Object.keys(grouped);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[82vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <User className="w-4 h-4 text-pink-600" />
                Contacts
                <span className="text-xs text-gray-400 font-normal">({filtered.length})</span>
              </h2>
              {/* View toggle */}
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => handleViewChange("list")} className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  <List className="w-3.5 h-3.5" /> List
                </button>
                <button onClick={() => handleViewChange("network")} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                  <Share2 className="w-3.5 h-3.5" /> Network Map
                </button>
                <button onClick={() => handleViewChange("relationship")} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                  <Network className="w-3.5 h-3.5" /> Relationship Map
                </button>
                <button onClick={() => handleViewChange("influence")} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                  <Trophy className="w-3.5 h-3.5" /> Influence
                </button>
              </div>
            </div>
            <button type="button" onClick={onClose}>
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          {/* Action buttons row */}
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="text-gray-300 flex items-center pr-0.5" title="Drag to reorder">
              <GripVertical className="w-3 h-3" />
            </span>
            <button
              type="button"
              onClick={() => { onClose(); navigate("/XponanceDashboard"); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-colors"
              title="Firm Coverage"
            >
              <Users className="w-3.5 h-3.5" /> Firm Coverage
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-gray-100">
          <ContactsSectionFilters
            contacts={contacts}
            firms={firms}
            products={products}
            portfolios={portfolios}
            text={search}
            onTextChange={setSearch}
            selected={filterSelected}
            onToggle={handleToggleFilter}
            onClear={handleClearFilters}
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">
              {search ? "No contacts match your search." : "No contacts yet."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {types.map(type => {
                const isTypeCollapsed = collapsedTypes[type];
                const firmGroups = grouped[type];

                return (
                  <div key={type}>
                    {/* Contact Type Header */}
                    <button
                      type="button"
                      onClick={() => toggleType(type)}
                      className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      {isTypeCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-pink-600 flex-shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-pink-600 flex-shrink-0" />
                      }
                      <span className="text-[10px] font-bold text-pink-700 uppercase tracking-wider">{type}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {firmGroups.reduce((sum, fg) => sum + fg.contacts.length, 0)}
                      </span>
                    </button>

                    {!isTypeCollapsed && (
                      <div className="pb-1">
                        {firmGroups.map(({ firm, contacts: firmContacts }) => {
                          const firmKey = `${type}::${firm}`;
                          const isFirmCollapsed = collapsedFirms[firmKey];

                          return (
                            <div key={firmKey}>
                              {/* Firm Sub-header */}
                              <div className="w-full flex items-center gap-2 pl-8 pr-4 py-1 hover:bg-gray-50 transition-colors">
                                <button
                                  type="button"
                                  onClick={() => toggleFirm(firmKey)}
                                  className="flex items-center gap-2 flex-1 min-w-0"
                                >
                                  {isFirmCollapsed
                                    ? <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                    : <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                  }
                                  <Building className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                  <span className="text-[11px] font-semibold text-gray-500 truncate">{firm}</span>
                                </button>
                                {(() => {
                                  const firmId = (firmContacts[0]?.firm_ids || [])[0];
                                  const firmObj = firmId ? firmMap[firmId] : null;
                                  return firmObj && onFirmClick ? (
                                    <button
                                      type="button"
                                      onClick={() => { onFirmClick(firmObj); onClose(); }}
                                      className="text-[10px] text-indigo-600 hover:text-indigo-700 hover:underline font-medium flex-shrink-0"
                                    >
                                      View →
                                    </button>
                                  ) : null;
                                })()}
                                <span className="text-[10px] text-gray-300 ml-auto">{firmContacts.length}</span>
                              </div>

                              {/* Contacts under firm */}
                              {!isFirmCollapsed && (
                                <div className="pl-10 pr-4 pb-1 space-y-0.5">
                                  {firmContacts.map(contact => (
                                    <button
                                      key={contact.id}
                                      type="button"
                                      onClick={() => { onContactClick(contact); onClose(); }}
                                      className="w-full text-left flex items-center gap-3 pl-4 pr-3 py-2 rounded-xl hover:bg-pink-50 transition-all group"
                                    >
                                      {contact.photo_url ? (
                                        <img src={contact.photo_url} alt={getFullName(contact)} className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                                      ) : (
                                        <div className="w-7 h-7 rounded-full bg-pink-50 flex-shrink-0" />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-pink-700">
                                          {getFullName(contact)}
                                        </p>
                                        {contact.title && (
                                          <p className="text-xs text-gray-400 truncate">{contact.title}</p>
                                        )}
                                      </div>
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-pink-400 flex-shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { onAddContact(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Contact
          </button>
        </div>
      </div>
    </div>
  );
}