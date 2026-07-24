import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Sentinel value used when a due diligence record has not yet started a stage.
export const DD_STAGE_NOT_STARTED = "Not Started";

// Fetches the ordered master list of due diligence stages.
export function useDueDiligenceStages() {
  const { data = [], ...rest } = useQuery({
    queryKey: ["due-diligence-stages"],
    queryFn: async () => {
      const list = await base44.entities.DueDiligenceStage.list();
      return list
        .filter((s) => s && s.name)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    },
  });
  return { stages: data, ...rest };
}

// Renders the human-readable label for a stage value:
//  - "" or "Not Started"  -> "Not Started"
//  - a known stage name     -> "Stage N - name" (N = position in the sorted list)
//  - an unknown/removed name -> "Not Started" (graceful fallback)
export function formatStageLabel(stageName, stages) {
  if (!stageName || stageName === DD_STAGE_NOT_STARTED) return DD_STAGE_NOT_STARTED;
  const idx = stages.findIndex((s) => s.name === stageName);
  if (idx === -1) return DD_STAGE_NOT_STARTED;
  return `Stage ${idx + 1} - ${stages[idx].name}`;
}