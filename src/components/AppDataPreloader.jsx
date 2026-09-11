import { useInfiniteEntity } from "@/hooks/useInfiniteEntity";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { fetchAllRecords } from "@/lib/fetchAllRecords";

/**
 * Preloads all entity data on app mount so every page has instant access
 * to the full dataset without per-page loading delays.
 * Shares the same React Query cache keys as Home.jsx so there is no
 * duplicate fetching — React Query deduplicates by key.
 */
export default function AppDataPreloader() {
  useInfiniteEntity({
    queryKey: ["firms-infinite"],
    fetchFn: () => fetchAllRecords("fetchAllFirms"),
    staleTime: 300000,
  });
  useInfiniteEntity({
    queryKey: ["products-infinite"],
    fetchFn: () => fetchAllRecords("fetchAllProducts"),
    staleTime: 300000,
  });
  useInfiniteEntity({
    queryKey: ["contacts-infinite"],
    fetchFn: () => fetchAllRecords("fetchAllContacts"),
    staleTime: 300000,
  });
  useInfiniteEntity({
    queryKey: ["portfolios-infinite"],
    fetchFn: () => fetchAllRecords("fetchAllPortfolios"),
    staleTime: 300000,
  });
  useQuery({
    queryKey: ["due-diligence-search"],
    queryFn: async () => {
      const res = await base44.functions.invoke("searchAppData", {
        action: "search",
        entity_name: "DueDiligence",
        filter: { deleted_at: null },
        limit: 5000,
        sort: "-created_date",
      });
      return res?.records || [];
    },
    staleTime: 300000,
  });
  return null;
}