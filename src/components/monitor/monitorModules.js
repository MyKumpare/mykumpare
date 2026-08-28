import {
  Newspaper, ClipboardList, LayoutList, BellRing, ClipboardCheck,
  LineChart, CalendarDays, Bell, UserCheck, Users, Activity as ActivityIcon, FileSearch,
  TrendingUp, BarChart2,
} from "lucide-react";

/**
 * Master list of Monitor modules. Each entry maps a stable key to its display
 * metadata (label + icon + color tokens). The key is used by the layout hook
 * to track category membership and order across drags.
 */
export const MONITOR_MODULES = [
  { key: "news", label: "News Alerts", icon: Newspaper, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  { key: "activity", label: "Activity", icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { key: "tasks", label: "Tasks", icon: LayoutList, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "stale-contacts", label: "Stale Contacts", icon: BellRing, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
  { key: "scoring-alerts", label: "Scoring Alerts", icon: ClipboardCheck, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  { key: "score-trends", label: "Score Trends", icon: LineChart, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { key: "conferences", label: "Conferences", icon: CalendarDays, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  { key: "board-meetings", label: "Board Meetings", icon: ClipboardCheck, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" },
  { key: "board-meeting-alerts", label: "Bd Mtg Alerts", icon: Bell, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { key: "coverage", label: "My Coverage", icon: UserCheck, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { key: "coverage-mgmt", label: "Coverage Mgmt", icon: Users, color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200" },
  { key: "timeline", label: "Timeline", icon: ActivityIcon, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200" },
  { key: "rfp-rfi", label: "RFP/RFI", icon: FileSearch, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  { key: "firm-score-trends-6mo", label: "Score Trends (6mo)", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { key: "benchmark-comparison", label: "Benchmark Comparison", icon: BarChart2, color: "text-fuchsia-600", bg: "bg-fuchsia-50", border: "border-fuchsia-200" },
];

export const MODULE_MAP = Object.fromEntries(MONITOR_MODULES.map((m) => [m.key, m]));