import { useState, useCallback } from "react";

const STORAGE_KEY_PREFIX = "filterSidebar_hiddenGroups_";

/**
 * Persists which filter groups are hidden in the sidebar for a given section.
 * Stored per-section in localStorage as a JSON array of group keys.
 */
export function useFilterSidebarPrefs(sectionKey) {
  const storageKey = STORAGE_KEY_PREFIX + sectionKey;

  const [hiddenGroups, setHiddenGroupsState] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleGroup = useCallback(
    (key) => {
      setHiddenGroupsState((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        try {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    },
    [storageKey]
  );

  const setHiddenGroups = useCallback(
    (newSet) => {
      setHiddenGroupsState(newSet);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)));
      } catch {}
    },
    [storageKey]
  );

  return { hiddenGroups, toggleGroup, setHiddenGroups };
}