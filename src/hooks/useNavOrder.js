import { useState, useCallback, useEffect } from "react";

/**
 * Persists a navigation item order per user (keyed by email).
 * Returns [order, saveOrder] where `order` is an array of labels or null
 * (null = use default order). `saveOrder` persists to localStorage.
 */
export function useNavOrder(user) {
  const storageKey = user?.email
    ? `navOrder:${user.email}`
    : "navOrder:default";

  const [order, setOrder] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setOrder(saved ? JSON.parse(saved) : null);
    } catch {
      setOrder(null);
    }
  }, [storageKey]);

  const saveOrder = useCallback(
    (newOrder) => {
      setOrder(newOrder);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newOrder));
      } catch {
        /* ignore quota errors */
      }
    },
    [storageKey]
  );

  return [order, saveOrder];
}

/**
 * Reorders an array of nav items to match a saved label order.
 * Any items not in the saved order are appended at the end in their
 * original relative order (handles new items added after a save).
 */
export function reorderNavItems(items, savedOrder) {
  if (!savedOrder || !savedOrder.length) return items;
  const itemMap = new Map(items.map((it) => [it.label, it]));
  const ordered = savedOrder
    .map((label) => itemMap.get(label))
    .filter(Boolean);
  const placed = new Set(ordered.map((it) => it.label));
  const remaining = items.filter((it) => !placed.has(it.label));
  return [...ordered, ...remaining];
}