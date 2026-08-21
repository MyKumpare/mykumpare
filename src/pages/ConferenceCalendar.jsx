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
  ChevronLeft, ChevronRight, CalendarDays, MapPin, DollarSign,
  ExternalLink, Filter, X, Building2, Tag, Loader2, Download, Award,
} from "lucide-react";
import { downloadConferenceTravelPdf } from "@/components/conferences/conferenceTravelPdf";
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

const REG_COLORS = {
  "Not Registered": "bg-gray-50 text-gray-600 border-gray-200",
  "Registered": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Waitlisted": "bg-amber-50 text-amber-700 border-amber-200",
};

const SPONSOR_COLORS = {
  "Not Sponsoring": "bg-gray-50 text-gray-600 border-gray-200",
  "Considering": "bg-amber-50 text-amber-700 border-amber-200",
  "Sponsoring": "bg-emerald-50 text-emerald-700 border-emerald-200",
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

export default function ConferenceCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [firmFilter, setFirmFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: conferences = [], isLoading } = useQuery({
    queryKey: ["all_conferences"],
    queryFn: () => base44.entities.FirmConference.list("conference_date", 5000),
  });

  const firms = useMemo(() => {
    const map = new Map();
    conferences.forEach(c => {
      if (c.firm_id && c.firm_name && !map.has(c.firm_id)) {
        map.set(c.firm_id, { id: c.firm_id, name: c.firm_name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [conferences]);

  const filtered = useMemo(() => {
    const loc = locationFilter.trim().toLowerCase();
    return conferences.filter(c => {
      if (firmFilter !== "all" && c.firm_id !== firmFilter) return false;
      if (loc && !(c.location || "").toLowerCase().includes(loc)) return false;
      if (dateFrom) {
        const from = parseISO(dateFrom);
        const cd = c.conference_date ? parseISO(c.conference_date) : null;
        if (cd && isBefore(cd, from)) return false;
      }
      if (dateTo) {
        const to = parseISO(dateTo);
        const cd = c.end_date ? parseISO(c.end_date) : (c.conference_date ? parseISO(c.conference_date) : null);
        if (cd && isAfter(cd, to)) return false;
      }
      return true;
    });
  }, [conferences, firmFilter, dateFrom, dateTo, locationFilter]);

  // Map conferences to their start date key (YYYY-MM-DD)
  const byDate = useMemo(() => {
    const map = new Map();
    filtered.forEach(c => {
      if (!c.conference_date) return;
      const key = c.conference_date.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return map;
  }, [filtered]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filtered
      .filter(c => {
        if (!c.conference_date) return false;
        const cd = parseISO(c.conference_date);
        return !isBefore(cd, today);
      })
      .sort((a, b) => (a.conference_date || "").localeCompare(b.conference_date || ""));
  }, [filtered]);

  const hasActiveFilters = firmFilter !== "all" || dateFrom || dateTo || locationFilter.trim() !== "";

  const clearFilters = () => {
    setFirmFilter("all");
    setDateFrom("");
    setDateTo("");
    setLocationFilter("");
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            Conference Calendar
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            All conferences found across your firms — your upcoming travel schedule at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => downloadConferenceTravelPdf(upcoming, {
              filtersLabel: [
                firmFilter !== "all" ? `Firm: ${firms.find(f => f.id === firmFilter)?.name || firmFilter}` : null,
                dateFrom ? `From ${dateFrom}` : null,
                dateTo ? `To ${dateTo}` : null,
                locationFilter.trim() ? `Location: ${locationFilter.trim()}` : null,
              ].filter(Boolean).join(" · ") || "None",
            })}
            disabled={upcoming.length === 0}
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilters(s => !s)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <select
                value={firmFilter}
                onChange={e => setFirmFilter(e.target.value)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="all">All firms</option>
                {firms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                placeholder="Filter by location..."
                className="h-8 w-44 rounded-md border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>
        </div>
      )}

      <ConferenceFeesChart conferences={filtered} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar grid */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between mb-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-sm font-semibold text-gray-800">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
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
        </div>

        {/* Side panel: selected day + upcoming */}
        <div className="space-y-4">
          {/* Selected day */}
          {selectedDate && (
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                {format(selectedDate, "EEEE, MMM d")}
              </h3>
              <div className="space-y-2">
                {(byDate.get(format(selectedDate, "yyyy-MM-dd")) || []).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No conferences on this day.</p>
                ) : (
                  (byDate.get(format(selectedDate, "yyyy-MM-dd")) || []).map(c => (
                    <ConferenceCard key={c.id} c={c} compact />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Upcoming list */}
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-indigo-500" />
              Upcoming ({upcoming.length})
            </h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                </div>
              ) : upcoming.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">No upcoming conferences. Run a conference scrub on your firms to populate this list.</p>
              ) : (
                upcoming.slice(0, 50).map(c => (
                  <ConferenceCard key={c.id} c={c} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConferenceCard({ c, compact }) {
  const pColor = PARTICP_COLORS[c.participation_type] || PARTICP_COLORS.Unknown;
  const rsvp = c.rsvp_status || "Not Responded";
  const rsvpColor = RSVP_COLORS[rsvp] || RSVP_COLORS["Not Responded"];
  const reg = c.registration_status || "Not Registered";
  const regColor = REG_COLORS[reg] || REG_COLORS["Not Registered"];
  const sponsor = c.sponsorship_status || "Not Sponsoring";
  const sponsorColor = SPONSOR_COLORS[sponsor] || SPONSOR_COLORS["Not Sponsoring"];
  return (
    <div className={`rounded-lg border border-gray-100 bg-white ${compact ? "p-2" : "p-2.5"} hover:shadow-sm transition-shadow`}>
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${pColor}`}>
          <Tag className="w-2.5 h-2.5" />
          {c.participation_type}
        </span>
        {rsvp !== "Not Responded" && (
          <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${rsvpColor}`}>
            {rsvp}
          </span>
        )}
        {reg !== "Not Registered" && (
          <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${regColor}`}>
            {reg}
          </span>
        )}
        {sponsor !== "Not Sponsoring" && (
          <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${sponsorColor}`}>
            <Award className="w-2.5 h-2.5" />
            {sponsor}
          </span>
        )}
        {!compact && (
          <span className="text-[10px] text-gray-500">{fmtRange(c.conference_date, c.end_date)}</span>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-800 leading-snug">
        {c.url ? (
          <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline inline-flex items-start gap-1">
            <span>{c.title}</span>
            <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
          </a>
        ) : c.title}
      </p>
      <div className="flex items-center gap-3 mt-1 flex-wrap text-[10px] text-gray-500">
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
      {sponsor !== "Not Sponsoring" && (
        <div className="mt-1 text-[10px] text-gray-600 bg-emerald-50/60 border border-emerald-100 rounded px-1.5 py-1 leading-snug">
          <span className="font-semibold text-emerald-700">Sponsorship:</span> {sponsor}
          {c.sponsorship_amount != null && c.sponsorship_amount !== "" ? ` · ${fmtCurrency(c.sponsorship_amount)}` : ""}
          {c.sponsorship_deliverables ? <> — {c.sponsorship_deliverables}</> : null}
        </div>
      )}
    </div>
  );
}