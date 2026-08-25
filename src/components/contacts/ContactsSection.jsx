import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronRight, User, Camera, Download, Settings2, ClipboardPaste } from "lucide-react";
import ViewModeToggle from "@/components/common/ViewModeToggle";
import SectionTypeFilter from "@/components/common/SectionTypeFilter";
import SectionExpandCollapse from "@/components/common/SectionExpandCollapse";
import ContactsSectionFilters, { filterSectionContacts } from "@/components/contacts/ContactsSectionFilters";
import { useViewMode } from "@/hooks/useViewMode";
import { exportContactsToCSV } from "./exportContactsCsv";
import ContactPipelineKanban from "./ContactPipelineKanban";
import { lazyDialog } from "@/components/common/lazyDialog";
import { toast } from "@/components/ui/use-toast";

const ContactPipelineStageEditor = lazyDialog(() => import("./ContactPipelineStageEditor"));

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const GROUP_COLORS = {
  "Investment Manager": "bg-blue-100 text-blue-700",
  "Allocator": "bg-emerald-100 text-emerald-700",
  "Investment Consultant": "bg-amber-100 text-amber-700",
  "Securities Brokerage": "bg-orange-100 text-orange-700",
  "Trade Organizations": "bg-gray-100 text-gray-700",
};

function formatContactName(c) {
  const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
  return c.designations?.length ? `${name}, ${c.designations.join(", ")}` : name;
}

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

