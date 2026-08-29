import { Briefcase, Wallet, BarChart3, Scale } from "lucide-react";

/**
 * Master list of Portfolios section modules. `to` (when present) is a route to
 * navigate to on click; otherwise the section page renders inline content.
 */
export const PORTFOLIO_MODULES = [
  { key: "funding-dashboard", label: "Funding Dashboard", icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", to: "/PortfolioFundingDashboard" },
  { key: "funding-report", label: "Funding Report", icon: Wallet, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", to: "/PortfolioFundingReport" },
  { key: "reconciliation-alerts", label: "Reconciliation Alerts", icon: Scale, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { key: "portfolios-list", label: "Portfolios", icon: Briefcase, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
];

export const PORTFOLIO_MODULE_MAP = Object.fromEntries(PORTFOLIO_MODULES.map((m) => [m.key, m]));

export const PORTFOLIO_DEFAULT_CATEGORIES = [
  { id: "funding", name: "Funding", items: ["funding-dashboard", "funding-report"] },
  { id: "oversight", name: "Oversight", items: ["reconciliation-alerts"] },
  { id: "management", name: "Management", items: ["portfolios-list"] },
];