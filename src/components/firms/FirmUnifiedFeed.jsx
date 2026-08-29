import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  FileText, ClipboardList, History, TrendingDown, Award, CalendarClock,
  Newspaper, ChevronRight, AlertTriangle, Inbox,
} from "lucide-react";
import { format } from "date-fns";

const SOURCES = [
  { key: "activity",      label: "Activities",     icon: FileText,      color: "text-amber-600",   bg: "bg-amber-50",   dot: "bg-amber-500" },
  { key: "task",          label: "Tasks",           icon: ClipboardList, color: "text-indigo-600", bg: "bg-indigo-50",  dot: "bg-indigo-500" },
  { key: "record_edit",   label: "Record Edits",    icon: History,       color: "text-slate-600",   bg: "bg-slate-100",  dot: "bg-slate-500" },
  { key: "aum_alert",     label: "AUM Alerts",      icon: TrendingDown,  color: "text-rose-600",   bg: "bg-rose-50",    dot: "bg-rose-500" },
  { key: "scoring_alert", label: "Scoring Alerts",  icon: Award,         color: "text-violet-600", bg: "bg-violet-50",  dot: "bg-violet-500" },
  { key: "board_alert",   label: "Board Alerts",    icon: CalendarClock, color: "text-cyan-600",   bg: "bg-cyan-50",    dot: "bg-cyan-500" },
  { key: "news",          label: "News",            icon: Newspaper,     color: "text-blue-600",   bg: "bg-blue-50",    dot: "bg-blue-500" },
];
const SOURCE_MAP = Object.fromEntries(SOURCES.map((s) => [s.key, s]));

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ts)) return new Date(ts + "T12:00:00");
  return new Date(ts);
}
function fmtDate(ts) {
  const d = toDate(ts);
  return d && !isNaN(d) ? format(d, "MMM d, yyyy") : "—";
}
function fmtDateTime(ts) {
  const d = toDate(ts);
  return d && !isNaN(d) ? format(d, "MMM d, yyyy · h:mm a") : "—";
}
function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function stripHtml(html) {
  if (!html) return "";
  if (typeof document !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || "").trim();
  }
  return html.replace(/<[^>]+>/g, "").trim();
}
function summarizeVal(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 80) + "…" : v;
  if (Array.isArray(v)) return `${v.length} item${v.length !== 1 ? "s" : ""}`;
  return String(v);
}

