import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Search, X, Calendar, ChevronRight, Tag, Building2, User, GitBranch, ClipboardList,
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

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

// Centralized activity timeline — every firm/contact interaction in one
// chronological view, with filters by team member (who logged it) and the
// engagement stage of the associated contact.
export default function ActivityTimeline({ onActivityClick }) {
  const [search, setSearch] = useState("");
  const [teamMember, setTeamMember] = useState("");
  const [stage, setStage] = useState("");

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["all_contact_activities_timeline"],
    queryFn: () => base44.entities.ContactActivity.list("-activity_date", 5000),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter(a => {
      const contact = contactMap[a.contact_id];
      if (teamMember && a.created_by_id !== teamMember) return false;
      if (stage && (contact?.pipeline_stage || "") !== stage) return false;
      if (q) {
        const contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : "";
        const firmNames = (a.associated_firms_contacts || []).map(e => e.firm_name || "").join(" ");
        const haystack = [a.subject, a.notes, a.activity_type, contactName, firmNames].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [activities, search, teamMember, stage, contactMap]);

  // Group by date (desc), then activities within each date (desc)
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(a => {
      const key = a.activity_date || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return Array.from(map.entries()).sort((a, b) => (b[0] || "").localeCompare(a[0] || ""));
  }, [filtered]);

  const hasFilters = search || teamMember || stage;
  const clearFilters = () => { setSearch(""); setTeamMember(""); setStage(""); };

  return (
    <div className="bg-white rounded-2xl w-full flex flex-col border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-amber-600" />
          Activity Timeline
          <span className="text-xs text-gray-400 font-normal">({filtered.length})</span>
        </h2>
      </div>

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
        {hasFilters && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400">{filtered.length} of {activities.length} interactions</span>
            <button type="button" onClick={clearFilters} className="text-[11px] text-rose-500 hover:text-rose-700 font-medium">
              Clear filters
            </button>
          </div>
        )}
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
        ) : (
          <div className="relative">
            {/* Vertical rail */}
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-200" />

            {grouped.map(([date, items]) => (
              <div key={date} className="mb-4">
                {/* Date marker */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-sm flex-shrink-0" />
                  <span className="text-xs font-bold text-gray-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    {fmt(date)}
                  </span>
                  <span className="text-[10px] text-gray-400">{items.length} interaction{items.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Items */}
                <div className="ml-5 space-y-2">
                  {items.map(activity => {
                    const contact = contactMap[activity.contact_id];
                    const contactName = contact
                      ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
                      : "Unknown Contact";
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
                        {/* Rail dot */}
                        <div className="absolute -left-[14px] top-4 w-2 h-2 rounded-full bg-gray-300 group-hover:bg-amber-500 transition-colors" />
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
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}