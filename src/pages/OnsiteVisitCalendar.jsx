import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth,
  addMonths, subMonths, parseISO,
} from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, CalendarDays, ArrowLeft, MapPin, Video,
  Clock, CheckCircle2, XCircle, UserX, Plus, Building2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { lazyDialog } from "@/components/common/lazyDialog";

const OnsiteVisitDialog = lazyDialog(() => import("@/components/firms/OnsiteVisitDialog"));
const FirmPickerModal = lazyDialog(() => import("@/components/firms/FirmPickerModal"));

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES = {
  Scheduled: { icon: Clock, color: "text-blue-600", bg: "bg-blue-100", dot: "bg-blue-500", border: "border-blue-200" },
  Completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100", dot: "bg-emerald-500", border: "border-emerald-200" },
  Cancelled: { icon: XCircle, color: "text-gray-500", bg: "bg-gray-100", dot: "bg-gray-400", border: "border-gray-200" },
  "No-show": { icon: UserX, color: "text-red-600", bg: "bg-red-100", dot: "bg-red-500", border: "border-red-200" },
};

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "Scheduled", label: "Scheduled" },
  { key: "Completed", label: "Completed" },
  { key: "Cancelled", label: "Cancelled" },
  { key: "No-show", label: "No-show" },
];

