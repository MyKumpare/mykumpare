import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Building2, CalendarClock, Package, Star } from "lucide-react";

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

export default function ContactInfluenceScore({ contactId, firmIds = [], firms = [] }) {
  // Gather all firm IDs to query — direct links plus firms where the contact
  // is on a product investment team. We query products for each direct firm to
  // find investment-team seats, and board meetings for each firm.
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
      // Flatten and dedupe by id (a meeting could theoretically appear once per firm)
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
      <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500" title="Firms linked">
        <Building2 className="w-3 h-3" /> {firmCount}
      </span>
      <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500" title="Board meetings linked">
        <CalendarClock className="w-3 h-3" /> {boardCount}
      </span>
      {teamSeatCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500" title="Product investment-team seats">
          <Package className="w-3 h-3" /> {teamSeatCount}
        </span>
      )}
    </div>
  );
}