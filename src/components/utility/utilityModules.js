import {
  Gauge, Users, ArrowRightLeft, ScrollText, Ghost, Upload, Building, Package,
  Eraser, Tag, Briefcase, ClipboardCheck, UserX, Activity, Newspaper,
  ShieldCheck, ExternalLink, TrendingUp, Network, UsersRound,
} from "lucide-react";

/**
 * Master list of Utility modules. Each entry maps a stable key to its display
 * metadata (label + icon + color tokens) and an action type:
 *  - (default): in-place tool — clicking sets the Utility view to this key
 *  - `to`: a route to navigate to on click
 *  - `action`: a special action key handled by the parent (e.g. "ext-portal")
 * `gated` restricts visibility: "admin" or "management" (undefined = all users).
 * The key is used by the layout hook to track category membership and order.
 */
export const UTILITY_MODULES = [
  { key: "peer-groups", label: "Peer Groups", icon: UsersRound, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  { key: "benchmark", label: "Benchmark", icon: Gauge, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  { key: "cleanup", label: "Contact Cleanup", icon: Users, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  { key: "bulk-merge", label: "Bulk Merge", icon: ArrowRightLeft, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  { key: "enrichment-logs", label: "Enrichment Logs", icon: ScrollText, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
  { key: "orphans", label: "Orphan Cleanup", icon: Ghost, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { key: "import-contacts", label: "Import Contacts", icon: Upload, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { key: "import-firms", label: "Import Firms", icon: Building, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { key: "import-products", label: "Import Products", icon: Package, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  { key: "placeholder-cleanup", label: "Placeholder Cleanup", icon: Eraser, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  { key: "firm-type-validation", label: "Firm Type Check", icon: Tag, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  { key: "experience-option-cleanup", label: "Company / Title Cleanup", icon: Briefcase, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200" },
  { key: "dd-cleanup", label: "DD Integrity Cleanup", icon: ClipboardCheck, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  { key: "orphaned-contacts", label: "Orphaned Contacts", icon: UserX, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "import-jobs", label: "Import Jobs", icon: Activity, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" },
  { key: "ext-portal", label: "Ext Portal", icon: ExternalLink, color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200", action: "ext-portal" },
  { key: "news-scrub-settings", label: "News Scrub Settings", icon: Newspaper, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", gated: "admin" },
  { key: "admin", label: "Admin", icon: ShieldCheck, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", to: "/UserManagement", gated: "admin" },
  { key: "mgmt-timeline", label: "Activity Timeline", icon: Activity, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", gated: "management" },
  { key: "weekly-interaction-report", label: "Weekly Interaction Report", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", to: "/WeeklyInteractionReport", gated: "management" },
  { key: "relationship-network-map", label: "Relationship Network Map", icon: Network, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", to: "/RelationshipNetworkMap", gated: "management" },
  { key: "mgmt-analyst-coverage", label: "Analyst Coverage", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", gated: "management" },
  { key: "mgmt-firm-coverage", label: "Firm Coverage", icon: Building, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", gated: "management" },
];

export const UTILITY_MODULE_MAP = Object.fromEntries(UTILITY_MODULES.map((m) => [m.key, m]));

/** Filter the master list to the modules the given user role can access. */
export function getActiveUtilityModules({ isAdmin, isManagement }) {
  return UTILITY_MODULES.filter((m) => {
    if (m.gated === "admin") return isAdmin;
    if (m.gated === "management") return isManagement;
    return true;
  });
}

/**
 * Sensible default categorization so the grid is organized out of the box.
 * Only includes categories whose modules the user can access.
 */
export function buildDefaultUtilityCategories({ isAdmin, isManagement }) {
  const cats = [
    { id: "data-cleanup", name: "Data Cleanup", items: ["cleanup", "bulk-merge", "orphans", "dd-cleanup", "orphaned-contacts", "placeholder-cleanup", "firm-type-validation", "experience-option-cleanup"] },
    { id: "imports", name: "Imports", items: ["import-contacts", "import-firms", "import-products", "import-jobs"] },
    { id: "reference", name: "Reference", items: ["peer-groups", "benchmark", "enrichment-logs"] },
    { id: "portal", name: "Portal", items: ["ext-portal"] },
  ];
  if (isAdmin) cats.push({ id: "admin-tools", name: "Admin", items: ["news-scrub-settings", "admin"] });
  if (isManagement) cats.push({ id: "management", name: "Management", items: ["mgmt-timeline", "weekly-interaction-report", "relationship-network-map", "mgmt-analyst-coverage", "mgmt-firm-coverage"] });
  return cats;
}