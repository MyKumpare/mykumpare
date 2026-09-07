import { useState, useEffect } from "react";

/**
 * useDebouncedValue — returns a debounced copy of the input value.
 * The returned value only updates after `delay` ms has passed without
 * the input changing, which is useful for search inputs that trigger
 * expensive server-side queries.
 *
 * @param {*} value    — the value to debounce
 * @param {number} delay — debounce delay in ms (default 400)
 * @returns {*} the debounced value
 */
export function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}