import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Manages the user's pinned dashboard report keys, persisted to the user
 * profile via base44.auth.updateMe. Pinned charts auto-open (render inline)
 * at the top of the Dashboard page in the stored order.
 */
export function usePinnedReports() {
  const [pinnedKeys, setPinnedKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    base44.auth
      .me()
      .then((me) => {
        if (mounted) {
          setPinnedKeys(Array.isArray(me?.pinned_dashboard_reports) ? me.pinned_dashboard_reports : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback((next) => {
    base44.auth.updateMe({ pinned_dashboard_reports: next }).catch(() => {});
  }, []);

  const togglePin = useCallback(
    (key) => {
      setPinnedKeys((prev) => {
        const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const reorderPinned = useCallback(
    (newKeys) => {
      setPinnedKeys(newKeys);
      persist(newKeys);
    },
    [persist]
  );

  return { pinnedKeys, togglePin, reorderPinned, loading };
}