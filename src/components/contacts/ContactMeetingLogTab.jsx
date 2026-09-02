import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, MapPin, CalendarClock, Building2, Video, User as UserIcon, Inbox, FileDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { exportContactMeetingLogPdf } from "./contactMeetingLogPdf";

const STATUS_STYLE = {
  Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  "In-Progress": "bg-amber-100 text-amber-700 border-amber-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  "No-show": "bg-red-100 text-red-700 border-red-200",
};

// Unified row for a meeting activity
function MeetingRow({ activity, firmName }) {
  const date = activity.activity_date ? new Date(activity.activity_date + "T00:00:00") : null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-50">
        <Users className="w-4 h-4 text-purple-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-800">Meeting</span>
          {activity.subject && <span className="text-xs text-gray-600 truncate">· {activity.subject}</span>}
          <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full">Activity</span>
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
          {date && <span>{format(date, "MMM d, yyyy")}</span>}
          {firmName && <span className="flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" /> {firmName}</span>}
        </div>
        {activity.notes && <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{activity.notes}</p>}
      </div>
    </div>
  );
}

// Unified row for an onsite visit
function VisitRow({ visit, role }) {
  const dateStr = visit.actual_visit_date || visit.target_visit_date;
  const date = dateStr ? new Date(dateStr + "T00:00:00") : null;
  const statusClass = STATUS_STYLE[visit.status] || "bg-gray-100 text-gray-500 border-gray-200";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-teal-50">
        {visit.onsite_type === "Virtual" ? <Video className="w-4 h-4 text-teal-500" /> : <MapPin className="w-4 h-4 text-teal-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-800">Onsite Visit</span>
          <span className="text-[10px] bg-teal-50 text-teal-600 border border-teal-200 px-1.5 py-0.5 rounded-full">{visit.onsite_type || "In-person"}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusClass}`}>{visit.status || "Scheduled"}</span>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            {role === "analyst" ? <><UserIcon className="w-2.5 h-2.5" /> Visiting Analyst</> : <><Building2 className="w-2.5 h-2.5" /> Host Firm</>}
          </span>
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
          {date && <span>{format(date, "MMM d, yyyy")}</span>}
          {visit.firm_name && <span className="flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" /> {visit.firm_name}</span>}
          {visit.visiting_analyst_name && role === "host" && <span className="flex items-center gap-0.5"><UserIcon className="w-2.5 h-2.5" /> {visit.visiting_analyst_name}</span>}
        </div>
        {visit.notes && <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 quill-preview" dangerouslySetInnerHTML={{ __html: visit.notes }} />}
      </div>
    </div>
  );
}

export default function ContactMeetingLogTab({ contactId, contactName, firmIds }) {
  // Meetings: ContactActivity records of type "Meeting" for this contact
  const { data: meetings = [], isLoading: loadingMeetings } = useQuery({
    queryKey: ["contact_meetings", contactId],
    queryFn: () => base44.entities.ContactActivity.filter({ contact_id: contactId, activity_type: "Meeting" }, "-activity_date"),
    enabled: !!contactId,
  });

  // Onsite visits where this contact is the visiting analyst
  const { data: analystVisits = [], isLoading: loadingAnalystVisits } = useQuery({
    queryKey: ["contact_analyst_visits", contactId],
    queryFn: () => base44.entities.OnsiteVisit.filter({ visiting_analyst_contact_id: contactId }, "-target_visit_date"),
    enabled: !!contactId,
  });

  // Onsite visits to firms this contact belongs to (they're the host contact being visited)
  const firmIdList = firmIds || [];
  const { data: hostVisits = [], isLoading: loadingHostVisits } = useQuery({
    queryKey: ["contact_host_visits", contactId, firmIdList.join(",")],
    queryFn: async () => {
      if (!firmIdList.length) return [];
      // Fetch visits for each firm and flatten; tag with role
      const results = await Promise.all(
        firmIdList.map((fid) => base44.entities.OnsiteVisit.filter({ firm_id: fid }, "-target_visit_date"))
      );
      const all = [];
      results.forEach((visits) => {
        visits.forEach((v) => {
          // Skip ones already captured as analyst visits
          if (v.visiting_analyst_contact_id === contactId) return;
          all.push(v);
        });
      });
      // Dedupe by id in case the contact belongs to multiple firms
      const seen = new Set();
      return all.filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));
    },
    enabled: !!contactId && firmIdList.length > 0,
  });

  // Firms lookup for meeting rows
  const { data: allFirms = [] } = useQuery({
    queryKey: ["all_firms_for_meeting_log"],
    queryFn: () => base44.entities.Firm.list(),
  });

  const firmNameById = useMemo(() => {
    const map = {};
    allFirms.forEach((f) => { map[f.id] = f.name; });
    return map;
  }, [allFirms]);

  // Merge into a unified, date-sorted timeline
  const timeline = useMemo(() => {
    const items = [];
    meetings.forEach((m) => {
      const fid = (m.associated_firms_contacts?.[0]?.firm_id) || "";
      items.push({
        key: `m-${m.id}`,
        sortDate: m.activity_date || "",
        type: "meeting",
        activity: m,
        firmName: fid ? (firmNameById[fid] || m.associated_firms_contacts?.[0]?.firm_name || "") : (m.associated_firms_contacts?.[0]?.firm_name || ""),
      });
    });
    analystVisits.forEach((v) => {
      items.push({
        key: `va-${v.id}`,
        sortDate: v.actual_visit_date || v.target_visit_date || "",
        type: "visit",
        visit: v,
        role: "analyst",
      });
    });
    hostVisits.forEach((v) => {
      items.push({
        key: `vh-${v.id}`,
        sortDate: v.actual_visit_date || v.target_visit_date || "",
        type: "visit",
        visit: v,
        role: "host",
      });
    });
    // Sort descending by date
    items.sort((a, b) => (b.sortDate || "").localeCompare(a.sortDate || ""));
    return items;
  }, [meetings, analystVisits, hostVisits, firmNameById]);

  const loading = loadingMeetings || loadingAnalystVisits || loadingHostVisits;

  const meetingCount = meetings.length;
  const visitCount = analystVisits.length + hostVisits.length;

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
        Save the contact first to view meetings and onsite visits.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
          <Users className="w-3.5 h-3.5" /> {meetingCount} Meeting{meetingCount !== 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100">
          <MapPin className="w-3.5 h-3.5" /> {visitCount} Onsite Visit{visitCount !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] text-gray-400 ml-auto flex items-center gap-1">
          <CalendarClock className="w-3 h-3" /> Most recent first
        </span>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={loading || timeline.length === 0}
          onClick={() => exportContactMeetingLogPdf({ contactName, timeline })}
        >
          <FileDown className="w-3.5 h-3.5" /> Export PDF
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading meetings and onsite visits…</div>
      ) : timeline.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center border border-dashed border-gray-200 rounded-xl">
          <Inbox className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-400 italic">No meetings or onsite visits linked to {contactName || "this contact"} yet.</p>
          <p className="text-[11px] text-gray-400">Log a Meeting from the Activities tab, or schedule an Onsite Visit from the firm's Onsite Due Diligence tab.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {timeline.map((item) =>
            item.type === "meeting"
              ? <MeetingRow key={item.key} activity={item.activity} firmName={item.firmName} />
              : <VisitRow key={item.key} visit={item.visit} role={item.role} />
          )}
        </div>
      )}
    </div>
  );
}