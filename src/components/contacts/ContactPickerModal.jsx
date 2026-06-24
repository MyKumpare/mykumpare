import React, { useState, useMemo } from "react";
import { X, User, Plus, Search, ChevronRight, ChevronDown, Building } from "lucide-react";

const CONTACT_TYPES = [
  "Allocator",
  "Investment Consultant",
  "Investment Manager",
  "Securities Broker",
  "Trade Organization Representative",
];

const getFullName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

export default function ContactPickerModal({ open, onClose, contacts, firms, onContactClick, onAddContact }) {
  const [search, setSearch] = useState("");
  const [collapsedTypes, setCollapsedTypes] = useState({});
  const [collapsedFirms, setCollapsedFirms] = useState({});

  const toggleType = (type) => setCollapsedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  const toggleFirm = (key) => setCollapsedFirms(prev => ({ ...prev, [key]: !prev[key] }));

  const q = search.toLowerCase();

  const firmMap = useMemo(() => {
    const map = {};
    (firms || []).forEach(f => { map[f.id] = f.name; });
    return map;
  }, [firms]);

  const activeContacts = useMemo(() => contacts.filter(c => !c.deleted_at), [contacts]);

  const filtered = useMemo(() =>
    activeContacts.filter(c => {
      if (!q) return true;
      const name = getFullName(c).toLowerCase();
      const email = (c.email || "").toLowerCase();
      const title = (c.title || "").toLowerCase();
      const type = (c.contact_type || "").toLowerCase();
      const firmNames = (c.firm_ids || []).map(id => (firmMap[id] || "").toLowerCase()).join(" ");
      return name.includes(q) || email.includes(q) || title.includes(q) || type.includes(q) || firmNames.includes(q);
    }), [activeContacts, q, firmMap]);

  // Group: contact_type → firm_name → contacts (sorted alpha)
  const grouped = useMemo(() => {
    const result = {};
    const orderedTypes = CONTACT_TYPES.filter(t => filtered.some(c => c.contact_type === t));
    const otherTypes = [...new Set(
      filtered.filter(c => !CONTACT_TYPES.includes(c.contact_type)).map(c => c.contact_type || "Other")
    )];
    const allTypes = [...orderedTypes, ...otherTypes];

    allTypes.forEach(type => {
      const typeContacts = filtered.filter(c => (c.contact_type || "Other") === type);
      const firmGroups = {};

      typeContacts.forEach(c => {
        const primaryFirmId = (c.firm_ids || [])[0];
        const firmName = primaryFirmId ? (firmMap[primaryFirmId] || "Unknown Firm") : "No Firm";
        if (!firmGroups[firmName]) firmGroups[firmName] = [];
        firmGroups[firmName].push(c);
      });

      const sortedFirms = Object.keys(firmGroups).sort((a, b) => a.localeCompare(b));
      if (sortedFirms.length > 0) {
        result[type] = sortedFirms.map(firm => ({
          firm,
          contacts: firmGroups[firm].sort((a, b) => getFullName(a).localeCompare(getFullName(b))),
        }));
      }
    });

    return result;
  }, [filtered, firmMap]);

  if (!open) return null;

  const types = Object.keys(grouped);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[78vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <User className="w-4 h-4 text-pink-600" />
            Contacts
            <span className="text-xs text-gray-400 font-normal">({filtered.length})</span>
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, firm, title, or type..."
              className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 outline-none focus:border-pink-400 bg-gray-50"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
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
                              <button
                                type="button"
                                onClick={() => toggleFirm(firmKey)}
                                className="w-full flex items-center gap-2 pl-8 pr-4 py-1 hover:bg-gray-50 transition-colors"
                              >
                                {isFirmCollapsed
                                  ? <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                  : <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                }
                                <Building className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="text-[11px] font-semibold text-gray-500 truncate">{firm}</span>
                                <span className="text-[10px] text-gray-300 ml-auto">{firmContacts.length}</span>
                              </button>

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
                                        <div className="w-7 h-7 rounded-full bg-pink-50 flex items-center justify-center flex-shrink-0">
                                          <User className="w-3.5 h-3.5 text-pink-400" />
                                        </div>
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