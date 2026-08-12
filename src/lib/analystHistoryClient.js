/**
 * Client-side re-export of the analyst history utilities.
 * The shared module lives in base44/shared/analystHistory.ts, but frontend
 * imports need a JS-compatible path. This thin wrapper re-exports the functions
 * so components can import from "@/lib/analystHistoryClient".
 */

// Inline implementations (mirrors base44/shared/analystHistory.ts) so the
// frontend doesn't need to resolve a .ts file through the Vite alias.

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function genId() {
  return `ah_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function initAnalystHistory(primaryId, primaryName, secondaryId, secondaryName) {
  const history = [];
  const today = todayISO();
  if (primaryId) {
    history.push({ id: genId(), analyst_type: "primary", contact_id: primaryId, contact_name: primaryName || "", start_date: today, end_date: null });
  }
  if (secondaryId) {
    history.push({ id: genId(), analyst_type: "secondary", contact_id: secondaryId, contact_name: secondaryName || "", start_date: today, end_date: null });
  }
  return history;
}

export function computeAnalystHistory(prevHistory, prevPrimaryId, prevSecondaryId, newPrimaryId, newPrimaryName, newSecondaryId, newSecondaryName) {
  const history = (prevHistory || []).map((e) => ({ ...e }));
  const today = todayISO();

  const prevP = prevPrimaryId || undefined;
  const nextP = newPrimaryId || undefined;
  if (prevP !== nextP) {
    const idx = history.findIndex((e) => e.analyst_type === "primary" && !e.end_date);
    if (idx >= 0) history[idx].end_date = today;
    if (nextP) {
      history.push({ id: genId(), analyst_type: "primary", contact_id: nextP, contact_name: newPrimaryName || "", start_date: today, end_date: null });
    }
  }

  const prevS = prevSecondaryId || undefined;
  const nextS = newSecondaryId || undefined;
  if (prevS !== nextS) {
    const idx = history.findIndex((e) => e.analyst_type === "secondary" && !e.end_date);
    if (idx >= 0) history[idx].end_date = today;
    if (nextS) {
      history.push({ id: genId(), analyst_type: "secondary", contact_id: nextS, contact_name: newSecondaryName || "", start_date: today, end_date: null });
    }
  }

  return history;
}

export function formatCoverageDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}