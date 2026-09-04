import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronRight, User, Camera, Download, Settings2, ClipboardPaste, CheckSquare, Check, SlidersHorizontal } from "lucide-react";
import ViewModeToggle from "@/components/common/ViewModeToggle";
import SectionTypeFilter from "@/components/common/SectionTypeFilter";
import SectionExpandCollapse from "@/components/common/SectionExpandCollapse";
import ContactsSectionFilters, { filterSectionContacts } from "@/components/contacts/ContactsSectionFilters";
import EntityFilterSidebar from "@/components/common/EntityFilterSidebar";
import { contactFilterGroups } from "./contactFilterGroups";
import { useViewMode } from "@/hooks/useViewMode";
import { exportContactsToCSV } from "./exportContactsCsv";
import ContactPipelineKanban from "./ContactPipelineKanban";
import { lazyDialog } from "@/components/common/lazyDialog";
import { toast } from "@/components/ui/use-toast";
import ContactTagChips from "./ContactTagChips";
import ContactsBulkActionsBar from "./ContactsBulkActionsBar";
import BulkTagDialog from "./BulkTagDialog";
import BulkAssignXponanceContactDialog from "@/components/xponance/BulkAssignXponanceContactDialog";
import ContactQuickFilterChips from "./ContactQuickFilterChips";

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

