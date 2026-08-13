import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

function pairKey(a, b) {
  return [a, b].sort().join("|");
}

/**
 * Generic duplicate-review (dismissal) hook for firms and products.
 * Loads accepted DuplicateReview records for the given entity_type and exposes
 * helpers to check whether a pair/group has been accepted and to accept (dismiss)
 * a pair or a whole group. Mirrors useDuplicateReviews (contacts) but uses the
 * generic record_a_id / record_b_id fields.
 *
 * @param {"firm"|"product"} entityType
 */
export function useEntityDuplicateReviews(entityType) {
  const queryClient = useQueryClient();

  const queryKey = ["duplicateReviews", entityType];

  const { data: reviews = [] } = useQuery({
    queryKey,
    queryFn: () =>
      base44.entities.DuplicateReview.filter({ entity_type: entityType }, "-created_date", 5000),
  });

  const acceptedKeys = useMemo(() => {
    const s = new Set();
    for (const r of reviews) {
      if (r.record_a_id && r.record_b_id) s.add(pairKey(r.record_a_id, r.record_b_id));
    }
    return s;
  }, [reviews]);

  const isPairAccepted = useCallback(
    (a, b) => !!(a && b) && acceptedKeys.has(pairKey(a, b)),
    [acceptedKeys]
  );

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
      await base44.entities.DuplicateReview.create({
        entity_type: entityType,
        record_a_id: a,
        record_b_id: b,
      });
      queryClient.invalidateQueries({ queryKey });
    },
    [queryClient, entityType, queryKey]
  );

  const acceptGroup = useCallback(
    async (group) => {
      if (!group || group.length < 2) return;
      const pairs = [];
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          pairs.push({
            entity_type: entityType,
            record_a_id: group[i].id,
            record_b_id: group[j].id,
          });
        }
      }
      if (pairs.length) await base44.entities.DuplicateReview.bulkCreate(pairs);
      queryClient.invalidateQueries({ queryKey });
    },
    [queryClient, entityType, queryKey]
  );

  return { reviews, isPairAccepted, isGroupAccepted, acceptPair, acceptGroup };
}