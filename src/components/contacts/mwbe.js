// MWBE = Minority and Women-Owned Business Enterprise.
// The MWBE set is every contact who is Female AND/OR an Ethnic Minority.
// This helper is shared by EmployeeStatusChart (donut + drill-down) and
// ContactsTabFilters (contact-list filtering) so the two stay in sync.

export const ETHNIC_MINORITY_VALUES = [
  "African American",
  "Asian American",
  "Latino American",
  "Native American Indian",
  "Native Alaskan Indian",
];

// Mutually-exclusive partition of the MWBE set (Venn split) so the donut
// segments never overlap. "female_nonminority" is "Female (excluding ethnic
// minorities)" — the category the user asked to be clickable.
export const MWBE_CATEGORIES = [
  { label: "Female (Non-Minority)", value: "female_nonminority", color: "#EC4899" },
  { label: "Ethnic Minority (Non-Female)", value: "minority_nonfemale", color: "#7C3AED" },
  { label: "Female & Minority", value: "female_minority", color: "#8B5CF6" },
];

export function isEthnicMinority(c) {
  return Array.isArray(c.ethnicity) && c.ethnicity.some((e) => ETHNIC_MINORITY_VALUES.includes(e));
}

// Returns the MWBE category value for a contact, or null if the contact is
// neither Female nor an Ethnic Minority (i.e. outside the MWBE set).
export function getMwbeCategory(c) {
  const female = c.gender === "Female";
  const minority = isEthnicMinority(c);
  if (female && minority) return "female_minority";
  if (female && !minority) return "female_nonminority";
  if (!female && minority) return "minority_nonfemale";
  return null;
}

export function isInMwbeSet(c) {
  return getMwbeCategory(c) !== null;
}