// Sidebar filter config: maps each sidebar filter key to its Contact entity field,
// default value (for scalar fields), and whether the field is an array.
const SIDEBAR_FILTER_CONFIG = {
  contact_status: { field: "contact_status", default: "" },
  engagement_status: { field: "engagement_status", default: "New" },
  decision_role: { field: "decision_role", default: "" },
  influence_level: { field: "influence_level", default: "Undetermined" },
  employee_status: { field: "employee_status", default: "" },
  gender: { field: "gender", default: "Undetermined" },
  veteran_status: { field: "veteran_status", default: "Undetermined" },
  disability_status: { field: "disability_status", default: "Undetermined" },
  salutation: { field: "salutation", default: "" },
  contact_role: { field: "contact_role", default: "" },
  contact_type: { field: "contact_type", isArray: true },
  contact_roles: { field: "contact_roles", isArray: true },
  contact_firm_roles: { field: "contact_firm_roles", isArray: true },
  investment_team_roles: { field: "investment_team_roles", isArray: true },
  tags: { field: "tags", isArray: true },
  ethnicity: { field: "ethnicity", isArray: true },
  pipeline_stage: { field: "pipeline_stage", default: "" },
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
  const [kanbanFirmType, setKanbanFirmType] = useState("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkXponanceOpen, setBulkXponanceOpen] = useState(false);
  const [bulkXponanceBusy, setBulkXponanceBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filterValues, setFilterValues] = useState(() => {
    const init = {};
    Object.keys(SIDEBAR_FILTER_CONFIG).forEach((k) => { init[k] = new Set(); });
    return init;
  });
  const handleFilterChange = (key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }));
  // Toggle a single value within a Set-based filter (used by the quick filter chips).
  const handleChipToggle = (key, value) =>
    setFilterValues((prev) => {
      const next = { ...prev };
      const s = new Set(prev[key] || []);
      if (s.has(value)) s.delete(value); else s.add(value);
      next[key] = s;
      return next;
    });
  const clearAllSidebarFilters = () => setFilterValues(() => {
    const init = {};
    Object.keys(SIDEBAR_FILTER_CONFIG).forEach((k) => { init[k] = new Set(); });
    return init;
  });
  const hasActiveSidebarFilters = Object.values(filterValues).some((s) => s && s.size > 0);
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

  // Per-firm-type pipeline: resolve a contact's firm types from its linked firms.
  const contactFirmTypes = useMemo(() => {
    const byId = new Map((firms || []).map((f) => [f.id, f]));
    return (c) => {
      const types = new Set();
      for (const fid of c.firm_ids || []) {
        const f = byId.get(fid);
        if (!f) continue;
        (f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : []).forEach((t) => types.add(t));
      }
      return [...types];
    };
  }, [firms]);

  // Stages shown on the Kanban: "all" → shared (no firm_type); a specific firm type → that type's stages.
  const kanbanStages = useMemo(() => {
    if (kanbanFirmType === "all") return pipelineStages.filter((s) => !s.firm_type);
    return pipelineStages.filter((s) => (s.firm_type || "") === kanbanFirmType);
  }, [pipelineStages, kanbanFirmType]);

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

  const toggleSelectMode = () => {
    setSelectMode((v) => {
      if (v) setSelectedIds(new Set());
      return !v;
    });
  };
  const toggleSelectContact = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false); };

  const handleBulkApplyTags = async (tagsToAdd) => {
    if (!tagsToAdd.length || selectedIds.size === 0) { setBulkTagOpen(false); return; }
    setBulkBusy("tag");
    try {
      const ids = Array.from(selectedIds);
      const updates = ids.map((id) => {
        const c = contacts.find((x) => x.id === id);
        const existing = c?.tags || [];
        const merged = Array.from(new Set([...existing, ...tagsToAdd]));
        return { id, tags: merged };
      });
      await base44.entities.Contact.bulkUpdate(updates);
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: `✅ Tags added to ${ids.length} contact${ids.length === 1 ? "" : "s"}` });
      setBulkTagOpen(false);
      clearSelection();
    } catch (err) {
      toast({ title: "Bulk tag failed", description: err?.message || "Could not update tags.", variant: "destructive" });
    } finally {
      setBulkBusy(null);
    }
  };

  const handleBulkSetActive = async (status) => {
    setBulkBusy(status === "Active" ? "active" : "inactive");
    try {
      const ids = Array.from(selectedIds);
      await base44.entities.Contact.bulkUpdate(ids.map((id) => ({ id, contact_status: status })));
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: `✅ ${ids.length} contact${ids.length === 1 ? "" : "s"} set ${status}` });
      clearSelection();
    } catch (err) {
      toast({ title: "Update failed", description: err?.message, variant: "destructive" });
    } finally {
      setBulkBusy(null);
    }
  };

  const handleBulkAssignXponance = async ({ contact_id, contact_name, role }) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkXponanceBusy(true);
    setBulkBusy("xponance");
    try {
      const idField = role === "primary" ? "primary_xponance_contact_id" : "secondary_xponance_contact_id";
      const nameField = role === "primary" ? "primary_xponance_contact_name" : "secondary_xponance_contact_name";
      await base44.entities.Contact.bulkUpdate(ids.map((id) => ({ id, [idField]: contact_id, [nameField]: contact_name })));
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: `✅ ${contact_name} assigned as ${role} for ${ids.length} contact${ids.length === 1 ? "" : "s"}` });
      setBulkXponanceOpen(false);
      clearSelection();
    } catch (err) {
      toast({ title: "Bulk assign failed", description: err?.message, variant: "destructive" });
    } finally {
      setBulkXponanceBusy(false);
      setBulkBusy(null);
    }
  };

  const handleBulkDelete = async () => {
    setBulkBusy("delete");
    try {
      const ids = Array.from(selectedIds);
      const now = new Date().toISOString();
      await base44.entities.Contact.bulkUpdate(ids.map((id) => ({ id, deleted_at: now })));
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      await queryClient.invalidateQueries({ queryKey: ["deletedContacts"] });
      toast({ title: `✅ ${ids.length} contact${ids.length === 1 ? "" : "s"} deleted` });
      clearSelection();
    } catch (err) {
      toast({ title: "Delete failed", description: err?.message, variant: "destructive" });
    } finally {
      setBulkBusy(null);
    }
  };

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
    let result = hasFilters
      ? filterSectionContacts(contacts, filterText, filterSelected, firmMap, contactProductMap, contactPortfolioMap, filterDateRange)
      : contacts;
    for (const [key, cfg] of Object.entries(SIDEBAR_FILTER_CONFIG)) {
      const sel = filterValues[key];
      if (!sel || sel.size === 0) continue;
      result = result.filter((c) => {
        if (cfg.isArray) {
          const val = c[cfg.field] || [];
          return Array.isArray(val) && val.some((v) => sel.has(v));
        }
        const val = c[cfg.field] ?? cfg.default;
        return sel.has(val);
      });
    }
    return result;
  }, [contacts, hasFilters, filterText, filterSelected, firmMap, contactProductMap, contactPortfolioMap, filterDateRange, filterValues]);

  const sidebarFilterCounts = useMemo(() => {
    const counts = {};
    for (const [key, cfg] of Object.entries(SIDEBAR_FILTER_CONFIG)) {
      const count = {};
      for (const c of contacts) {
        if (c.deleted_at) continue;
        if (cfg.isArray) {
          const val = c[cfg.field] || [];
          (Array.isArray(val) ? val : []).forEach((v) => {
            if (v) count[v] = (count[v] || 0) + 1;
          });
        } else {
          const val = c[cfg.field] ?? cfg.default;
          if (val) count[val] = (count[val] || 0) + 1;
        }
      }
      counts[key] = count;
    }
    return counts;
  }, [contacts]);

  // Build sidebar filter groups with dynamic options computed from loaded contacts
  // (for groups whose options array is empty — e.g. tags, contact_type, pipeline_stage).
  const sidebarGroups = useMemo(() => {
    const dynamicKeys = ["contact_type", "contact_roles", "contact_firm_roles", "investment_team_roles", "tags", "pipeline_stage"];
    const dynamicOpts = {};
    for (const key of dynamicKeys) {
      const set = new Set();
      for (const c of contacts) {
        if (c.deleted_at) continue;
        const val = c[key];
        if (Array.isArray(val)) val.forEach((v) => v && set.add(v));
        else if (val) set.add(val);
      }
      dynamicOpts[key] = Array.from(set).sort().map((v) => ({ value: v, label: v }));
    }
    return contactFilterGroups.map((g) =>
      g.options && g.options.length === 0 && dynamicOpts[g.key]
        ? { ...g, options: dynamicOpts[g.key] }
        : g
    );
  }, [contacts]);

  // Contacts shown on the Kanban: "all" → everyone; a specific firm type → only contacts of that firm type.
  const kanbanContacts = useMemo(() => {
    if (kanbanFirmType === "all") return filteredContacts;
    return filteredContacts.filter((c) => contactFirmTypes(c).includes(kanbanFirmType));
  }, [filteredContacts, kanbanFirmType, contactFirmTypes]);

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
    const isSel = selectedIds.has(contact.id);
    return (
      <button
        onClick={() => selectMode ? toggleSelectContact(contact.id) : onContactClick(contact)}
        className={`text-left p-3 rounded-xl border transition-colors w-full ${selectMode ? (isSel ? "border-pink-400 bg-pink-50" : "border-gray-100 bg-white hover:bg-pink-50") : "border-gray-100 bg-white hover:bg-pink-50 hover:border-pink-200"}`}
      >
        <div className="flex items-center gap-2.5 mb-1">
          {selectMode && (
            <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSel ? "bg-pink-600 border-pink-600" : "border-gray-300 bg-white"}`}>
              {isSel && <Check className="w-3 h-3 text-white" />}
            </span>
          )}
          <ContactAvatar contact={contact} />
          <span className="text-sm font-medium text-gray-800 truncate">{formatContactName(contact)}</span>
          {contact.contact_status === "Active" ? (
            <span className="ml-auto w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Active" />
          ) : contact.contact_status === "Inactive" ? (
            <span className="ml-auto w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Inactive" />
          ) : null}
        </div>
        {contact.title && <p className="text-xs text-gray-400 truncate pl-8">{contact.title}</p>}
        <div className="pl-8 pt-1"><ContactTagChips tags={contact.tags} max={4} /></div>
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
          <Button
            variant={selectMode ? "default" : "ghost"}
            size="sm"
            className={`h-7 px-2 gap-1 text-xs ${selectMode ? "bg-pink-600 text-white hover:bg-pink-700" : "text-gray-600 hover:text-gray-700 hover:bg-gray-100"}`}
            onClick={toggleSelectMode}
            title="Select multiple contacts for bulk actions"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {selectMode ? "Done" : "Select"}
          </Button>
          <ViewModeToggle value={viewMode} onChange={(m) => { setViewMode(m); setExpanded(true); }} />
          {viewMode === "kanban" && (
            <>
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
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400">Pipeline:</span>
                <select
                  value={kanbanFirmType}
                  onChange={(e) => setKanbanFirmType(e.target.value)}
                  className="h-7 text-xs rounded-md border border-gray-200 bg-white px-2 outline-none focus:border-indigo-400"
                >
                  <option value="all">All (general)</option>
                  {FIRM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </>
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
          {selectMode && selectedIds.size > 0 && (
            <ContactsBulkActionsBar
              selectedCount={selectedIds.size}
              onClear={clearSelection}
              onSetActive={() => handleBulkSetActive("Active")}
              onSetInactive={() => handleBulkSetActive("Inactive")}
              onTag={() => setBulkTagOpen(true)}
              onDelete={handleBulkDelete}
              busy={bulkBusy}
            />
          )}
          {selectMode && (
            <div className="text-xs text-gray-500 px-1">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected — tap contacts to add or remove them.`
                : "Tap contacts to select them for bulk actions."}
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-3">
            {showFilters && (
              <div className="w-full md:w-56 flex-shrink-0">
                <EntityFilterSidebar
                  sectionKey="contacts"
                  groups={sidebarGroups}
                  values={filterValues}
                  onChange={handleFilterChange}
                  counts={sidebarFilterCounts}
                  onClearAll={clearAllSidebarFilters}
                  hasActiveFilters={hasActiveSidebarFilters}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <ContactQuickFilterChips
                contacts={contacts}
                values={filterValues}
                onChange={handleChipToggle}
              />
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 gap-1 text-xs ${showFilters ? "text-pink-700 bg-pink-50" : "text-gray-500 hover:text-pink-700 hover:bg-pink-50"}`}
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {showFilters ? "Hide Filters" : "Filters"}
                </Button>
                {viewMode === "list" && (
                  <SectionTypeFilter
                    label="Filter by type"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={FIRM_TYPES}
                  />
                )}
                {viewMode === "list" && (
                  <SectionExpandCollapse onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} />
                )}
              </div>
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
                           {firmContacts.map((contact) => {
                             const isSel = selectedIds.has(contact.id);
                             return (
                             <button
                               key={contact.id}
                               onClick={() => selectMode ? toggleSelectContact(contact.id) : onContactClick(contact)}
                               className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-2.5 group ${selectMode ? (isSel ? "border-pink-400 bg-pink-50" : "border-gray-100 bg-white hover:bg-pink-50") : "border-gray-100 bg-white hover:bg-pink-50 hover:border-pink-200"}`}
                             >
                               {selectMode && (
                                 <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSel ? "bg-pink-600 border-pink-600" : "border-gray-300 bg-white"}`}>
                                   {isSel && <Check className="w-3 h-3 text-white" />}
                                 </span>
                               )}
                               <ContactAvatar contact={contact} />
                               <div className="min-w-0 flex-1">
                                 <span className="text-sm text-gray-800 group-hover:text-pink-700 font-medium truncate block">
                                   {formatContactName(contact)}
                                 </span>
                                 <ContactTagChips tags={contact.tags} max={3} />
                               </div>
                               {contact.title && (
                                 <span className="ml-auto text-xs text-gray-400 flex-shrink-0 truncate max-w-[160px]">
                                   {contact.title}
                                 </span>
                               )}
                             </button>
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
                  {unassignedContacts.map((contact) => {
                    const isSel = selectedIds.has(contact.id);
                    return (
                    <button
                      key={contact.id}
                      onClick={() => selectMode ? toggleSelectContact(contact.id) : onContactClick(contact)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center gap-2.5 group ${selectMode ? (isSel ? "border-pink-400 bg-pink-50" : "border-gray-100 bg-white hover:bg-pink-50") : "border-gray-100 bg-white hover:bg-pink-50 hover:border-pink-200"}`}
                    >
                      {selectMode && (
                        <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSel ? "bg-pink-600 border-pink-600" : "border-gray-300 bg-white"}`}>
                          {isSel && <Check className="w-3 h-3 text-white" />}
                        </span>
                      )}
                      <ContactAvatar contact={contact} />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-gray-800 group-hover:text-pink-700 font-medium truncate block">
                          {formatContactName(contact)}
                        </span>
                        <ContactTagChips tags={contact.tags} max={3} />
                      </div>
                      {contact.title && (
                        <span className="ml-auto text-xs text-gray-400 flex-shrink-0 truncate max-w-[160px]">
                          {contact.title}
                        </span>
                      )}
                    </button>
                    );
                  })}
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
              contacts={kanbanContacts}
              stages={kanbanStages}
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
          </div>
        </div>
      )}

      <ContactPipelineStageEditor open={stageEditorOpen} onOpenChange={setStageEditorOpen} defaultFirmType={kanbanFirmType === "all" ? "" : kanbanFirmType} />
      <BulkTagDialog open={bulkTagOpen} onOpenChange={setBulkTagOpen} selectedCount={selectedIds.size} onApply={handleBulkApplyTags} />
    </div>
  );
}