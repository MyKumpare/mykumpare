import {
  LineChart, FileBarChart, FileText, FileSearch, GitCompare, Users, TrendingUp, Wallet, BarChart3, LayoutDashboard, LayoutTemplate,
} from "lucide-react";

/**
 * Master list of Reports section modules. `to` (when present) is a route to
 * navigate to on click; otherwise the section page renders inline content.
 */
export const REPORT_MODULES = [
  { key: "analytics", label: "Analytics", icon: LineChart, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200", to: "/Analytics" },
  { key: "custom-reports", label: "Custom Reports", icon: FileBarChart, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  { key: "standard-reports", label: "Standard Reports", icon: FileText, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  { key: "search-report", label: "Search Report", icon: FileSearch, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", to: "/SearchReport" },
  { key: "firm-comparison", label: "Firm Comparison", icon: GitCompare, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", to: "/FirmComparison" },
  { key: "perf-dashboard", label: "Performance Dashboard", icon: LayoutDashboard, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200", to: "/FirmPerformanceDashboard" },
  { key: "analyst-coverage", label: "Analyst Coverage", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", to: "/AnalystCoverageReport" },
  { key: "weekly-interaction", label: "Weekly Interaction", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", to: "/WeeklyInteractionReport" },
  { key: "portfolio-funding-report", label: "Portfolio Funding Report", icon: Wallet, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", to: "/PortfolioFundingReport" },
  { key: "firm-summary", label: "Firm Summary Report", icon: BarChart3, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", to: "/FirmSummaryReport" },
  { key: "summary-templates", label: "Summary Report Templates", icon: LayoutTemplate, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", to: "/SummaryReportTemplates" },
];

export const REPORT_MODULE_MAP = Object.fromEntries(REPORT_MODULES.map((m) => [m.key, m]));

export const REPORT_DEFAULT_CATEGORIES = [
  { id: "analysis", name: "Analysis", items: ["perf-dashboard", "analytics", "firm-comparison", "search-report"] },
  { id: "reports", name: "Reports", items: ["custom-reports", "standard-reports", "weekly-interaction", "portfolio-funding-report", "analyst-coverage"] },
];