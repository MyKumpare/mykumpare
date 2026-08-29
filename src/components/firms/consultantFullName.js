// Build the full display name for a contact, including salutation, first,
// middle, last, and suffix fields (per the app's naming convention).
export function buildContactFullName(c) {
  if (!c) return "";
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(" ")
    .trim();
}