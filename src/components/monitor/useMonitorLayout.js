import { useState, useEffect, useCallback } from "react";
import { MONITOR_MODULES } from "./monitorModules";

const STORAGE_KEY = "monitor_layout_v1";
export const UNCAT_ID = "uncat";

/** Sensible default categorization so the grid is organized out of the box. */
const DEFAULT_CATEGORIES = [
  { id: "alerts", name: "Alerts", items: ["news", "scoring-alerts", "board-meeting-alerts", "stale-contacts"] },
  { id: "activity-tasks", name: "Activity & Tasks", items: ["activity", "tasks", "timeline"] },
  { id: "reviews", name: "Reviews", items: ["score-trends", "firm-score-trends-6mo", "benchmark-comparison", "rfp-rfi"] },
  { id: "meetings", name: "Meetings & Events", items: ["conferences", "board-meetings"] },
  { id: "coverage", name: "Coverage", items: ["coverage", "coverage-mgmt"] },
];

/**
 * Reconcile a categories array against the master module list:
 *  - drop unknown item keys and de-duplicate keys appearing in multiple categories
 *  - ensure the system "Uncategorized" bucket exists and is last
 *  - place any module not assigned to a category into Uncategorized
 */
function reconcile(categories) {
  const allKeys = MONITOR_MODULES.map((m) => m.key);
  const seen = new Set();
  const cleaned = (categories || []).map((c) => ({
    ...c,
    items: (c.items || []).filter((k) => {
      if (seen.has(k) || !allKeys.includes(k)) return false;
      seen.add(k);
      return true;
    }),
  }));

  const withoutUncat = cleaned.filter((c) => c.id !== UNCAT_ID);
  const uncat = cleaned.find((c) => c.id === UNCAT_ID) || { id: UNCAT_ID, name: "Uncategorized", isSystem: true, items: [] };
  const missing = allKeys.filter((k) => !seen.has(k));
  uncat.items = [...uncat.items, ...missing];
  return [...withoutUncat, { ...uncat, isSystem: true }];
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return reconcile(JSON.parse(raw).categories || []);
  } catch {
    /* ignore corrupt storage */
  }
  return reconcile(DEFAULT_CATEGORIES);
}

/**
 * Per-user Monitor layout: an ordered list of categories, each holding an
 * ordered list of module keys. Persisted to localStorage. Supports drag
 * reordering within/across categories and create/rename/delete categories.
 */
export function useMonitorLayout() {
  const [categories, setCategories] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categories }));
    } catch {
      /* ignore quota errors */
    }
  }, [categories]);

  const addCategory = useCallback((name) => {
    const id = `cat-${Date.now()}`;
    setCategories((prev) => {
      const uncat = prev.find((c) => c.id === UNCAT_ID);
      const others = prev.filter((c) => c.id !== UNCAT_ID);
      return [...others, { id, name, items: [] }, uncat];
    });
    return id;
  }, []);

  const renameCategory = useCallback((id, name) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  const deleteCategory = useCallback((id) => {
    setCategories((prev) => {
      const cat = prev.find((c) => c.id === id);
      if (!cat || cat.isSystem) return prev;
      const uncat = prev.find((c) => c.id === UNCAT_ID);
      const others = prev.filter((c) => c.id !== id && c.id !== UNCAT_ID);
      return [...others, { ...uncat, items: [...uncat.items, ...cat.items] }];
    });
  }, []);

  const moveCategory = useCallback((id, dir) => {
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx < 0) return prev;
      const target = dir === "up" ? idx - 1 : idx + 1;
      // uncat is always last (prev.length - 1); never swap with it or past it
      if (target < 0 || target >= prev.length - 1) return prev;
      if (prev[target].isSystem) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const onDragEnd = useCallback((result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    setCategories((prev) => {
      const next = prev.map((c) => ({ ...c, items: [...c.items] }));
      const srcCat = next.find((c) => c.id === source.droppableId);
      const destCat = next.find((c) => c.id === destination.droppableId);
      if (!srcCat || !destCat) return prev;
      const [moved] = srcCat.items.splice(source.index, 1);
      destCat.items.splice(destination.index, 0, moved);
      return next;
    });
  }, []);

  return { categories, addCategory, renameCategory, deleteCategory, moveCategory, onDragEnd };
}