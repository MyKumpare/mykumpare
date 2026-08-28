import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

/**
 * Loads and persists section layouts (per-user and firmwide) from the
 * SectionLayout entity. Works alongside the localStorage-based working copy
 * in useSectionLayout: the working copy is the user's in-progress edit, and
 * the saved records here are explicit "save" / "load" actions.
 *
 * Returns:
 *  - userLayout: the current user's saved layout record (or null)
 *  - firmwideLayout: the firmwide saved layout record (or null)
 *  - isLoading: true while fetching
 *  - saveLayout({ scope, categories }): creates or updates the saved record
 *  - isSaving: true while a save is in flight
 *  - saveError: error message from the last save attempt (null on success)
 */
export function useSavedSectionLayout(section) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = user?.data?.linked_firm_id;

  const { data: layouts = [], isLoading } = useQuery({
    queryKey: ["section_layouts", section],
    queryFn: () => base44.entities.SectionLayout.filter({ section }),
    enabled: !!section,
  });

  const userLayout = layouts.find(
    (l) => l.scope === "user" && l.user_id === user?.id
  );
  const firmwideLayout = layouts.find((l) => l.scope === "firmwide");

  const saveMutation = useMutation({
    mutationFn: async ({ scope, categories }) => {
      const existing = scope === "user" ? userLayout : firmwideLayout;
      const payload = {
        tenant_id: tenantId,
        section,
        scope,
        user_id: scope === "user" ? user?.id || "" : "",
        user_name: scope === "user" ? user?.full_name || user?.email || "" : "",
        categories,
        updated_at_label: new Date().toLocaleString(),
      };
      if (existing) {
        return base44.entities.SectionLayout.update(existing.id, payload);
      }
      return base44.entities.SectionLayout.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section_layouts", section] });
    },
  });

  return {
    userLayout,
    firmwideLayout,
    isLoading,
    saveLayout: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error?.message || null,
  };
}