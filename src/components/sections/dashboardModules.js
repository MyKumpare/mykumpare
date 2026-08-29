import {
  LayoutDashboard, Activity, Users, Globe, Network, GitBranch, Share2, UserCheck,
} from "lucide-react";

/**
 * Master list of Dashboard section modules. `to` (when present) is a route to
 * navigate to on click.
 */
export const DASHBOARD_MODULES = [
  { key: "overview", label: "Overview Dashboard", icon: LayoutDashboard, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", to: "/Overview" },
  { key: "executive", label: "Executive Dashboard", icon: LayoutDashboard, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", to: "/ExecutiveDashboard" },
  { key: "activity-timeline", label: "Activity Timeline", icon: Activity, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", to: "/ActivityTimeline" },
  { key: "analyst-coverage", label: "Analyst Coverage", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", to: "/AnalystCoverageReport" },
  { key: "firm-coverage", label: "Firm Coverage Map", icon: Globe, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", to: "/FirmGeographicMap" },
  { key: "contact-network", label: "Contact Network", icon: Network, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", to: "/ContactNetwork" },
  { key: "network-dashboard", label: "Network Dashboard", icon: Share2, color: "text-fuchsia-600", bg: "bg-fuchsia-50", border: "border-fuchsia-200", to: "/ContactNetworkDashboard" },
  { key: "influence-dashboard", label: "Influence Dashboard", icon: UserCheck, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", to: "/InfluenceLevelDashboard" },
  { key: "degrees", label: "Degrees of Separation", icon: GitBranch, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", to: "/DegreesOfSeparation" },
  { key: "relationship-map", label: "Relationship Network Map", icon: Network, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", to: "/RelationshipNetworkMap" },
];

export const DASHBOARD_MODULE_MAP = Object.fromEntries(DASHBOARD_MODULES.map((m) => [m.key, m]));

export const DASHBOARD_DEFAULT_CATEGORIES = [
  { id: "overview", name: "Overview", items: ["executive", "overview", "activity-timeline"] },
  { id: "coverage", name: "Coverage", items: ["analyst-coverage", "firm-coverage"] },
  { id: "network", name: "Network", items: ["contact-network", "network-dashboard", "influence-dashboard", "degrees", "relationship-map"] },
];