export default function OnsiteVisitCalendar() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingVisit, setEditingVisit] = useState(null);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [firmPickerOpen, setFirmPickerOpen] = useState(false);
  const [pickedFirm, setPickedFirm] = useState(null);

  const { data: allVisits = [], isLoading } = useQuery({
    queryKey: ["onsite-visits-calendar"],
    queryFn: () => base44.entities.OnsiteVisit.list("-target_visit_date", 5000),
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms-for-visit-calendar"],
    queryFn: () => base44.entities.Firm.list("-name", 5000),
  });
  const activeFirms = useMemo(() => firms.filter((f) => !f.deleted_at), [firms]);

  // Group visits by target_visit_date (YYYY-MM-DD)
  const visitsByDate = useMemo(() => {
    const map = new Map();
    for (const v of allVisits) {
      if (!v.target_visit_date) continue;
      const key = v.target_visit_date.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(v);
    }
    return map;
  }, [allVisits]);

  // Apply filters
  const filteredVisitsByDate = useMemo(() => {
    if (statusFilter === "all" && typeFilter === "all") return visitsByDate;
    const filtered = new Map();
    visitsByDate.forEach((visits, date) => {
      const kept = visits.filter((v) => {
        if (statusFilter !== "all" && v.status !== statusFilter) return false;
        if (typeFilter !== "all" && v.onsite_type !== typeFilter) return false;
        return true;
      });
      if (kept.length > 0) filtered.set(date, kept);
    });
    return filtered;
  }, [visitsByDate, statusFilter, typeFilter]);

  // Build 6-week calendar grid
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const today = new Date();
  const selectedKey = format(selectedDate, "yyyy-MM-dd");

  // Month stats
  const monthStats = useMemo(() => {
    const counts = { Scheduled: 0, Completed: 0, Cancelled: 0, "No-show": 0 };
    for (const day of days) {
      if (!isSameMonth(day, currentMonth)) continue;
      const key = format(day, "yyyy-MM-dd");
      for (const v of filteredVisitsByDate.get(key) || []) {
        counts[v.status] = (counts[v.status] || 0) + 1;
      }
    }
    return counts;
  }, [days, filteredVisitsByDate, currentMonth]);

  const totalMonth = Object.values(monthStats).reduce((a, b) => a + b, 0);

  // Upcoming visits (from today forward, next 8)
  const upcomingVisits = useMemo(() => {
    const todayKey = format(today, "yyyy-MM-dd");
    const all = [];
    filteredVisitsByDate.forEach((visits, date) => {
      if (date >= todayKey) all.push(...visits);
    });
    all.sort((a, b) => (a.target_visit_date || "").localeCompare(b.target_visit_date || ""));
    return all.slice(0, 8);
  }, [filteredVisitsByDate]);

  const selectedDayVisits = useMemo(() => {
    const list = filteredVisitsByDate.get(selectedKey) || [];
    return list.sort((a, b) => (a.target_visit_date || "").localeCompare(b.target_visit_date || ""));
  }, [filteredVisitsByDate, selectedKey]);

  const openVisit = (visit) => {
    setEditingVisit(visit);
    setVisitDialogOpen(true);
  };

  const handleAddVisit = () => {
    setEditingVisit(null);
    setFirmPickerOpen(true);
  };

  const handleFirmPicked = (firm) => {
    setPickedFirm(firm);
    setFirmPickerOpen(false);
    setVisitDialogOpen(true);
  };

  const handleVisitSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["onsite-visits-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["onsite-visits-all"] });
    setVisitDialogOpen(false);
    setEditingVisit(null);
    setPickedFirm(null);
    toast({ title: "Visit saved" });
  };

  // Firm object for the dialog (minimal — dialog only needs id + name)
  const dialogFirm = editingVisit
    ? { id: editingVisit.firm_id, name: editingVisit.firm_name }
    : pickedFirm;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/OnsiteVisitReport" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-4 h-4" />
              <CalendarDays className="w-5 h-5" />
            </Link>
            <h1 className="text-base sm:text-lg font-bold">Onsite Visit Calendar</h1>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-2 sm:px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-xs sm:text-sm font-medium transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm sm:text-base font-semibold min-w-[140px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 py-4 max-w-6xl">
        {/* Filter pills + summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5 items-center">
            {STATUS_FILTERS.map((f) => {
              const cfg = f.key === "all" ? null : STATUS_STYLES[f.key];
              const active = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {cfg && <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />}
                  {f.label}
                </button>
              );
            })}
            <span className="w-px h-5 bg-gray-200" />
            {["all", "In-person", "Virtual"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  typeFilter === t
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {t === "all" ? "All types" : t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">
              {totalMonth} {totalMonth === 1 ? "visit" : "visits"} this month
            </div>
            <Button size="sm" className="gap-1.5" onClick={handleAddVisit}>
              <Plus className="w-3.5 h-3.5" /> Add Visit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar grid */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-gray-200">
                {WEEKDAYS.map((wd) => (
                  <div key={wd} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {wd}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayVisits = filteredVisitsByDate.get(key) || [];
                  const inMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, selectedDate);

                  // Unique statuses present on this day (for dots)
                  const statusKeys = new Set();
                  for (const v of dayVisits) statusKeys.add(v.status);
                  const statusList = Array.from(statusKeys).slice(0, 4);

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(day)}
                      className={`relative min-h-[72px] sm:min-h-[96px] p-1.5 border-b border-r border-gray-100 text-left transition-colors hover:bg-indigo-50/30 ${
                        isSelected ? "bg-indigo-50 ring-2 ring-indigo-400 ring-inset z-10" : ""
                      } ${!inMonth ? "bg-gray-50/50" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday ? "bg-indigo-600 text-white" : inMonth ? "text-gray-700" : "text-gray-300"
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        {dayVisits.length > 0 && (
                          <span className="text-[10px] text-gray-400 font-medium">{dayVisits.length}</span>
                        )}
                      </div>

                      {/* Status dots */}
                      {statusList.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {statusList.map((sk) => {
                            const cfg = STATUS_STYLES[sk] || STATUS_STYLES.Scheduled;
                            return <span key={sk} className={`w-2 h-2 rounded-full ${cfg.dot}`} title={sk} />;
                          })}
                        </div>
                      )}

                      {/* Compact label for first visit (desktop) */}
                      {dayVisits.length > 0 && (
                        <div className="mt-1 hidden sm:block">
                          <p className="text-[10px] text-gray-500 truncate leading-tight">
                            {dayVisits[0].firm_name || "Visit"}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
              {Object.entries(STATUS_STYLES).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className="text-xs text-gray-500">{key}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Side: Selected day + Upcoming */}
          <div className="space-y-4">
            {/* Selected day panel */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {format(selectedDate, "EEEE, MMM d, yyyy")}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedDayVisits.length} {selectedDayVisits.length === 1 ? "visit" : "visits"} scheduled
                </p>
              </div>
              <div className="max-h-[45vh] overflow-y-auto divide-y divide-gray-50">
                {selectedDayVisits.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400 italic">
                    No visits on this date.
                  </div>
                ) : (
                  selectedDayVisits.map((v) => {
                    const st = STATUS_STYLES[v.status] || STATUS_STYLES.Scheduled;
                    const StatusIcon = st.icon;
                    const TypeIcon = v.onsite_type === "Virtual" ? Video : MapPin;
                    return (
                      <button
                        key={v.id}
                        onClick={() => openVisit(v)}
                        className="w-full px-4 py-3 flex items-start gap-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className={`mt-0.5 w-7 h-7 rounded-lg ${st.bg} flex items-center justify-center flex-shrink-0`}>
                          <TypeIcon className={`w-3.5 h-3.5 ${st.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{v.firm_name || "—"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center gap-1 text-[11px] ${st.color}`}>
                              <StatusIcon className="w-3 h-3" /> {v.status}
                            </span>
                            <span className="text-[11px] text-gray-400">{v.onsite_type}</span>
                          </div>
                          {v.visiting_analyst_name && (
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">Analyst: {v.visiting_analyst_name}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Upcoming visits */}
            {upcomingVisits.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">Upcoming</h3>
                  <p className="text-xs text-gray-500">Next 8 visits from today</p>
                </div>
                <div className="max-h-[40vh] overflow-y-auto divide-y divide-gray-50">
                  {upcomingVisits.map((v) => {
                    const st = STATUS_STYLES[v.status] || STATUS_STYLES.Scheduled;
                    const TypeIcon = v.onsite_type === "Virtual" ? Video : MapPin;
                    return (
                      <button
                        key={v.id}
                        onClick={() => openVisit(v)}
                        className="w-full px-4 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className={`mt-0.5 w-7 h-7 rounded-lg ${st.bg} flex items-center justify-center flex-shrink-0`}>
                          <TypeIcon className={`w-3.5 h-3.5 ${st.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${st.color}`}>{v.status}</span>
                            <span className="text-xs text-gray-400">
                              {v.target_visit_date ? format(parseISO(v.target_visit_date), "MMM d") : ""}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 truncate">{v.firm_name || "—"}</p>
                          {v.visiting_analyst_name && (
                            <p className="text-[11px] text-gray-400 truncate">{v.visiting_analyst_name}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visit dialog (edit existing or add new after firm pick) */}
      <OnsiteVisitDialog
        open={visitDialogOpen}
        onOpenChange={(o) => {
          setVisitDialogOpen(o);
          if (!o) {
            setEditingVisit(null);
            setPickedFirm(null);
          }
        }}
        firm={dialogFirm}
        editingVisit={editingVisit}
        onSaved={handleVisitSaved}
      />

      {/* Firm picker for adding a new visit */}
      <FirmPickerModal
        open={firmPickerOpen}
        onClose={() => setFirmPickerOpen(false)}
        firms={activeFirms}
        onFirmClick={handleFirmPicked}
      />
    </div>
  );
}