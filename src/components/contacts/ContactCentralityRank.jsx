import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Trophy, Network, GitBranch, Weight, Loader2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/**
 * ContactCentralityRank — shows a contact's network-centrality influence rank
 * on their profile, computed from the full contact graph (degree, betweenness,
 * connection strength, composite importance).
 *
 * Displays a compact rank badge (tier + percentile) with a popover that breaks
 * down the underlying centrality metrics so the user can see WHY a contact is
 * ranked highly.
 */

const TIER_STYLES = {
  "Key Stakeholder": { badge: "bg-amber-50 text-amber-700 border-amber-300", star: "text-amber-500" },
  "Influencer": { badge: "bg-violet-50 text-violet-700 border-violet-300", star: "text-violet-500" },
  "Connector": { badge: "bg-indigo-50 text-indigo-700 border-indigo-300", star: "text-indigo-500" },
  "Emerging": { badge: "bg-blue-50 text-blue-700 border-blue-300", star: "text-blue-400" },
  "Isolated": { badge: "bg-gray-50 text-gray-500 border-gray-200", star: "text-gray-300" },
};

function MetricRow({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="text-xs text-gray-600">{label}</span>
      <span className="ml-auto text-xs font-semibold text-gray-800">{value}</span>
      {hint && <span className="text-[10px] text-gray-400 ml-1">{hint}</span>}
    </div>
  );
}

export default function ContactCentralityRank({ contactId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["contactCentrality", contactId],
    queryFn: async () => {
      const res = await base44.functions.invoke("computeContactCentrality", { contact_id: contactId });
      return res?.data ?? res;
    },
    enabled: !!contactId,
    staleTime: 5 * 60 * 1000, // cache for 5 min — full-graph computation
  });

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-200">
        <Loader2 className="w-3 h-3 animate-spin" />
        Calculating rank…
      </span>
    );
  }

  if (error || !data) {
    // Silently fail — the rank is supplementary info, not critical
    return null;
  }

  const tier = data.tier || "Isolated";
  const styles = TIER_STYLES[tier] || TIER_STYLES["Isolated"];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles.badge} hover:shadow-sm transition-shadow`}
          title="Network centrality rank — click for details"
        >
          <Trophy className={`w-3 h-3 ${styles.star}`} />
          {tier}
          {data.rank ? ` · #${data.rank}` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" sideOffset={6}>
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Trophy className={`w-4 h-4 ${styles.star}`} />
            <span className="text-sm font-semibold text-gray-800">{tier}</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Network centrality rank{data.rank ? ` — #${data.rank} of ${data.totalConnected} connected contacts` : ""}
          </p>
        </div>
        <div className="px-3 py-2">
          <MetricRow
            icon={Network}
            label="Degree"
            value={data.degree}
            hint="direct connections"
          />
          <MetricRow
            icon={GitBranch}
            label="Betweenness"
            value={data.betweenness}
            hint="bridge paths"
          />
          <MetricRow
            icon={Weight}
            label="Connection strength"
            value={data.totalStrength}
            hint="total edge weight"
          />
          <MetricRow
            icon={Trophy}
            label="Importance score"
            value={data.importance}
          />
          {data.percentile !== null && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-center">
              <span className="text-[11px] font-medium text-gray-700">
                Top {100 - data.percentile}% of network
              </span>
              <span className="block text-[10px] text-gray-400">
                {data.percentile}th percentile
              </span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}