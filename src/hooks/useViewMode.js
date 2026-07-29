import { useState, useCallback } from "react";

/**
 * Persists a view mode ("list" | "card" | "kanban") per section in localStorage.
 */
export function useViewMode(sectionName) {
  const storageKey = `app_view_mode_${sectionName}`;
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || "list";
    } catch {
      return "list";
    }
  });

  const setMode = useCallback((mode) => {
    setViewMode(mode);
    try { localStorage.setItem(storageKey, mode); } catch {}
  }, [storageKey]);

  return [viewMode, setMode];
}