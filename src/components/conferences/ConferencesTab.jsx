import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth,
  addMonths, subMonths, isBefore, isAfter, parseISO,
} from "date-fns";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, MapPin, DollarSign, ExternalLink, Building2, Tag,
  Loader2, LayoutList, CalendarDays as CalIcon, Award, ClipboardCheck,
  UserX,
} from "lucide-react";
import ConferenceFeesChart from "@/components/conferences/ConferenceFeesChart";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PARTICP_COLORS = {
  Sponsoring: "bg-amber-100 text-amber-800 border-amber-300",
  Attending: "bg-blue-100 text-blue-800 border-blue-300",
  Speaking: "bg-purple-100 text-purple-800 border-purple-300",
  Exhibiting: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Unknown: "bg-gray-100 text-gray-700 border-gray-300",
};

const RSVP_COLORS = {
  "Not Responded": "bg-gray-50 text-gray-600 border-gray-200",
  "Confirmed": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Tentative": "bg-amber-50 text-amber-700 border-amber-200",
  "Declined": "bg-rose-50 text-rose-700 border-rose-200",
};

function fmtCurrency(n) {
  if (n == null || n === "" || isNaN(Number(n))) return "";
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function fmtRange(start, end) {
  if (!start && !end) return "—";
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  return fmtDate(start || end);
}

export default function ConferencesTab() {
  const [view, setView] = useState("list"); // "list" | "calendar" | "unassigned"
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const { data: conferences = [], isLoading } = useQuery({
    queryKey: ["all_conferences"],
    queryFn: () => base44.entities.FirmConference.list("conference_date", 5000),
  });

  const sorted = useMemo(() => {
    return [...conferences]
      .filter(c => !c.deleted_at)
      .sort((a, b) => (b.conference_date || "").localeCompare(a.conference_date || ""));
  }, [conferences]);

  const byDate = useMemo(() => {
    const map = new Map();
    sorted.forEach(c => {
      if (!c.conference_date) return;
      const key = c.conference_date.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return map;
  }, [sorted]);

  // Upcoming conferences with no internal attendees assigned — sorted soonest first.
  const unassigned = useMemo(() => {
    return sorted
      .filter(c => (c.conference_date || "") >= todayStr)
      .filter(c => !c.internal_attendee_contact_ids || c.internal_attendee_contact_ids.length === 0)
      .sort((a, b) => (a.conference_date || "").localeCompare(b.conference_date || ""));
  }, [sorted, todayStr]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-gray-500">
          {sorted.length} conference{sorted.length !== 1 ? "s" : ""} across all firms.
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
          <Button
            type="button"
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setView("list")}
          >
            <LayoutList className="w-3.5 h-3.5" />
            List
          </Button>
          <Button
            type="button"
            variant={view === "calendar" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setView("calendar")}
          >
            <CalIcon className="w-3.5 h-3.5" />
            Calendar
          </Button>
        </div>
      </div>

      <ConferenceFeesChart conferences={sorted} />

      {view === "list" ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-10 text-center">
              No conferences yet. Run a conference scrub on a firm to populate this list.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {sorted.map(c => (
                <ConferenceListRow key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between mb-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              ‹
            </Button>
            <h2 className="text-sm font-semibold text-gray-800">{format(currentMonth, "MMMM yyyy")}</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              ›
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-px mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {days.map(day => {
              const key = format(day, "yyyy-MM-dd");
              const dayItems = byDate.get(key) || [];
              const inMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[64px] md:min-h-[80px] rounded-md border p-1 text-left transition-colors ${
                    isSelected ? "border-indigo-400 bg-indigo-50"
                    : inMonth ? "border-gray-100 bg-white hover:bg-gray-50"
                    : "border-gray-50 bg-gray-50/50 text-gray-400"
                  }`}
                >
                  <div className={`text-[10px] font-medium ${inMonth ? "text-gray-600" : "text-gray-300"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {dayItems.slice(0, 3).map(c => {
                      const pColor = PARTICP_COLORS[c.participation_type] || PARTICP_COLORS.Unknown;
                      return (
                        <div key={c.id} className={`text-[9px] leading-tight px-1 py-0.5 rounded border truncate ${pColor}`} title={c.title}>
                          {c.title}
                        </div>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <div className="text-[9px] text-gray-400 px-1">+{dayItems.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">{format(selectedDate, "EEEE, MMM d")}</h3>
              <div className="space-y-2">
                {(byDate.get(format(selectedDate, "yyyy-MM-dd")) || []).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No conferences on this day.</p>
                ) : (
                  (byDate.get(format(selectedDate, "yyyy-MM-dd")) || []).map(c => (
                    <ConferenceListRow key={c.id} c={c} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConferenceListRow({ c }) {
  const pColor = PARTICP_COLORS[c.participation_type] || PARTICP_COLORS.Unknown;
  const rsvp = c.rsvp_status || "Not Responded";
  const rsvpColor = RSVP_COLORS[rsvp] || RSVP_COLORS["Not Responded"];
  const sponsor = c.sponsorship_status || "Not Sponsoring";
  return (
    <div className="p-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${pColor}`}>
              <Tag className="w-2.5 h-2.5" />
              {c.participation_type}
            </span>
            {rsvp !== "Not Responded" && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${rsvpColor}`}>
                <ClipboardCheck className="w-2.5 h-2.5" />
                {rsvp}
              </span>
            )}
            {sponsor !== "Not Sponsoring" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                <Award className="w-2.5 h-2.5" />
                {sponsor}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
              <CalendarDays className="w-3 h-3" />
              {fmtRange(c.conference_date, c.end_date)}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline inline-flex items-center gap-1">
                {c.title}
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </a>
            ) : c.title}
          </p>
          {c.description && (
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{c.description}</p>
          )}
          <div className="flex items-center gap-4 mt-1.5 flex-wrap text-[11px] text-gray-500">
            {c.firm_name && (
              <span className="inline-flex items-center gap-1 text-indigo-500 font-medium">
                <Building2 className="w-3 h-3" /> {c.firm_name}
              </span>
            )}
            {c.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gray-400" /> {c.location}
              </span>
            )}
            {c.fees && (
              <span className="inline-flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-gray-400" /> {c.fees}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}