import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Building2, CalendarClock, Package, Star, ExternalLink } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/**
 * Influence Score — a quick at-a-glance metric showing how well-connected
 * a contact is across the platform's firm and board-meeting graph.
 *
 * Formula:
 *   firms linked        = unique firms (direct firm_ids + firms where the
 *                        contact sits on a product's investment team)
 *   boards linked       = board meetings for any of those firms
 *   product team seats  = products whose investment_team includes this contact
 *
 *   score = firms + (boards * 2) + teamSeats
 *
 * Tiers:
 *   0–2   Emerging
 *   3–7   Connected
 *   8–15  Influencer
 *   16+   Key Influencer
 *
 * The firm / board / product metric chips are clickable — a popover lists
 * the actual linked entities. Items that exist in the system are clickable
 * links that navigate to the firm or product profile.
 */

const TIERS = [
  { min: 16, label: "Key Influencer", classes: "bg-amber-50 text-amber-700 border-amber-200", star: "text-amber-500" },
  { min: 8, label: "Influencer", classes: "bg-indigo-50 text-indigo-700 border-indigo-200", star: "text-indigo-500" },
  { min: 3, label: "Connected", classes: "bg-blue-50 text-blue-700 border-blue-200", star: "text-blue-500" },
  { min: 0, label: "Emerging", classes: "bg-gray-50 text-gray-600 border-gray-200", star: "text-gray-400" },
];

function getTier(score) {
  return TIERS.find((t) => score >= t.min);
}

/* ── Metric chip with popover list ── */
function MetricChip({ icon: Icon, count, label, items, emptyText, onNavigate, clickable }) {
  const [open, setOpen] = useState(false);

  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400" title={label}>
        <Icon className="w-3 h-3" /> {count}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-[10px] text-gray-600 hover:text-primary transition-colors rounded px-0.5 hover:bg-indigo-50"
          title={`${label} — click to view list`}
        >
          <Icon className="w-3 h-3" /> {count}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" sideOffset={6}>
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-gray-800">{label}</span>
          <span className="ml-auto text-[10px] text-gray-400">{count} linked</span>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-400 italic text-center">{emptyText}</p>
          ) : (
            items.map((item, i) => (
              <button
                key={i}
                type="button"
                disabled={!clickable || !item.onNavigate}
                onClick={() => {
                  if (clickable && item.onNavigate) {
                    setOpen(false);
                    item.onNavigate(item.entity);
                  }
                }}
                className={`w-full text-left px-3 py-2 border-b border-gray-50 last:border-0 flex items-start gap-2 ${
                  clickable && item.onNavigate
                    ? "hover:bg-indigo-50 cursor-pointer"
                    : "cursor-default"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.label}</p>
                  {item.sublabel && (
                    <p className="text-[10px] text-gray-500 truncate">{item.sublabel}</p>
                  )}
                </div>
                {clickable && item.onNavigate && (
                  <ExternalLink className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ContactInfluenceScore({ contactId, firmIds = [], firms = [], onFirmClick, onProductClick }) {
  const directFirmIds = firmIds;

  // Board meetings for each direct firm
  const boardQueries = useQuery({
    queryKey: ["contactInfluenceBoards", contactId, directFirmIds.join(",")],
    queryFn: async () => {
      if (!directFirmIds.length) return [];
      const results = await Promise.all(
        directFirmIds.map((fid) =>
          base44.entities.BoardMeeting.filter({ firm_id: fid }, "-meeting_date", 500)
        )
      );
      const seen = new Set();
      const all = [];
      results.forEach((list) => {
        (Array.isArray(list) ? list : []).forEach((m) => {
          if (!seen.has(m.id)) { seen.add(m.id); all.push(m); }
        });
      });
      return all;
    },
    enabled: !!contactId && directFirmIds.length > 0,
    staleTime: 60_000,
  });

  // Products for each direct firm — to find investment-team seats
  const productQueries = useQuery({
    queryKey: ["contactInfluenceProducts", contactId, directFirmIds.join(",")],
    queryFn: async () => {
      if (!directFirmIds.length) return [];
      const results = await Promise.all(
        directFirmIds.map((fid) =>
          base44.entities.Product.filter({ firm_id: fid }, "-created_date", 500)
        )
      );
      const seen = new Set();
      const all = [];
      results.forEach((list) => {
        (Array.isArray(list) ? list : []).forEach((p) => {
          if (!seen.has(p.id)) { seen.add(p.id); all.push(p); }
        });
      });
      return all;
    },
    enabled: !!contactId && directFirmIds.length > 0,
    staleTime: 60_000,
  });

  const loading = boardQueries.isLoading || productQueries.isLoading;

  // Products where this contact sits on the investment team
  const teamProducts = (productQueries.data || []).filter((p) =>
    Array.isArray(p.investment_team) &&
    p.investment_team.some((m) => m.contact_id === contactId)
  );

  // Firms linked via investment-team products (may include firms not in firm_ids)
  const teamFirmIds = teamProducts
    .map((p) => p.firm_id)
    .filter((fid) => fid && !directFirmIds.includes(fid));
  const allFirmIds = [...directFirmIds, ...teamFirmIds];

  const firmCount = allFirmIds.length;
  const boardCount = (boardQueries.data || []).length;
  const teamSeatCount = teamProducts.length;

  const score = firmCount + boardCount * 2 + teamSeatCount;
  const tier = getTier(score);

  // Build list items for each popover
  const firmItems = allFirmIds.map((fid) => {
    const firm = firms.find((f) => f.id === fid);
    return {
      label: firm?.name || "Unknown firm",
      sublabel: firm?.firm_type || (firm?.firm_types?.length ? firm.firm_types.join(", ") : ""),
      entity: firm,
      onNavigate: onFirmClick && firm ? (f) => onFirmClick(f) : null,
    };
  });

  const boardItems = (boardQueries.data || []).map((m) => {
    const firm = firms.find((f) => f.id === m.firm_id);
    return {
      label: m.title || "Untitled meeting",
      sublabel: [
        m.meeting_date ? new Date(m.meeting_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "",
        firm?.name || m.firm_name || "",
      ].filter(Boolean).join(" · "),
      entity: firm,
      onNavigate: onFirmClick && firm ? (f) => onFirmClick(f) : null,
    };
  });

  const productItems = teamProducts.map((p) => {
    const firm = firms.find((f) => f.id === p.firm_id);
    return {
      label: p.name || "Untitled product",
      sublabel: [firm?.name || p.firm_name || "", p.product_type].filter(Boolean).join(" · "),
      entity: p,
      onNavigate: onProductClick ? (prod) => onProductClick(prod) : null,
    };
  });

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-200">
        <Star className="w-3 h-3 animate-pulse" />
        Calculating…
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tier.classes}`}
        title={`Firms: ${firmCount}  ·  Boards: ${boardCount}  ·  Team seats: ${teamSeatCount}`}
      >
        <Star className={`w-3 h-3 ${tier.star}`} />
        {score} · {tier.label}
      </span>
      <MetricChip
        icon={Building2}
        count={firmCount}
        label="Linked Firms"
        items={firmItems}
        emptyText="No firms linked"
        clickable
      />
      <MetricChip
        icon={CalendarClock}
        count={boardCount}
        label="Board Meetings"
        items={boardItems}
        emptyText="No board meetings linked"
        clickable
      />
      {teamSeatCount > 0 && (
        <MetricChip
          icon={Package}
          count={teamSeatCount}
          label="Product Team Seats"
          items={productItems}
          emptyText="No product team seats"
          clickable
        />
      )}
    </div>
  );
}