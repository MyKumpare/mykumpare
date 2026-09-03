import React from "react";
import { CheckCircle2, Clock, Eye } from "lucide-react";

// Derives a coverage status from a product's Xponance analyst assignments.
//   Active       — primary analyst assigned (coverage in place)
//   Pending      — only a secondary analyst assigned (pending primary coverage)
//   Under Review — no analyst assigned (awaiting coverage decision)
export function getCoverageStatus(product) {
  if (product.primary_xponance_contact_id) return "active";
  if (product.secondary_xponance_contact_id) return "pending";
  return "under_review";
}

export const COVERAGE_STATUS_META = {
  active: {
    label: "Active",
    Icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "Pending",
    Icon: Clock,
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  under_review: {
    label: "Under Review",
    Icon: Eye,
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
};

export default function CoverageStatusBadge({ product, size = "sm" }) {
  const status = getCoverageStatus(product);
  const meta = COVERAGE_STATUS_META[status];
  const { Icon } = meta;
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${meta.badge} ${pad}`}
      title={`Coverage status: ${meta.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {meta.label}
    </span>
  );
}