export default function FirmUnifiedFeed({ firmId, firm, activities = [], tasks = [], onActivityClick, onTaskClick }) {
  const [active, setActive] = useState(() => new Set(SOURCES.map((s) => s.key)));

  const { data: aumAlerts = [] } = useQuery({
    queryKey: ["unified_aum_alerts", firmId],
    queryFn: () => base44.entities.FirmAumAlert.filter({ firm_id: firmId }),
    enabled: !!firmId,
  });
  const { data: scoringAlerts = [] } = useQuery({
    queryKey: ["unified_scoring_alerts", firmId],
    queryFn: () => base44.entities.ScoringThresholdAlert.filter({ firm_id: firmId }),
    enabled: !!firmId,
  });
  const { data: boardAlerts = [] } = useQuery({
    queryKey: ["unified_board_alerts", firmId],
    queryFn: () => base44.entities.BoardMeetingAlert.filter({ firm_id: firmId }),
    enabled: !!firmId,
  });
  const { data: news = [] } = useQuery({
    queryKey: ["unified_firm_news", firmId],
    queryFn: () => base44.entities.FirmNews.filter({ firm_id: firmId }),
    enabled: !!firmId,
  });

  const items = useMemo(() => {
    const out = [];
    activities.forEach((a) => {
      out.push({
        id: `act-${a.id}`,
        sourceType: "activity",
        timestamp: a.activity_date || a.created_date,
        title: `${a.activity_type}${a.subject ? " — " + a.subject : ""}`,
        description: a.notes || "",
        badge: a.contact_name || "",
        onClick: () => onActivityClick?.(a),
      });
    });
    tasks.forEach((t) => {
      out.push({
        id: `task-${t.id}`,
        sourceType: "task",
        timestamp: t.due_date || t.status_date || t.created_date,
        title: `Task: ${stripHtml(t.task_description).slice(0, 80) || "Untitled"}`,
        description: `Due ${fmtDate(t.due_date)}`,
        badge: t.status,
        onClick: () => onTaskClick?.(t),
      });
    });
    (firm?.audit_history || []).forEach((h) => {
      out.push({
        id: `edit-${h.id || h.changed_date}`,
        sourceType: "record_edit",
        timestamp: h.changed_date,
        title: `${h.field || "Field"} updated`,
        description: `${summarizeVal(h.previous_value)} → ${summarizeVal(h.new_value)}`,
        badge: h.changed_by_name || "",
      });
    });
    aumAlerts.forEach((a) => {
      out.push({
        id: `aum-${a.id}`,
        sourceType: "aum_alert",
        timestamp: a.created_date || a.month_end_date,
        title: `AUM below threshold — ${fmtCurrency(a.aum_value)} vs ${fmtCurrency(a.threshold)}`,
        description: `Month-end ${fmtDate(a.month_end_date)}`,
        badge: a.status,
        highlight: a.status === "active",
      });
    });
    scoringAlerts.forEach((a) => {
      out.push({
        id: `scoring-${a.id}`,
        sourceType: "scoring_alert",
        timestamp: a.created_date || a.scoring_end_date,
        title: `Score below threshold — ${(a.weighted_final_score ?? 0).toFixed(2)} vs ${a.threshold}`,
        description: [a.template_name, a.product_name].filter(Boolean).join(" · "),
        badge: a.status,
        highlight: a.status === "active",
      });
    });
    boardAlerts.filter((a) => !a.deleted_at && !a.is_dismissed).forEach((a) => {
      out.push({
        id: `board-${a.id}`,
        sourceType: "board_alert",
        timestamp: a.created_date || a.meeting_date,
        title: a.meeting_title || "Board meeting alert",
        description: a.details || a.alert_type,
        badge: a.alert_type,
        highlight: !a.is_read,
      });
    });
    news.filter((n) => !n.deleted_at && !n.is_hidden).forEach((n) => {
      out.push({
        id: `news-${n.id}`,
        sourceType: "news",
        timestamp: n.news_date || n.created_date,
        title: n.headline,
        description: n.summary || "",
        badge: n.alert_status,
        onClick: n.article_url ? () => window.open(n.article_url, "_blank") : null,
      });
    });
    out.sort((x, y) => (toDate(y.timestamp)?.getTime() || 0) - (toDate(x.timestamp)?.getTime() || 0));
    return out;
  }, [activities, tasks, firm, aumAlerts, scoringAlerts, boardAlerts, news, onActivityClick, onTaskClick]);

  const counts = useMemo(() => {
    const c = {};
    SOURCES.forEach((s) => { c[s.key] = 0; });
    items.forEach((i) => { if (c[i.sourceType] != null) c[i.sourceType]++; });
    return c;
  }, [items]);

  const filtered = items.filter((i) => active.has(i.sourceType));
  const allOn = active.size === SOURCES.length;
  const toggle = (key) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const setAll = () => setActive(allOn ? new Set() : new Set(SOURCES.map((s) => s.key)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={setAll}
          className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${allOn ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          {allOn ? "All" : "Show all"}
        </button>
        {SOURCES.map((s) => {
          const isOn = active.has(s.key);
          const Icon = s.icon;
          const count = counts[s.key] || 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium border transition-colors ${isOn ? `${s.bg} ${s.color} border-transparent` : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"}`}
            >
              <Icon className="w-3 h-3" />
              {s.label}
              {count > 0 && (
                <span className={`text-[9px] font-bold px-1 rounded-full ${isOn ? "bg-white/70" : "bg-gray-100"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2">
          <Inbox className="w-6 h-6 text-gray-300" />
          No recent activity, alerts, or updates
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <FeedItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedItem({ item }) {
  const src = SOURCE_MAP[item.sourceType];
  const Icon = src.icon;
  const clickable = !!item.onClick;
  return (
    <div
      onClick={item.onClick}
      className={`flex gap-3 rounded-lg border bg-white p-3 transition-all ${clickable ? "cursor-pointer hover:shadow-sm hover:border-gray-300" : ""} ${item.highlight ? "border-rose-200 bg-rose-50/30" : "border-gray-200"}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${src.bg}`}>
        <Icon className={`w-4 h-4 ${src.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.title}</p>
          <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap">{fmtDateTime(item.timestamp)}</span>
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${src.bg} ${src.color}`}>{src.label}</span>
          {item.badge && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.badge}</span>
          )}
          {item.highlight && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5" /> Active
            </span>
          )}
          {clickable && <ChevronRight className="w-3 h-3 text-gray-300 ml-auto" />}
        </div>
      </div>
    </div>
  );
}