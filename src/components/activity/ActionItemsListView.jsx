import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, X, Flame, CalendarClock, Building2, AlertTriangle, ListFilter, KanbanSquare, ArrowDownWideNarrow, TrendingUp, TrendingDown, Minus, Signal,
} from "lucide-react";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { format, differenceInCalendarDays } from "date-fns";
import { navigateToFirm, navigateToBoardMeeting } from "./actionItemNav";

const STATUS_OPTIONS = [
  { key: "Not Started", label: "Pending",     chip: "bg-gray-100 text-gray-700",   dot: "bg-gray-400" },
  { key: "In-process", label: "In Progress",  chip: "bg-blue-100 text-blue-700",    dot: "bg-blue-500" },
  { key: "Completed",  label: "Completed",    chip: "bg-green-100 text-green-700", dot: "bg-green-500" },
  { key: "Cancelled",  label: "Cancelled",     chip: "bg-red-100 text-red-700",     dot: "bg-red-400" },
];

const PRIORITY_META = {
  High:   { icon: Flame,       chip: "bg-red-100 text-red-700",     dot: "bg-red-500" },
  Medium: { icon: Signal,       chip: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  Low:    { icon: Minus,       chip: "bg-gray-100 text-gray-600",   dot: "bg-gray-400" },
};
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

const IMPACT_META = {
  Positive: { icon: TrendingUp,   chip: "bg-green-100 text-green-700",   dot: "bg-green-500" },
  Negative: { icon: TrendingDown, chip: "bg-red-100 text-red-700",       dot: "bg-red-500" },
  Neutral:  { icon: Minus,        chip: "bg-gray-100 text-gray-600",     dot: "bg-gray-400" },
};
const IMPACT_RANK = { Negative: 0, Positive: 1, Neutral: 2 };

const todayStr = () => new Date().toISOString().slice(0, 10);

function dueColor(dueDate) {
  if (!dueDate) return "text-gray-400";
  const days = differenceInCalendarDays(new Date(dueDate), new Date(todayStr()));
  if (days < 0) return "text-red-600 font-semibold";
  if (days <= 3) return "text-amber-600 font-semibold";
  if (days <= 7) return "text-yellow-600";
  return "text-gray-500";
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export default function ActionItemsListView({ tasks, meetings, onOpenTask }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | status key
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);
  const [sortBy, setSortBy] = useState("priority"); // "priority" | "due" | "status"

  const meetingById = useMemo(() => {
    const m = {};
    (meetings || []).forEach(mt => { if (mt.id) m[mt.id] = mt; });
    return m;
  }, [meetings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = (tasks || []).filter(t => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (highPriorityOnly && !t.is_high_priority) return false;
      if (q) {
        const hay = `${stripHtml(t.task_description) || ""} ${t.activity_label || ""} ${t.originator_firm_name || ""} ${t.assigned_to_firm_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const statusRank = { "Not Started": 0, "In-process": 1, "Completed": 2, "Cancelled": 3 };
    const pr = (t) => t.priority || (t.is_high_priority ? "High" : "");
    return [...result].sort((a, b) => {
      if (sortBy === "priority") {
        const ar = PRIORITY_RANK[pr(a)] ?? 9;
        const br = PRIORITY_RANK[pr(b)] ?? 9;
        if (ar !== br) return ar - br;
        const ad = a.due_date || "9999-12-31";
        const bd = b.due_date || "9999-12-31";
        return ad.localeCompare(bd);
      }
      if (sortBy === "impact") {
        const ar = IMPACT_RANK[a.board_meeting_impact] ?? 9;
        const br = IMPACT_RANK[b.board_meeting_impact] ?? 9;
        if (ar !== br) return ar - br;
        const ad = a.due_date || "9999-12-31";
        const bd = b.due_date || "9999-12-31";
        return ad.localeCompare(bd);
      }
      if (sortBy === "due") {
        const ad = a.due_date || "9999-12-31";
        const bd = b.due_date || "9999-12-31";
        return ad.localeCompare(bd);
      }
      if (sortBy === "status") {
        return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
      }
      return 0;
    });
  }, [tasks, search, statusFilter, highPriorityOnly, sortBy]);

  const counts = useMemo(() => {
    const c = { all: (tasks || []).length };
    STATUS_OPTIONS.forEach(s => { c[s.key] = 0; });
    (tasks || []).forEach(t => {
      const key = STATUS_OPTIONS.find(s => s.key === t.status) ? t.status : "Not Started";
      c[key] = (c[key] || 0) + 1;
    });
    return c;
  }, [tasks]);

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action items…"
            className="pl-8 h-8 text-xs"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button
          variant={highPriorityOnly ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => setHighPriorityOnly(v => !v)}
        >
          <Flame className="w-3.5 h-3.5" /> High priority
        </Button>
        <div className="flex items-center gap-1">
          <ArrowDownWideNarrow className="w-3.5 h-3.5 text-gray-400" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-8 text-xs w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priority (high first)</SelectItem>
              <SelectItem value="impact">Board meeting impact</SelectItem>
              <SelectItem value="due">Due date (soonest)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(statusFilter !== "all" || highPriorityOnly || search || sortBy !== "priority") && (
          <Button variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => { setStatusFilter("all"); setHighPriorityOnly(false); setSearch(""); setSortBy("priority"); }}>
            <ListFilter className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button
          onClick={() => setStatusFilter("all")}
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
            statusFilter === "all"
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
        >
          All <span className="text-[10px] opacity-75">({counts.all})</span>
        </button>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
              statusFilter === s.key
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label} <span className="text-[10px] opacity-75">({counts[s.key] || 0})</span>
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          No action items match the current filters.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filtered.map(t => {
            const meeting = t.board_meeting_id ? meetingById[t.board_meeting_id] : null;
            const firmId = t.originator_firm_id || t.assigned_to_firm_id || meeting?.firm_id;
            const firmName = t.assigned_to_firm_name || t.originator_firm_name || meeting?.firm_name || "";
            const statusOpt = STATUS_OPTIONS.find(s => s.key === t.status) || STATUS_OPTIONS[0];
            const priorityKey = t.priority || (t.is_high_priority ? "High" : "");
            const priorityMeta = priorityKey ? PRIORITY_META[priorityKey] : null;
            const impactMeta = t.board_meeting_impact ? IMPACT_META[t.board_meeting_impact] : null;
            return (
              <div
                key={t.id}
                onClick={() => onOpenTask(t.id)}
                className={`group rounded-lg bg-white border p-3 shadow-sm hover:shadow-md cursor-pointer transition-shadow ${
                  t.is_high_priority ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  {t.is_high_priority && (
                    <Flame className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium text-gray-800 line-clamp-3 flex-1">
                    {stripHtml(t.task_description) || "(no description)"}
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusOpt.chip}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusOpt.dot}`} />
                      {statusOpt.label}
                    </span>
                    {priorityMeta && (() => { const PI = priorityMeta.icon; return (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityMeta.chip}`}>
                        <PI className="w-3 h-3" /> {priorityKey}
                      </span>
                    ); })()}
                    {impactMeta && (() => { const II = impactMeta.icon; return (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${impactMeta.chip}`}>
                        <II className="w-3 h-3" /> {t.board_meeting_impact}
                      </span>
                    ); })()}
                  </div>
                </div>

                {t.activity_label && (
                  <p className="text-[11px] text-gray-400 mt-1 truncate">{t.activity_label}</p>
                )}

                <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px]">
                  {firmName && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigateToFirm(navigate, firmId); }}
                      className="inline-flex items-center gap-1 text-gray-600 hover:text-indigo-600 hover:underline"
                      title="Open firm profile"
                    >
                      <Building2 className="w-3 h-3" />
                      {firmName}
                    </button>
                  )}
                  {meeting && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigateToBoardMeeting(navigate, meeting.firm_id); }}
                      className="inline-flex items-center gap-1 text-gray-600 hover:text-indigo-600 hover:underline"
                      title="Open board meeting"
                    >
                      <KanbanSquare className="w-3 h-3" />
                      {meeting.title}
                      {meeting.meeting_date && <span className="text-gray-400">· {format(new Date(meeting.meeting_date), "MMM d, yyyy")}</span>}
                    </button>
                  )}
                  {t.due_date && (
                    <span className={`inline-flex items-center gap-1 ml-auto ${dueColor(t.due_date)}`}>
                      <CalendarClock className="w-3 h-3" />
                      Due {format(new Date(t.due_date), "MMM d")}
                    </span>
                  )}
                </div>

                {t.is_high_priority && (
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> HIGH PRIORITY
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}