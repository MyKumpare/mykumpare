// Shared audit-history helpers for Firm and Product records.
// Builds audit entries by diffing the current record against incoming update
// data, then appends them to the record's audit_history array on save.

function isEmpty(v) {
  if (v == null) return true;
  if (v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

// Keep stored values small so the audit array never bloats the record.
// Always returns a string — the audit_history.new_value / previous_value
// schema fields are typed as string, so null/number/boolean/object must be
// stringified to pass entity validation.
function summarizeValue(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.length > 300 ? v.slice(0, 300) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 300 ? s.slice(0, 300) + "…" : s;
  } catch {
    return String(v);
  }
}

// Fields that should never produce audit entries.
const SKIP_FIELDS = new Set([
  "audit_history",
  "created_date",
  "updated_date",
  "created_by_id",
  "tenant_id",
]);

// Returns an array of audit entries (one per changed field) comparing the
// current record against the incoming update data.
export function buildAuditEntries(currentRecord, newData, user) {
  if (!currentRecord || !newData) return [];
  const entries = [];
  const changedById = user?.id || "";
  const changedByName = user?.full_name || user?.email || "";
  const changedDate = new Date().toISOString();
  for (const [field, newVal] of Object.entries(newData)) {
    if (SKIP_FIELDS.has(field)) continue;
    const oldVal = currentRecord[field];
    if (JSON.stringify(oldVal ?? null) === JSON.stringify(newVal ?? null)) continue;
    if (isEmpty(oldVal) && isEmpty(newVal)) continue;
    entries.push({
      id: crypto.randomUUID(),
      field,
      previous_value: summarizeValue(oldVal),
      new_value: summarizeValue(newVal),
      changed_by_id: changedById,
      changed_by_name: changedByName,
      changed_date: changedDate,
    });
  }
  return entries;
}

// Wraps an update payload: returns newData with audit_history appended when
// there are real changes, or newData unchanged when nothing actually changed.
// Ensures existing audit entries (which may predate the string-only fix) pass
// entity validation by coercing any null/non-string previous_value/new_value to strings.
function sanitizeEntry(e) {
  return {
    ...e,
    previous_value: e.previous_value == null ? "" : String(e.previous_value),
    new_value: e.new_value == null ? "" : String(e.new_value),
  };
}

export function withAuditHistory(currentRecord, newData, user) {
  const entries = buildAuditEntries(currentRecord, newData, user);
  const existing = Array.isArray(currentRecord?.audit_history)
    ? currentRecord.audit_history.map(sanitizeEntry)
    : [];
  if (entries.length === 0 && existing.length === 0) return newData;
  return { ...newData, audit_history: [...existing, ...entries] };
}