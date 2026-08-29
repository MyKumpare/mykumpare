import {
  Building, ListChecks, Clock, TrendingUp, ShieldCheck,
  CheckCircle2, Package, Users, DollarSign,
} from "lucide-react";

// All available KPI cards for the Overview Dashboard. Each entry pairs a
// stable key (persisted in the user's config) with the label, icon, and
// accent color used to render the card. The `compute` function receives the
// dashboard's already-fetched data and returns the display value.
export const OVERVIEW_KPIS = [
  {
    key: "total_firms",
    label: "Total Firms",
    icon: Building,
    color: "bg-indigo-500",
    compute: ({ scopedFirms }) => scopedFirms.length,
  },
  {
    key: "funded_firms",
    label: "Funded Firms",
    icon: CheckCircle2,
    color: "bg-emerald-500",
    compute: ({ scopedFirms }) =>
      scopedFirms.filter((f) => f.funding_status === "Funded").length,
  },
  {
    key: "total_aum",
    label: "Total AUM",
    icon: DollarSign,
    color: "bg-blue-500",
    compute: ({ scopedFirms }) => {
      const total = scopedFirms.reduce((sum, f) => {
        const latest = (f.aum_history || [])
          .slice()
          .sort((a, b) => (b.month_end_date || "").localeCompare(a.month_end_date || ""))[0];
        return sum + (latest?.firm_aum || 0);
      }, 0);
      return total;
    },
    format: "currency",
  },
  {
    key: "active_products",
    label: "Active Products",
    icon: Package,
    color: "bg-violet-500",
    compute: ({ scopedProducts }) =>
      (scopedProducts || []).filter(
        (p) => !p.deleted_at && p.product_availability_status !== "Closed"
      ).length,
  },
  {
    key: "active_contacts",
    label: "Active Contacts",
    icon: Users,
    color: "bg-cyan-500",
    compute: ({ scopedContacts }) =>
      (scopedContacts || []).filter(
        (c) => !c.deleted_at && c.contact_status !== "Inactive"
      ).length,
  },
  {
    key: "total_tasks",
    label: "Total Tasks",
    icon: ListChecks,
    color: "bg-violet-500",
    compute: ({ scopedTasks }) => scopedTasks.length,
  },
  {
    key: "overdue_tasks",
    label: "Overdue Tasks",
    icon: Clock,
    color: "bg-red-500",
    compute: ({ overdueTasks }) => overdueTasks,
  },
  {
    key: "completion_rate",
    label: "Completion Rate",
    icon: TrendingUp,
    color: "bg-emerald-500",
    compute: ({ scopedTasks, taskStatusData }) => {
      const total = scopedTasks.length;
      if (!total) return null;
      const completed = taskStatusData.find((s) => s.name === "Completed")?.count || 0;
      return `${Math.round((completed / total) * 100)}%`;
    },
  },
  {
    key: "dd_pending",
    label: "DD Pending Approval",
    icon: ShieldCheck,
    color: "bg-amber-500",
    compute: ({ totalPendingApprovals }) => totalPendingApprovals,
  },
];

export const DEFAULT_VISIBLE_KPIS = OVERVIEW_KPIS.map((k) => k.key);

// Returns the ordered list of KPI definitions the user has chosen to show.
// Falls back to the full default set when no config is stored.
export function resolveVisibleKpis(config) {
  if (!config || !Array.isArray(config) || config.length === 0) {
    return OVERVIEW_KPIS;
  }
  // Keep only valid keys, in the user's order; drop unknown/removed keys.
  return config
    .map((key) => OVERVIEW_KPIS.find((k) => k.key === key))
    .filter(Boolean);
}