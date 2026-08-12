/**
 * Analyst coverage history utilities.
 *
 * Tracks primary and secondary analyst assignments on Due Diligence records
 * with start/end dates so coverage can be audited over time.
 */

/** Returns today's date in YYYY-MM-DD format (local time). */
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Generate a simple unique ID. */
function genId(): string {
  return `ah_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface AnalystHistoryEntry {
  id: string;
  analyst_type: "primary" | "secondary";
  contact_id: string;
  contact_name: string;
  start_date: string;
  end_date?: string | null;
}

/**
 * Build the initial analyst_history array for a brand-new Due Diligence record.
 * Creates an open entry (no end_date) for each assigned analyst.
 */
export function initAnalystHistory(
  primaryId: string | undefined,
  primaryName: string,
  secondaryId: string | undefined,
  secondaryName: string,
): AnalystHistoryEntry[] {
  const history: AnalystHistoryEntry[] = [];
  const today = todayISO();

  if (primaryId) {
    history.push({
      id: genId(),
      analyst_type: "primary",
      contact_id: primaryId,
      contact_name: primaryName || "",
      start_date: today,
      end_date: null,
    });
  }
  if (secondaryId) {
    history.push({
      id: genId(),
      analyst_type: "secondary",
      contact_id: secondaryId,
      contact_name: secondaryName || "",
      start_date: today,
      end_date: null,
    });
  }

  return history;
}

/**
 * Compute the updated analyst_history when an existing Due Diligence record's
 * analysts change. Closes out (sets end_date) any open entry whose analyst was
 * removed or replaced, and opens a new entry (start_date = today) for any new
 * assignment.
 *
 * @param prevHistory  - The record's existing analyst_history array
 * @param prevPrimaryId  - The previous primary analyst contact ID (from the saved record)
 * @param prevSecondaryId - The previous secondary analyst contact ID
 * @param newPrimaryId   - The new primary analyst contact ID
 * @param newPrimaryName - The new primary analyst name
 * @param newSecondaryId - The new secondary analyst contact ID
 * @param newSecondaryName - The new secondary analyst name
 */
export function computeAnalystHistory(
  prevHistory: AnalystHistoryEntry[] | undefined | null,
  prevPrimaryId: string | undefined,
  prevSecondaryId: string | undefined,
  newPrimaryId: string | undefined,
  newPrimaryName: string,
  newSecondaryId: string | undefined,
  newSecondaryName: string,
): AnalystHistoryEntry[] {
  const history: AnalystHistoryEntry[] = (prevHistory || []).map((e) => ({ ...e }));
  const today = todayISO();

  // --- Primary analyst ---
  const prevPrimary = prevPrimaryId || undefined;
  const nextPrimary = newPrimaryId || undefined;

  if (prevPrimary !== nextPrimary) {
    // Close out the previous primary's open entry (if any)
    const openPrimaryIdx = history.findIndex(
      (e) => e.analyst_type === "primary" && !e.end_date,
    );
    if (openPrimaryIdx >= 0) {
      history[openPrimaryIdx].end_date = today;
    }
    // Open a new entry for the new primary
    if (nextPrimary) {
      history.push({
        id: genId(),
        analyst_type: "primary",
        contact_id: nextPrimary,
        contact_name: newPrimaryName || "",
        start_date: today,
        end_date: null,
      });
    }
  }

  // --- Secondary analyst ---
  const prevSecondary = prevSecondaryId || undefined;
  const nextSecondary = newSecondaryId || undefined;

  if (prevSecondary !== nextSecondary) {
    // Close out the previous secondary's open entry (if any)
    const openSecondaryIdx = history.findIndex(
      (e) => e.analyst_type === "secondary" && !e.end_date,
    );
    if (openSecondaryIdx >= 0) {
      history[openSecondaryIdx].end_date = today;
    }
    // Open a new entry for the new secondary
    if (nextSecondary) {
      history.push({
        id: genId(),
        analyst_type: "secondary",
        contact_id: nextSecondary,
        contact_name: newSecondaryName || "",
        start_date: today,
        end_date: null,
      });
    }
  }

  return history;
}

/**
 * Format an ISO date (YYYY-MM-DD) as MM/DD/YYYY for display.
 * Returns "—" if the value is empty/null.
 */
export function formatCoverageDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}