export default function ContactsSection({ contacts, firms, products, portfolios, onContactClick, onAddContact, onPasteContact, onPhotoSearch, onFirmClick, forceExpanded }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedFirms, setExpandedFirms] = useState({});
  const [viewMode, setViewMode] = useViewMode("contacts");
  const [filterText, setFilterText] = useState("");
  const [filterSelected, setFilterSelected] = useState({});
  const [filterDateRange, setFilterDateRange] = useState({ start: "", end: "" });
  const [typeFilter, setTypeFilter] = useState("all");
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: pipelineStages = [] } = useQuery({
    queryKey: ["contact_pipeline_stages"],
    queryFn: () => base44.entities.ContactPipelineStage.list("order", 500),
  });

  const handleMoveContact = (contact, newStage) => {
    base44.entities.Contact.update(contact.id, { pipeline_stage: newStage })
      .then(() => queryClient.invalidateQueries({ queryKey: ["contacts"] }))
      .catch((err) => toast({ title: "Failed to move contact", description: err?.message, variant: "destructive" }));
  };

  const handleToggleFilter = (fieldKey, value) => {
    setFilterSelected((prev) => {
      const next = { ...prev };
      const s = new Set(next[fieldKey] || []);
      if (s.has(value)) s.delete(value); else s.add(value);
      if (s.size === 0) delete next[fieldKey]; else next[fieldKey] = s;
      return next;
    });
  };
  const handleClearFilters = () => { setFilterText(""); setFilterSelected({}); setFilterDateRange({ start: "", end: "" }); };

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const toggleGroup = (type) =>
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }));

  const toggleFirm = (firmId) =>
    setExpandedFirms((prev) => ({ ...prev, [firmId]: !prev[firmId] }));

  const allGroupKeys = [...FIRM_TYPES, "__unassigned__"];
  const allFirmIds = firms.map((f) => f.id);

  const handleExpandAll = () => {
    const groups = {};
    allGroupKeys.forEach((k) => { groups[k] = true; });
    const firmsExpanded = {};
    allFirmIds.forEach((id) => { firmsExpanded[id] = true; });
    setExpandedGroups(groups);
    setExpandedFirms(firmsExpanded);
  };

  const handleCollapseAll = () => {
    const groups = {};
    allGroupKeys.forEach((k) => { groups[k] = false; });
    const firmsExpanded = {};
    allFirmIds.forEach((id) => { firmsExpanded[id] = false; });
    setExpandedGroups(groups);
    setExpandedFirms(firmsExpanded);
  };

  // Build firmId -> firm map
  const firmMap = Object.fromEntries(firms.map((f) => [f.id, f]));

  // Build contactId -> product names reverse map (from product investment_team)
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

  // Build contactId -> portfolio names map via firm associations
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

  const hasFilters = filterText.trim() || Object.keys(filterSelected).length > 0 || filterDateRange.start || filterDateRange.end;
  const filteredContacts = useMemo(() => {
    if (!hasFilters) return contacts;
    return filterSectionContacts(contacts, filterText, filterSelected, firmMap, contactProductMap, contactPortfolioMap, filterDateRange);
  }, [contacts, filterText, filterSelected, firmMap, contactProductMap, contactPortfolioMap, filterDateRange, hasFilters]);

  const visibleFirmTypes = FIRM_TYPES.filter((t) => typeFilter === "all" || t === typeFilter);

  // Group contacts: by firm type → by firm → sorted by last name
  const grouped = visibleFirmTypes.reduce((acc, groupType) => {
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
        contacts: filteredContacts
          .filter((c) => (c.firm_ids || []).includes(firm.id))
          .sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "")),
      }))
      .filter((g) => g.contacts.length > 0);

    if (firmGroups.length > 0) acc[groupType] = firmGroups;
    return acc;
  }, {});

  // Contacts not associated with any firm (only shown when no type filter is active)
  const unassignedContacts = typeFilter === "all" ? filteredContacts
    .filter((c) => !c.firm_ids?.length)
    .sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "")) : [];

  const totalContacts = filteredContacts.length;
  const totalAllContacts = contacts.length;

  const contactColor = (gt) => GROUP_COLORS[gt] || "bg-gray-100 text-gray-700";

  function ContactMiniCard({ contact }) {
    return (
      <button
        onClick={() => onContactClick(contact)}
        className="text-left p-3 rounded-xl border border-gray-100 bg-white hover:bg-pink-50 hover:border-pink-200 transition-colors w-full"
      >
        <div className="flex items-center gap-2.5 mb-1">
          <ContactAvatar contact={contact} />
          <span className="text-sm font-medium text-gray-800 truncate">{formatContactName(contact)}</span>
          {contact.contact_status === "Active" ? (
            <span className="ml-auto w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Active" />
          ) : contact.contact_status === "Inactive" ? (
            <span className="ml-auto w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Inactive" />
          ) : null}
        </div>
        {contact.title && <p className="text-xs text-gray-400 truncate pl-8">{contact.title}</p>}
      </button>
    );
  }

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
          <User className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Contacts
          </span>
          <span className="text-xs text-gray-400 font-normal">({totalAllContacts})</span>
        </button>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={(m) => { setViewMode(m); setExpanded(true); }} />
          {viewMode === "kanban" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 gap-1 text-xs"
              onClick={() => setStageEditorOpen(true)}
              title="Manage pipeline stages"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Stages
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
            onClick={onPhotoSearch}
          >
            <Camera className="w-3.5 h-3.5" />
            Photo ID
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 gap-1 text-xs"
            onClick={() => exportContactsToCSV(filteredContacts, firms)}
            title="Export contacts to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
            onClick={onPasteContact}
            title="Add contact from pasted text or a business card photo"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste / Card
          </Button>
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
      </div>

      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100 space-y-4">
          <ContactsSectionFilters
            contacts={contacts}
            firms={firms}
            products={products}
            portfolios={portfolios}
            text={filterText}
            onTextChange={setFilterText}
            selected={filterSelected}
            onToggle={handleToggleFilter}
            onClear={handleClearFilters}
            dateRange={filterDateRange}
            onDateRangeChange={setFilterDateRange}
          />
          {viewMode === "list" && (
            <div className="flex items-center justify-between mb-2">
              <SectionTypeFilter
                label="Filter by type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={FIRM_TYPES}
              />
              <SectionExpandCollapse onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} />
            </div>
          )}
          {viewMode === "list" && visibleFirmTypes.map((groupType) => {
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
                         <div className="w-full flex items-center gap-2 mb-1.5">
                           {firm.logo_url ? (
                             <img src={firm.logo_url} alt={firm.name} className="w-4 h-4 object-contain rounded flex-shrink-0" />
                           ) : null}
                           <button
                             onClick={() => onFirmClick && onFirmClick(firm)}
                             className="text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-indigo-600 hover:underline cursor-pointer text-left"
                           >
                             {firm.name}
                           </button>
                           <div className="h-px flex-1 bg-gray-100" />
                           <span className="text-xs text-gray-400">{firmContacts.length}</span>
                           <button onClick={() => toggleFirm(firm.id)} className="cursor-pointer">
                             {isFirmExpanded ? (
                               <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                             ) : (
                               <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                             )}
                           </button>
                         </div>
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
                                 {formatContactName(contact)}
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

          {viewMode === "list" && unassignedContacts.length > 0 && (
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
                        {formatContactName(contact)}
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

          {viewMode === "card" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 py-1">
              {filteredContacts
                .slice()
                .sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""))
                .map((contact) => (
                  <ContactMiniCard key={contact.id} contact={contact} />
                ))}
            </div>
          )}

          {viewMode === "kanban" && (
            <ContactPipelineKanban
              contacts={filteredContacts}
              stages={pipelineStages}
              onMoveContact={handleMoveContact}
              onContactClick={onContactClick}
            />
          )}

          {totalContacts === 0 && (
            <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
              {hasFilters ? "No contacts match your filters." : 'No contacts yet. Click "Add Contact" to create one.'}
            </div>
          )}
        </div>
      )}

      <ContactPipelineStageEditor open={stageEditorOpen} onOpenChange={setStageEditorOpen} />
    </div>
  );
}