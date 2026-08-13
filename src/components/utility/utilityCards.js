import {
  Gauge, Users, Building2, Package, ScrollText, Ghost,
  Upload, Eraser, Tag, UserX, ShieldCheck
} from "lucide-react";

/**
 * Static metadata for each Utility card. The `id` is the stable key used to
 * persist the user's custom ordering in localStorage; `view` is the internal
 * view name the card opens (or `null` for the Admin card which navigates).
 */
export const UTILITY_CARDS = [
  {
    id: "benchmark",
    view: "benchmark",
    title: "Benchmark",
    description: "Search & manage benchmarks",
    Icon: Gauge,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    iconSize: "w-4.5 h-4.5",
  },
  {
    id: "contact-cleanup",
    view: "cleanup",
    title: "Contact Cleanup",
    description: "Review & merge duplicates",
    Icon: Users,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    iconSize: "w-4.5 h-4.5",
  },
  {
    id: "firm-cleanup",
    view: "firm-cleanup",
    title: "Firm Cleanup",
    description: "Review & merge duplicates",
    Icon: Building2,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    iconSize: "w-4.5 h-4.5",
  },
  {
    id: "product-cleanup",
    view: "product-cleanup",
    title: "Product Cleanup",
    description: "Review & merge duplicates",
    Icon: Package,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    iconSize: "w-4.5 h-4.5",
  },
  {
    id: "enrichment-logs",
    view: "enrichment-logs",
    title: "Enrichment Logs",
    description: "Review enrichment results",
    Icon: ScrollText,
    iconBg: "bg-slate-50",
    iconColor: "text-slate-600",
    iconSize: "w-4.5 h-4.5",
  },
  {
    id: "orphan-cleanup",
    view: "orphans",
    title: "Orphan Cleanup",
    description: "Find & remove stale records",
    Icon: Ghost,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    iconSize: "w-4.5 h-4.5",
  },
  {
    id: "import-contacts",
    view: "import-contacts",
    title: "Import Contacts",
    description: "Bulk upload from CSV",
    Icon: Upload,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    iconSize: "w-5 h-5",
  },
  {
    id: "placeholder-cleanup",
    view: "placeholder-cleanup",
    title: "Placeholder Cleanup",
    description: "Clear inconsistent values",
    Icon: Eraser,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    iconSize: "w-5 h-5",
  },
  {
    id: "firm-type-check",
    view: "firm-type-validation",
    title: "Firm Type Check",
    description: "Find multi-type firms",
    Icon: Tag,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    iconSize: "w-5 h-5",
  },
  {
    id: "orphaned-contacts",
    view: "orphaned-contacts",
    title: "Orphaned Contacts",
    description: "Find & fix firmless contacts",
    Icon: UserX,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    iconSize: "w-5 h-5",
  },
  {
    id: "admin",
    view: null, // navigates instead of switching view
    title: "Admin",
    description: "Manage users & settings",
    Icon: ShieldCheck,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    iconSize: "w-4.5 h-4.5",
    adminOnly: true,
  },
];

export const DEFAULT_CARD_ORDER = UTILITY_CARDS.map((c) => c.id);

const STORAGE_KEY = "app_utility_card_order";

/** Returns the ordered card objects, applying the user's saved ordering. */
export function getOrderedCards(isAdmin) {
  let order = DEFAULT_CARD_ORDER;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Use stored order, but append any new cards added since the order was saved.
        const known = new Set(parsed);
        const extras = DEFAULT_CARD_ORDER.filter((id) => !known.has(id));
        order = [...parsed, ...extras];
      }
    }
  } catch {}

  const byId = new Map(UTILITY_CARDS.map((c) => [c.id, c]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean);
  return ordered.filter((c) => !c.adminOnly || isAdmin);
}

/** Persists a new ordering (array of card ids) to localStorage. */
export function saveCardOrder(order) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {}
}