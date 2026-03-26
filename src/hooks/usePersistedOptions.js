import { useState } from "react";

/**
 * Like useState but backed by localStorage so custom options survive page reloads.
 * key should be unique per field, e.g. "customOptions_benchmark_region"
 */
export function usePersistedOptions(key, defaults = []) {
  const storageKey = `app_custom_opts_${key}`;
  const [options, setOptions] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : defaults;
    } catch {
      return defaults;
    }
  });

  const addOption = (value) => {
    setOptions((prev) => {
      if (prev.includes(value)) return prev;
      const next = [...prev, value];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return [options, addOption];
}