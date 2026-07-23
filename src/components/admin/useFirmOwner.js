import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useFirmOwner() {
  const { data = [] } = useQuery({
    queryKey: ["firm_owner"],
    queryFn: () => base44.entities.FirmOwner.list(),
  });
  return data[0] || null;
}