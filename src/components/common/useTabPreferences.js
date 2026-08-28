import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * Per-user, per-form tab customization.
 *
 * @param {string} formId        Stable form identifier (e.g. "firm", "product", "contact").
 * @param {Array} defaultTabs   Array of { key, label } for the tabs currently
 *                              available for this form instance (already filtered
 *                              by firm type / product type / etc.), in default order.
 * @param {string} userId       The logged-in user's id (passed in by the caller).
 *                              Preferences are persisted to localStorage keyed by
 *                              formId + user id, so each user keeps their own layout.
 *
 * Default behavior (no saved prefs): every available tab is visible in the
 * default order — i.e. "see everything for that particular form based on the
 * firm type."
 */
export function useTabPreferences(formId, defaultTabs, userId = "anon") {
  const storageKey = `mk_tabprefs_${formId}_${userId || "anon"}`;

  const defaultKeys = useMemo(() => defaultTabs.map((t) => t.key), [defaultTabs]);
  const labelMap = useMemo(() => Object.fromEntries(defaultTabs.map((t) => [t.key, t.label])), [defaultTabs]);

  const [prefs, setPrefs] = useState(null);

  // Load saved preferences once per storage key.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setPrefs(raw ? JSON.parse(raw) : null);
    } catch {
      setPrefs(null);
    }
  }, [storageKey]);

  const save = useCallback(
    (next) => {
      setPrefs(next);
      try {
        if (next === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    },
    [storageKey]
  );

  // Ordered, visible tabs reconciled against the currently-available set.
  const visibleTabs = useMemo(() => {
    if (!prefs) return defaultTabs; // default: all visible in default order
    const hidden = new Set(prefs.hidden || []);
    const order = [...(prefs.order || defaultKeys)];
    // Append any new default keys (e.g. firm type changed) not yet in saved order.
    for (const k of defaultKeys) if (!order.includes(k)) order.push(k);
    return order
      .filter((k) => defaultKeys.includes(k) && !hidden.has(k))
      .map((k) => ({ key: k, label: labelMap[k] }))
      .filter((t) => t.label);
  }, [prefs, defaultTabs, defaultKeys, labelMap]);

  const hiddenTabs = useMemo(() => {
    if (!prefs) return [];
    const hidden = new Set(prefs.hidden || []);
    return defaultKeys.filter((k) => hidden.has(k)).map((k) => ({ key: k, label: labelMap[k] }));
  }, [prefs, defaultKeys, labelMap]);

  const toggleTab = useCallback(
    (key) => {
      const base = prefs || { order: defaultKeys, hidden: [] };
      const hidden = new Set(base.hidden || []);
      const visibleCount = defaultKeys.filter((k) => !hidden.has(k)).length;
      if (hidden.has(key)) {
        hidden.delete(key);
      } else {
        // Never allow hiding the last visible tab.
        if (visibleCount <= 1) return;
        hidden.add(key);
      }
      save({ order: base.order || defaultKeys, hidden: [...hidden] });
    },
    [prefs, defaultKeys, save]
  );

  const moveTab = useCallback(
    (key, dir) => {
      const base = prefs || { order: defaultKeys, hidden: [] };
      const order = [...(base.order || defaultKeys)];
      for (const k of defaultKeys) if (!order.includes(k)) order.push(k);
      const idx = order.indexOf(key);
      const target = dir === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || target < 0 || target >= order.length) return;
      [order[idx], order[target]] = [order[target], order[idx]];
      save({ order, hidden: base.hidden || [] });
    },
    [prefs, defaultKeys, save]
  );

  const reset = useCallback(() => save(null), [save]);

  return { visibleTabs, hiddenTabs, toggleTab, moveTab, reset, hasPrefs: !!prefs };
}