import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Search, X, Calendar, ChevronRight, ChevronDown, Tag, Building2, User, GitBranch, ClipboardList, List, Layers,
  Phone, Mail, Users, FileText, MoreHorizontal,
} from "lucide-react";
import { format } from "date-fns";
import SearchableSelect from "@/components/common/SearchableSelect";

const ACTIVITY_TYPE_COLORS = {
  Call: "bg-blue-50 text-blue-700 border-blue-200",
  Email: "bg-purple-50 text-purple-700 border-purple-200",
  Meeting: "bg-green-50 text-green-700 border-green-200",
  Note: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Other: "bg-gray-50 text-gray-600 border-gray-200",
};

const STAGE_COLORS = {
  Prospecting: "bg-slate-100 text-slate-700 border-slate-200",
  "Initial Contact": "bg-sky-50 text-sky-700 border-sky-200",
  "Due Diligence": "bg-amber-50 text-amber-700 border-amber-200",
  "Final Review": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const GROUP_MODES = [
  { key: "all", label: "All", icon: List },
  { key: "firm", label: "By Firm", icon: Building2 },
  { key: "contact", label: "By Contact", icon: User },
];

// Quick-toggle type filter pills — click to filter to a single type, click
// again to clear. Each pill shows a live count of that type in the current data.
const TYPE_FILTERS = [
  { key: "Meeting", label: "Meetings", icon: Users, color: "green" },
  { key: "Call", label: "Calls", icon: Phone, color: "blue" },
  { key: "Email", label: "Emails", icon: Mail, color: "purple" },
  { key: "Note", label: "Notes", icon: FileText, color: "yellow" },
  { key: "Other", label: "Other", icon: MoreHorizontal, color: "gray" },
];

const TYPE_PILL_STYLES = {
  green: { active: "bg-green-600 text-white border-green-600", idle: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
  blue: { active: "bg-blue-600 text-white border-blue-600", idle: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
  purple: { active: "bg-purple-600 text-white border-purple-600", idle: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" },
  yellow: { active: "bg-yellow-500 text-white border-yellow-500", idle: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100" },
  gray: { active: "bg-gray-600 text-white border-gray-600", idle: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100" },
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

// Centralized activity timeline — every firm/contact interaction in one view,
// filterable by team member (who logged it) and the engagement stage of the
// associated contact. Switch between a flat chronological list, grouping by
// firm, or grouping by contact.
export default function ActivityTimeline({ onActivityClick, hideHeader = false }) {
  const [search, setSearch] = useState("");
  const [teamMember, setTeamMember] = useState("");
  const [stage, setStage] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [groupBy, setGroupBy] = useState("all");
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["all_contact_activities_timeline"],
    queryFn: () => base44.entities.ContactActivity.list("-activity_date", 5000),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });
  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["contact_pipeline_stages"],
    queryFn: () => base44.entities.ContactPipelineStage.list("-order", 100),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users_timeline"],
    queryFn: async () => { try { return await base44.entities.User.list(); } catch { return []; } },
  });

  const contactMap = useMemo(() => {
    const m = {}; contacts.forEach(c => { m[c.id] = c; }); return m;
  }, [contacts]);
  const firmMap = useMemo(() => {
    const m = {}; firms.forEach(f => { m[f.id] = f; }); return m;
  }, [firms]);
  const userMap = useMemo(() => {
    const m = {}; users.forEach(u => { m[u.id] = u; }); return m;
  }, [users]);

  const teamMemberOptions = useMemo(() => {
    const ids = [...new Set(activities.map(a => a.created_by_id).filter(Boolean))];
    const opts = ids.map(id => ({
      value: id,
      label: userMap[id]?.full_name || userMap[id]?.email || "Unknown",
    })).sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "", label: "All team members" }, ...opts];
  }, [activities, userMap]);

  const stageOptions = useMemo(() => {
    const opts = stages.map(s => ({ value: s.name, label: s.name }));
    return [{ value: "", label: "All stages" }, ...opts];
  }, [stages]);

  // Resolve the primary firm name for an activity (contact's primary firm, then
  // any associated firm, else "Unassigned")
  const firmNameFor = useMemo(() => {
    return (a) => {
      const contact = contactMap[a.contact_id];
      const firmId = contact?.firm_ids?.[0];
      if (firmId && firmMap[firmId]) return firmMap[firmId].name;
      const assoc = a.associated_firms_contacts?.[0];
      if (assoc?.firm_name) return assoc.firm_name;
      return "Unassigned";
    };
  }, [contactMap, firmMap]);

  const contactNameFor = useMemo(() => {
    return (a) => {
      const contact = contactMap[a.contact_id];
      return contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : "Unknown Contact";
    };
  }, [contactMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter(a => {
      const contact = contactMap[a.contact_id];
      if (teamMember && a.created_by_id !== teamMember) return false;
      if (stage && (contact?.pipeline_stage || "") !== stage) return false;
      if (typeFilter && a.activity_type !== typeFilter) return false;
      if (q) {
        const contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : "";
        const firmNames = (a.associated_firms_contacts || []).map(e => e.firm_name || "").join(" ");
        const haystack = [a.subject, a.notes, a.activity_type, contactName, firmNames].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [activities, search, teamMember, stage, typeFilter, contactMap]);

  // Build groups based on the selected grouping mode.
  // - "all": one group per date (chronological timeline)
  // - "firm": one group per firm name
  // - "contact": one group per contact name
  const grouped = useMemo(() => {
    const byDate = () => {
      const map = new Map();
      filtered.forEach(a => {
        const key = a.activity_date || "—";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(a);
      });
      return Array.from(map.entries())
        .map(([key, items]) => ({ key, label: fmt(key), items }))
        .sort((a, b) => (b.key || "").localeCompare(a.key || ""));
    };

    const byEntity = (nameFn, fallbackLabel) => {
      const map = new Map();
      filtered.forEach(a => {
        const key = nameFn(a) || fallbackLabel;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(a);
      });
      return Array.from(map.entries())
        .map(([key, items]) => ({
          key,
          label: key,
          items: items.sort((x, y) => (y.activity_date || "").localeCompare(x.activity_date || "")),
        }))
        .sort((a, b) => {
          // Most recently-active group first
          const aMax = a.items[0]?.activity_date || "";
          const bMax = b.items[0]?.activity_date || "";
          return bMax.localeCompare(aMax);
        });
    };

    if (groupBy === "firm") return byEntity(firmNameFor, "Unassigned");
    if (groupBy === "contact") return byEntity(contactNameFor, "Unknown Contact");
    return byDate();
  }, [filtered, groupBy, firmNameFor, contactNameFor]);

  const hasFilters = search || teamMember || stage || typeFilter;
  const clearFilters = () => { setSearch(""); setTeamMember(""); setStage(""); setTypeFilter(""); };

  // Live counts per activity type (from the full dataset, before type filtering,
  // so the pills always show the true total available for each type).
  const typeCounts = useMemo(() => {
    const counts = {};
    activities.forEach(a => {
      const t = a.activity_type || "Other";
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [activities]);
  const toggleGroup = (key) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const renderActivity = (activity) => {
    const contact = contactMap[activity.contact_id];
    const contactName = contactNameFor(activity);
    const colorClass = ACTIVITY_TYPE_COLORS[activity.activity_type] || ACTIVITY_TYPE_COLORS.Other;
    const contactStage = contact?.pipeline_stage;
    const stageColor = STAGE_COLORS[contactStage] || "bg-gray-50 text-gray-600 border-gray-200";
    const loggedBy = activity.created_by_id ? (userMap[activity.created_by_id]?.full_name || userMap[activity.created_by_id]?.email) : null;
    const assocFirms = (activity.associated_firms_contacts || []).map(e => e.firm_name).filter(Boolean);

    return (
      <button
        key={activity.id}
        type="button"
        onClick={() => onActivityClick?.(activity)}
        className="w-full text-left rounded-xl border border-gray-100 bg-white hover:border-amber-200 hover:shadow-sm transition-all group relative"
      >
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${colorClass}`}>
              <Tag className="w-2.5 h-2.5" />
              {activity.activity_type}
            </span>
            {contactStage && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${stageColor}`}>
                <GitBranch className="w-2.5 h-2.5" />
                {contactStage}
              </span>
            )}
            {loggedBy && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                <User className="w-2.5 h-2.5" />
                {loggedBy}
              </span>
            )}
            <span className="text-[10px] text-gray-400 ml-auto inline-flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              {fmt(activity.activity_date)}
            </span>
          </div>

          {activity.subject && (
            <p className="text-sm font-semibold text-gray-800 mt-1 group-hover:text-amber-700 line-clamp-2">
              {activity.subject}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3 text-gray-400" />
              {contactName}
            </span>
            {assocFirms.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3 text-gray-400" />
                {assocFirms.join(", ")}
              </span>
            )}
          </div>

          {activity.notes && (
            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{activity.notes}</p>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl w-full flex flex-col border border-gray-100">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-amber-600" />
            Activity Timeline
            <span className="text-xs text-gray-400 font-normal">({filtered.length})</span>
          </h2>
        </div>
      )}

      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search subject, notes, contact, or firm..."
            className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 outline-none focus:border-amber-400 bg-white"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Quick-toggle type filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map(tf => {
            const Icon = tf.icon;
            const active = typeFilter === tf.key;
            const count = typeCounts[tf.key] || 0;
            const styles = TYPE_PILL_STYLES[tf.color];
            return (
              <button
                key={tf.key}
                type="button"
                onClick={() => setTypeFilter(active ? "" : tf.key)}
                className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium border transition-colors ${
                  active ? styles.active : styles.idle
                } ${count === 0 && !active ? "opacity-40" : ""}`}
              >
                <Icon className="w-3 h-3" />
                {tf.label}
                {count > 0 && <span className={`text-[10px] ${active ? "text-white/80" : "text-gray-400"}`}>({count})</span>}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SearchableSelect
            value={teamMember}
            onChange={setTeamMember}
            options={teamMemberOptions}
            placeholder="All team members"
            searchPlaceholder="Search team members..."
            emptyText="No team members found."
          />
          <SearchableSelect
            value={stage}
            onChange={setStage}
            options={stageOptions}
            placeholder="All engagement stages"
            searchPlaceholder="Search stages..."
            emptyText="No stages found."
          />
        </div>

        {/* Grouping toggle + filter summary */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
            {GROUP_MODES.map(mode => {
              const Icon = mode.icon;
              const active = groupBy === mode.key;
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setGroupBy(mode.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-colors ${
                    active ? "bg-amber-600 text-white" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="text-[11px] text-rose-500 hover:text-rose-700 font-medium">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4 max-h-[70vh]">
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <ClipboardList className="w-6 h-6 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">
              {hasFilters ? "No interactions match your filters" : "No interactions logged yet"}
            </p>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="text-xs text-rose-500 hover:text-rose-700 mt-1 font-medium">
                Clear filters
              </button>
            )}
          </div>
        ) : groupBy === "all" ? (
          /* Flat chronological timeline with date separators */
          <div className="relative">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-200" />
            {grouped.map(group => (
              <div key={group.key} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-sm flex-shrink-0" />
                  <span className="text-xs font-bold text-gray-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    {group.label}
                  </span>
                  <span className="text-[10px] text-gray-400">{group.items.length} interaction{group.items.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="ml-5 space-y-2">
                  {group.items.map(activity => (
                    <div key={activity.id} className="relative">
                      <div className="absolute -left-[14px] top-4 w-2 h-2 rounded-full bg-gray-300 hover:bg-amber-500 transition-colors" />
                      {renderActivity(activity)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grouped by firm or contact — collapsible sections */
          <div className="space-y-2">
            {grouped.map(group => {
              const isCollapsed = collapsedGroups[group.key];
              const Icon = groupBy === "firm" ? Building2 : User;
              return (
                <div key={group.key} className="rounded-xl border border-gray-100 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors bg-gray-50/60"
                  >
                    {isCollapsed
                      ? <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    }
                    <Icon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-700 truncate">{group.label}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{group.items.length}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="p-2 space-y-2">
                      {group.items.map(activity => renderActivity(activity))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}