import { useState, useEffect, useCallback } from "react";

export const UNCAT_ID = "uncat";

/**
 * Reconcile a categories array against the active module list:
 *  - drop unknown item keys and de-duplicate keys appearing in multiple categories
 *  - ensure the system "Uncategorized" bucket exists and is last
 *  - place any module not assigned to a category into Uncategorized
 *  - drop default categories that have no items (e.g. role-gated categories the
 *    current user can't access) so they don't show as empty boxes
 */
function reconcile(categories, modules) {
  const allKeys = modules.map((m) => m.key);
  const seen = new Set();
  const cleaned = (categories || [])
    .map((c) => ({
      ...c,
      items: (c.items || []).filter((k) => {
        if (seen.has(k) || !allKeys.includes(k)) return false;
        seen.add(k);
        return true;
      }),
    }))
    .filter((c) => c.id === UNCAT_ID || c.isSystem || c.items.length > 0);

  const withoutUncat = cleaned.filter((c) => c.id !== UNCAT_ID);
  const uncat = cleaned.find((c) => c.id === UNCAT_ID) || { id: UNCAT_ID, name: "Uncategorized", isSystem: true, items: [] };
  const missing = allKeys.filter((k) => !seen.has(k));
  uncat.items = [...uncat.items, ...missing];
  return [...withoutUncat, { ...uncat, isSystem: true }];
}

function load(storageKey, modules, defaultCategories) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return reconcile(JSON.parse(raw).categories || [], modules);
  } catch {
    /* ignore corrupt storage */
  }
  return reconcile(defaultCategories, modules);
}

/**
 * Generic per-user section layout: an ordered list of categories, each holding
 * an ordered list of module keys. Persisted to localStorage under `storageKey`.
 * Supports drag reordering within/across categories and create/rename/delete
 * categories. `modules` is the active module list; `defaultCategories` is the
 * default layout used on first load. Shared by every Monitor-style section.
 */
export function useSectionLayout(modules, defaultCategories, storageKey) {
  const [categories, setCategories] = useState(() => load(storageKey, modules, defaultCategories));

  // Re-reconcile when the active module set changes so newly-eligible modules
  // appear and removed ones drop out.
  useEffect(() => {
    setCategories((prev) => reconcile(prev, modules));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ categories }));
    } catch {
      /* ignore quota errors */
    }
  }, [categories, storageKey]);

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