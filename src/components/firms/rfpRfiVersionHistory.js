/**
 * Version history helpers for RFP/RFI records.
 *
 * Tracks field-level changes (and proposal draft / file attachment changes)
 * so the user can see a full history of updates and previous drafts on each
 * RFP/RFI item.
 */

// Fields tracked in the version history, mapped to human-readable labels.
// file_url is tracked as "Proposal draft" since it represents the attached
// proposal document — a new upload is a new draft.
export const TRACKED_FIELDS = {
  title: "Title",
  rfp_type: "Type",
  posting_date: "Posting date",
  start_date: "Start date",
  questions_start_date: "Questions start",
  questions_end_date: "Questions end",
  due_date: "Due date",
  summary: "Summary",
  source_url: "Source link",
  file_url: "Proposal draft",
  file_name: "File name",
  notes: "Internal notes",
  progress_status: "Progress",
  decision_status: "Decision",
  product_match_status: "Product match",
  matched_product_names: "Matched products",
  product_match_summary: "Product match summary",
};

const MAX_TEXT_LEN = 120;

function summarize(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "";
  if (typeof value === "object") return JSON.stringify(value);
  const s = String(value);
  return s.length > MAX_TEXT_LEN ? s.slice(0, MAX_TEXT_LEN) + "…" : s;
}

function valuesEqual(a, b) {
  if (a === b) return true;
  const sa = summarize(a);
  const sb = summarize(b);
  return sa === sb;
}

/**
 * Compute the version-history entries for the changes between an original
 * record and an updated form payload. Returns an array of new version-history
 * entry objects (without ids assigned by the caller's append logic), one per
 * changed tracked field.
 *
 * @param {object} original - the saved record before the edit
 * @param {object} updated  - the new form payload being saved
 * @param {object} user     - current user ({ id, full_name })
 * @param {number} baseVersion - last version_number used (new entries start at baseVersion+1)
 * @returns {Array<object>} new version-history entries (empty array if nothing changed)
 */
export function buildVersionEntries(original, updated, user, baseVersion = 0) {
  if (!original || !updated) return [];
  const now = new Date().toISOString();
  const userName = user?.full_name || user?.email || "Unknown";
  const userId = user?.id || "";

  const entries = [];
  let versionNumber = baseVersion;

  Object.keys(TRACKED_FIELDS).forEach((field) => {
    const prev = original[field];
    const next = updated[field];
    if (valuesEqual(prev, next)) return;
    versionNumber += 1;
    entries.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${field}`,
      version_number: versionNumber,
      field,
      field_label: TRACKED_FIELDS[field],
      previous_value: summarize(prev),
      new_value: summarize(next),
      changed_by_id: userId,
      changed_by_name: userName,
      changed_date: now,
    });
  });

  return entries;
}

/**
 * Append new version-history entries to an existing version_history array,
 * returning the merged array (newest last). Caps the history to the most
 * recent 500 entries to keep the record size manageable.
 */
export function appendVersionHistory(existingHistory = [], newEntries = []) {
  if (!newEntries.length) return existingHistory || [];
  const merged = [...(existingHistory || []), ...newEntries];
  return merged.length > 500 ? merged.slice(merged.length - 500) : merged;
}