import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronRight, User } from "lucide-react";

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const GROUP_COLORS = {
  "Manager of Managers": "bg-violet-100 text-violet-700",
  "Investment Manager": "bg-blue-100 text-blue-700",
  "Allocator": "bg-emerald-100 text-emerald-700",
  "Investment Consultant": "bg-amber-100 text-amber-700",
  "Securities Brokerage": "bg-orange-100 text-orange-700",
  "Trade Organizations": "bg-gray-100 text-gray-700",
};

function ContactAvatar({ contact }) {
  if (contact.photo_url) {
    return (
      <img
        src={contact.photo_url}
        alt={contact.first_name}
        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  const initials = [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  return (
    <div className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
      {initials || <User className="w-3 h-3" />}
    </div>
  );
}

export default function ContactsSection({ contacts, firms, onContactClick, onAddContact }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedFirms, setExpandedFirms] = useState({});

  const toggleGroup = (type) =>
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }));

  const toggleFirm = (firmId) =>
    setExpandedFirms((prev) => ({ ...prev, [firmId]: !prev[firmId] }));

  // Build firmId -> firm map
  const firmMap = Object.fromEntries(firms.map((f) => [f.id, f]));

  // Group contacts: by firm type → by firm → sorted by last name
  const grouped = FIRM_TYPES.reduce((acc, groupType) => {
    // Firms of this type, sorted by name
    const groupFirms = firms
      .filter((f) => {
        const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
        return types.includes(groupType);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const firmGroups = groupFirms
      .map((firm) => ({
        firm,
        contacts: contacts
          .filter((c) => (c.firm_ids || []).includes(firm.id))
          .sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "")),
      }))
      .filter((g) => g.contacts.length > 0);

    if (firmGroups.length > 0) acc[groupType] = firmGroups;
    return acc;
  }, {});

  // Contacts not associated with any firm
  const unassignedContacts = contacts
    .filter((c) => !c.firm_ids?.length)
    .sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));

  const totalContacts = contacts.length;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 group"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          )}
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Contacts
          </span>
          <span className="text-xs text-gray-400 font-normal">({totalContacts})</span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-pink-600 hover:text-pink-700 hover:bg-pink-50 gap-1 text-xs"
          onClick={onAddContact}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Contact
        </Button>
      </div>

      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100 space-y-4">
          {FIRM_TYPES.map((groupType) => {
            const firmGroups = grouped[groupType];
            if (!firmGroups) return null;
            const isGroupExpanded = expandedGroups[groupType] !== false; // default open
            const colorClass = GROUP_COLORS[groupType];

            return (
              <div key={groupType}>
                {/* Group type header */}
                <button
                  onClick={() => toggleGroup(groupType)}
                  className="flex items-center gap-2 w-full mb-2 group cursor-pointer"
                >
                  <div className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${colorClass}`}>
                    {groupType}
                  </div>
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-xs text-gray-400 font-medium">
                    {firmGroups.reduce((sum, g) => sum + g.contacts.length, 0)}
                  </span>
                  {isGroupExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isGroupExpanded && (
                  <div className="space-y-3 pl-1">
                    {firmGroups.map(({ firm, contacts: firmContacts }) => {
                       const isFirmExpanded = expandedFirms[firm.id] !== false; // default open
                       return (
                       <div key={firm.id}>
                         {/* Firm sub-header */}
                         <button
                           onClick={() => toggleFirm(firm.id)}
                           className="w-full flex items-center gap-2 mb-1.5 group cursor-pointer"
                         >
                           {firm.logo_url ? (
                             <img src={firm.logo_url} alt={firm.name} className="w-4 h-4 object-contain rounded" />
                           ) : null}
                           <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide group-hover:text-gray-700">
                             {firm.name}
                           </span>
                           <div className="h-px flex-1 bg-gray-100" />
                           <span className="text-xs text-gray-400">{firmContacts.length}</span>
                           {isFirmExpanded ? (
                             <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                           ) : (
                             <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                           )}
                         </button>
                         {/* Contacts list */}
                         {isFirmExpanded && (
                         <div className="space-y-1">
                           {firmContacts.map((contact) => (
                             <button
                               key={contact.id}
                               onClick={() => onContactClick(contact)}
                               className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-pink-50 hover:border-pink-200 transition-colors flex items-center gap-2.5 group"
                             >
                               <ContactAvatar contact={contact} />
                               <span className="text-sm text-gray-800 group-hover:text-pink-700 font-medium truncate">
                                 {[contact.first_name, contact.last_name].filter(Boolean).join(" ")}
                               </span>
                               {contact.title && (
                                 <span className="ml-auto text-xs text-gray-400 flex-shrink-0 truncate max-w-[160px]">
                                   {contact.title}
                                 </span>
                               )}
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

          {/* Unassigned contacts */}
          {unassignedContacts.length > 0 && (
            <div>
              <button
                onClick={() => toggleGroup("__unassigned__")}
                className="flex items-center gap-2 w-full mb-2 group cursor-pointer"
              >
                <div className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider bg-gray-100 text-gray-500">
                  No Firm
                </div>
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium">{unassignedContacts.length}</span>
                {expandedGroups["__unassigned__"] !== false ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {expandedGroups["__unassigned__"] !== false && (
                <div className="space-y-1 pl-1">
                  {unassignedContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => onContactClick(contact)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-pink-50 hover:border-pink-200 transition-colors flex items-center gap-2.5 group"
                    >
                      <ContactAvatar contact={contact} />
                      <span className="text-sm text-gray-800 group-hover:text-pink-700 font-medium truncate">
                        {[contact.first_name, contact.last_name].filter(Boolean).join(" ")}
                      </span>
                      {contact.title && (
                        <span className="ml-auto text-xs text-gray-400 flex-shrink-0 truncate max-w-[160px]">
                          {contact.title}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {totalContacts === 0 && (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              No contacts yet. Click "Add Contact" to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}