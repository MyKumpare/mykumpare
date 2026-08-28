import {
  LayoutDashboard, PieChart, CalendarDays, Files, ClipboardCheck, FileText,
} from "lucide-react";

/**
 * Master list of Due Diligence section modules. Each entry maps a stable key
 * to its display metadata (label + icon + color tokens). `to` (when present)
 * is a route to navigate to on click; otherwise the section page renders the
 * module's content inline.
 */
export const DD_MODULES = [
  { key: "dd-board", label: "DD Board", icon: LayoutDashboard, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", to: "/DueDiligenceKanban" },
  { key: "dd-stats", label: "DD Stats", icon: PieChart, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", to: "/DueDiligenceDashboard" },
  { key: "scoring-calendar", label: "Scoring Calendar", icon: CalendarDays, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", to: "/ScoringActivityCalendar" },
  { key: "documents", label: "Documents", icon: Files, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200" },
  { key: "forms", label: "Forms", icon: ClipboardCheck, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  { key: "templates", label: "Templates", icon: FileText, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" },
];

export const DD_MODULE_MAP = Object.fromEntries(DD_MODULES.map((m) => [m.key, m]));

export const DD_DEFAULT_CATEGORIES = [
  { id: "pipeline", name: "Pipeline", items: ["dd-board", "dd-stats", "scoring-calendar"] },
  { id: "library", name: "Library", items: ["documents", "forms", "templates"] },
];