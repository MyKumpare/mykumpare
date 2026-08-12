import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { X, ClipboardList, Search, ChevronDown, ChevronRight, Building2, Plus, Calendar, Tag } from "lucide-react";
import { format } from "date-fns";

const FIRM_TYPES_ORDER = [
  "Allocator",
  "Investment Consultant",
  "Investment Manager",
  "Manager of Managers",
  "Securities Brokerage",
  "Trade Organizations",
];

const ACTIVITY_TYPE_COLORS = {
  Call: "bg-blue-50 text-blue-700 border-blue-200",
  Email: "bg-purple-50 text-purple-700 border-purple-200",
  Meeting: "bg-green-50 text-green-700 border-green-200",
  Note: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Other: "bg-gray-50 text-gray-600 border-gray-200",
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

export default function ActivityLogPickerModal({ open, onClose, onAddActivity, onActivityClick }) {
  const [search, setSearch] = useState("");
  const [collapsedTypes, setCollapsedTypes] = useState({});
  const [collapsedFirms, setCollapsedFirms] = useState({});
  const [expandedActivities, setExpandedActivities] = useState({});

  const toggleType = (type) => setCollapsedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  const toggleFirm = (key) => setCollapsedFirms(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleActivity = (id) => setExpandedActivities(prev => ({ ...prev, [id]: !prev[id] }));

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["all_contact_activities"],
    queryFn: () => base44.entities.ContactActivity.filter({ deleted_at: { $exists: false } }, "-activity_date"),
    enabled: open,
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(),
    enabled: open,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
    enabled: open,
  });

  const firmMap = useMemo(() => {
    const m = {};
    firms.forEach(f => { m[f.id] = f; });
    return m;
  }, [firms]);

  const contactMap = useMemo(() => {
    const m = {};
    contacts.forEach(c => { m[c.id] = c; });
    return m;
  }, [contacts]);

  const q = search.toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return activities;
    return activities.filter(a => {
      const subject = (a.subject || "").toLowerCase();
      const notes = (a.notes || "").toLowerCase();
      const type = (a.activity_type || "").toLowerCase();
      const contact = contactMap[a.contact_id];
      const contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ").toLowerCase() : "";
      // also search associated firm names
      const assocFirms = (a.associated_firms_contacts || []).map(e => e.firm_name?.toLowerCase() || "").join(" ");
      return subject.includes(q) || notes.includes(q) || type.includes(q) || contactName.includes(q) || assocFirms.includes(q);
    });
  }, [activities, q, contactMap]);

  // Group: firm_type → firm_name → activities (sorted by date desc)
  const grouped = useMemo(() => {
    // Determine firm for each activity via contact → firm_ids
    const result = {};

    filtered.forEach(activity => {
      const contact = contactMap[activity.contact_id];
      if (!contact) return;

      const firmIds = contact.firm_ids || [];
      const primaryFirmId = firmIds[0];
      const firm = primaryFirmId ? firmMap[primaryFirmId] : null;
      const firmName = firm?.name || "Unknown Firm";
      const allFirmTypes = firm?.firm_types?.length ? firm.firm_types : firm?.firm_type ? [firm.firm_type] : ["Other"];
      // If the activity was logged under a specific firm type, only show it under that type
      const firmTypes = activity.firm_type ? [activity.firm_type] : allFirmTypes;

      firmTypes.forEach(type => {
        if (!result[type]) result[type] = {};
        if (!result[type][firmName]) result[type][firmName] = [];
        result[type][firmName].push(activity);
      });
    });

    // Sort activities within each firm by date desc
    Object.values(result).forEach(firmGroups => {
      Object.values(firmGroups).forEach(acts => {
        acts.sort((a, b) => (b.activity_date || "").localeCompare(a.activity_date || ""));
      });
    });

    return result;
  }, [filtered, contactMap, firmMap]);

  const orderedTypes = useMemo(() => {
    const present = Object.keys(grouped);
    const ordered = FIRM_TYPES_ORDER.filter(t => present.includes(t));
    const others = present.filter(t => !FIRM_TYPES_ORDER.includes(t)).sort();
    return [...ordered, ...others];
  }, [grouped]);

  const totalCount = filtered.length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[78vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-600" />
            Activity Log
            <span className="text-xs text-gray-400 font-normal">({totalCount})</span>
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
              placeholder="Search by subject, type, contact, or firm..."
              className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 outline-none focus:border-amber-400 bg-gray-50"
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
          {loadingActivities ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">
              {search ? "No activity logs match your search." : "No activity logs yet."}
            </p>
          ) : (
            <div>
              {orderedTypes.map(type => {
                const firmGroups = grouped[type];
                const isTypeCollapsed = collapsedTypes[type];
                const typeCount = Object.values(firmGroups).reduce((s, a) => s + a.length, 0);

                return (
                  <div key={type}>
                    {/* Firm Type Header */}
                    <button
                      type="button"
                      onClick={() => toggleType(type)}
                      className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      {isTypeCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      }
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">{type}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">{typeCount}</span>
                    </button>

                    {!isTypeCollapsed && (
                      <div className="pb-1">
                        {Object.keys(firmGroups).sort((a, b) => a.localeCompare(b)).map(firmName => {
                          const firmKey = `${type}::${firmName}`;
                          const isFirmCollapsed = collapsedFirms[firmKey];
                          const firmActivities = firmGroups[firmName];

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
                                <Building2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="text-[11px] font-semibold text-gray-500 truncate">{firmName}</span>
                                <span className="text-[10px] text-gray-300 ml-auto">{firmActivities.length}</span>
                              </button>

                              {/* Activities under firm */}
                              {!isFirmCollapsed && (
                                <div className="pl-10 pr-4 pb-1 space-y-1">
                                  {firmActivities.map(activity => {
                                    const contact = contactMap[activity.contact_id];
                                    const contactName = contact
                                      ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
                                      : "Unknown Contact";
                                    const isExpanded = expandedActivities[activity.id];
                                    const colorClass = ACTIVITY_TYPE_COLORS[activity.activity_type] || ACTIVITY_TYPE_COLORS.Other;

                                    return (
                                      <div key={activity.id} className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                                        {/* Clickable row → opens full detail */}
                                        <button
                                          type="button"
                                          onClick={() => { onActivityClick(activity); onClose(); }}
                                          className="w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-amber-50 transition-all group"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${colorClass}`}>
                                                <Tag className="w-2.5 h-2.5" />
                                                {activity.activity_type}
                                              </span>
                                              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                <Calendar className="w-2.5 h-2.5" />
                                                {fmt(activity.activity_date)}
                                              </span>
                                            </div>
                                            {activity.subject && (
                                              <p className="text-xs font-semibold text-gray-800 mt-1 truncate group-hover:text-amber-700">
                                                {activity.subject}
                                              </p>
                                            )}
                                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{contactName}</p>
                                          </div>
                                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-500 flex-shrink-0 mt-1" />
                                        </button>

                                        {/* Preview notes on expand toggle */}
                                        {activity.notes && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); toggleActivity(activity.id); }}
                                              className="w-full flex items-center gap-1 px-3 py-1 text-[10px] text-gray-400 hover:text-amber-600 border-t border-gray-50 hover:bg-amber-50/50 transition-colors"
                                            >
                                              {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                              {isExpanded ? "Hide notes" : "Preview notes"}
                                            </button>
                                            {isExpanded && (
                                              <div className="px-3 pb-2.5">
                                                <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-4">{activity.notes}</p>
                                              </div>
                                            )}
                                          </>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { onAddActivity(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Activity Log
          </button>
        </div>
      </div>
    </div>
  );
}