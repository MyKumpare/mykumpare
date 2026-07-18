import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

function pairKey(a, b) {
  return [a, b].sort().join("|");
}

/**
 * Loads accepted (dismissed) duplicate pairs from the DuplicateReview entity
 * and exposes helpers to check whether a pair/group has been accepted and to
 * accept (dismiss) a pair or a whole group.
 */
export function useDuplicateReviews() {
  const queryClient = useQueryClient();

  const { data: reviews = [] } = useQuery({
    queryKey: ["duplicateReviews"],
    queryFn: () => base44.entities.DuplicateReview.list("-created_date", 5000),
  });

  const acceptedKeys = useMemo(() => {
    const s = new Set();
    for (const r of reviews) {
      if (r.contact_a_id && r.contact_b_id) s.add(pairKey(r.contact_a_id, r.contact_b_id));
    }
    return s;
  }, [reviews]);

  const isPairAccepted = useCallback(
    (a, b) => !!(a && b) && acceptedKeys.has(pairKey(a, b)),
    [acceptedKeys]
  );

  // A group is considered accepted only when EVERY pair within it has been
  // dismissed. Adding a new contact to the group re-surfaces it for review.
  const isGroupAccepted = useCallback(
    (group) => {
      if (!group || group.length < 2) return false;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (!acceptedKeys.has(pairKey(group[i].id, group[j].id))) return false;
        }
      }
      return true;
    },
    [acceptedKeys]
  );

  const acceptPair = useCallback(
    async (a, b) => {
      if (!a || !b) return;
      await base44.entities.DuplicateReview.create({ contact_a_id: a, contact_b_id: b });
      queryClient.invalidateQueries({ queryKey: ["duplicateReviews"] });
    },
    [queryClient]
  );

  const acceptGroup = useCallback(
    async (group) => {
      if (!group || group.length < 2) return;
      const pairs = [];
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          pairs.push({ contact_a_id: group[i].id, contact_b_id: group[j].id });
        }
      }
      if (pairs.length) await base44.entities.DuplicateReview.bulkCreate(pairs);
      queryClient.invalidateQueries({ queryKey: ["duplicateReviews"] });
    },
    [queryClient]
  );

  return { reviews, isPairAccepted, isGroupAccepted, acceptPair, acceptGroup };
}