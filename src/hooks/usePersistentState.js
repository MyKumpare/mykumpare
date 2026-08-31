import { useState, useEffect, useCallback, useRef } from "react";

/**
 * usePersistentState — a drop-in replacement for useState that survives
 * app interruptions (mobile OS killing the WebView, tab switch, etc.).
 *
 * State is kept in memory for instant access and flushed to sessionStorage
 * when the app goes to background (visibilitychange → hidden, pagehide,
 * beforeunload). On the next app load the saved value is restored
 * automatically, so open dialogs and in-progress edits reappear.
 *
 * "Empty" values (false / null / undefined / "") are treated as
 * "nothing to restore" and are removed from sessionStorage, so a dialog
 * that was intentionally closed does not reopen on next load.
 *
 * Stale sessions (older than 30 minutes) are cleared on module load to
 * avoid restoring ancient work.
 *
 * Usage:
 *   const [open, setOpen] = usePersistentState("myDialog_open", false);
 *   const [editing, setEditing] = usePersistentState("myDialog_editing", null);
 *
 * @param {string} key        — unique storage key (prefix automatically added)
 * @param {*}      initialValue — same contract as useState
 * @returns {[any, Function, Function]} [value, setValue, clear]
 *   setValue works exactly like useState's setter.
 *   clear() removes the persisted value and resets to initialValue.
 */

const PREFIX = "ps_";
const TS_KEY = "ps_timestamp";
const MAX_AGE = 30 * 60 * 1000; // 30 minutes

// Global registry: key → ref to current value (for bulk flush)
const registry = new Map();

function isEmpty(v) {
  return v === false || v === null || v === undefined || v === "";
}

function flushAll() {
  for (const [key, ref] of registry) {
    try {
      const v = ref.current;
      if (isEmpty(v)) {
        sessionStorage.removeItem(PREFIX + key);
      } else {
        sessionStorage.setItem(PREFIX + key, JSON.stringify(v));
      }
    } catch {
      /* sessionStorage might be full or unavailable — silently skip */
    }
  }
  try {
    sessionStorage.setItem(TS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

// Set up global listeners once
if (typeof window !== "undefined" && !window.__psInit) {
  window.__psInit = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
  window.addEventListener("pagehide", flushAll);
  window.addEventListener("beforeunload", flushAll);
  // Save when the window loses focus (cursor moved to another app/tab/element)
  window.addEventListener("blur", flushAll);
}

// Clear stale sessions on module load
if (typeof window !== "undefined") {
  try {
    const ts = sessionStorage.getItem(TS_KEY);
    if (ts && Date.now() - parseInt(ts, 10) > MAX_AGE) {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(PREFIX)) sessionStorage.removeItem(k);
      }
      sessionStorage.removeItem(TS_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function usePersistentState(key, initialValue) {
  const ref = useRef(null);

  const [value, setValue] = useState(() => {
    try {
      const saved = sessionStorage.getItem(PREFIX + key);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        ref.current = parsed;
        return parsed;
      }
    } catch {
      /* ignore */
    }
    const init =
      typeof initialValue === "function" ? initialValue() : initialValue;
    ref.current = init;
    return init;
  });

  // Keep ref in sync with latest value
  useEffect(() => {
    ref.current = value;
  }, [value]);

  // Register / unregister with the global registry
  useEffect(() => {
    registry.set(key, ref);
    return () => {
      registry.delete(key);
    };
  }, [key]);

  // When value becomes "empty", remove from sessionStorage so it
  // doesn't reopen on next load (dialog was intentionally closed)
  useEffect(() => {
    if (isEmpty(value)) {
      try {
        sessionStorage.removeItem(PREFIX + key);
      } catch {
        /* ignore */
      }
    }
  }, [key, value]);

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
    const init =
      typeof initialValue === "function" ? initialValue() : initialValue;
    ref.current = init;
    setValue(init);
  }, [key, initialValue]);

  return [value, setValue, clear];
}