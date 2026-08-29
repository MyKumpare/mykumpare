import { productFilterGroups } from "./productFilterGroups";

/**
 * Sidebar filter helpers for the Products section.
 * Builds initial filter values, dynamic option lists (populated from loaded
 * product data), per-option counts, and the pure filter application logic
 * across every field exposed in the product form, tabs, and sub-forms.
 */

// Fields whose options are derived from the loaded product data rather than a
// fixed enum list.
const DYNAMIC_OPTION_KEYS = ["firm_name", "evestment_universe", "default_benchmark_name"];

// Defaults applied when a product record has no value for a scalar enum field
// (so the product still counts toward the default option in the sidebar).
const FIELD_DEFAULTS = {
  product_status: "Not Reviewed",
  product_availability_status: "Active",
};

/**
 * Build the initial (empty) filter-values object from the group config so the
 * section never needs to hardcode the keys.
 */
export function buildInitialProductFilterValues() {
  const values = {};
  for (const g of productFilterGroups) {
    if (g.type === "checkbox" || g.type === "radio") {
      values[g.key] = new Set();
    } else {
      values[g.key] = "";
    }
  }
  return values;
}

/**
 * Return the group configs with dynamic options (firm, eVestment universe,
 * default benchmark) populated from the loaded product data. Fixed-enum groups
 * pass through unchanged.
 */
export function buildDynamicProductGroups(products) {
  const dynamicSets = {};
  for (const key of DYNAMIC_OPTION_KEYS) dynamicSets[key] = new Set();

  for (const p of products || []) {
    if (p.deleted_at) continue;
    for (const key of DYNAMIC_OPTION_KEYS) {
      const v = p[key];
      if (v) dynamicSets[key].add(v);
    }
  }

  return productFilterGroups.map((g) => {
    if (dynamicSets[g.key]) {
      return {
        ...g,
        options: Array.from(dynamicSets[g.key])
          .sort((a, b) => a.localeCompare(b))
          .map((v) => ({ value: v, label: v })),
      };
    }
    return g;
  });
}

/**
 * Resolve the comparable option value(s) for a single product + group.
 * Returns an array of strings that the sidebar checkboxes compare against.
 */
function getProductFieldValues(p, g) {
  if (g.isArray) {
    const arr = p[g.key];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }
  if (g.key === "funding_status_manual") {
    return [String(!!p.funding_status_manual)];
  }
  let v = p[g.key];
  if (v === undefined || v === null || v === "") {
    v = FIELD_DEFAULTS[g.key];
    if (!v) return [];
  }
  return [v];
}

/**
 * Compute per-option counts for every checkbox/radio group, used to show the
 * tally next to each option in the sidebar.
 */
export function computeProductFilterCounts(products) {
  const counts = {};
  for (const g of productFilterGroups) {
    if (g.type === "checkbox" || g.type === "radio") counts[g.key] = {};
  }
  for (const p of products || []) {
    if (p.deleted_at) continue;
    for (const g of productFilterGroups) {
      if (g.type !== "checkbox" && g.type !== "radio") continue;
      const vals = getProductFieldValues(p, g);
      for (const v of vals) {
        counts[g.key][v] = (counts[g.key][v] || 0) + 1;
      }
    }
  }
  return counts;
}

/**
 * True when any sidebar filter (checkbox or search) has an active value.
 */
export function hasActiveProductFilters(filterValues) {
  return Object.values(filterValues || {}).some((v) =>
    v instanceof Set ? v.size > 0 : (v || "").toString().trim().length > 0
  );
}

/**
 * Apply all active sidebar filters to a product list and return the matches.
 */
export function applyProductSidebarFilters(products, filterValues) {
  if (!hasActiveProductFilters(filterValues)) return products;
  return (products || []).filter((p) => {
    if (p.deleted_at) return false;
    for (const g of productFilterGroups) {
      const sel = filterValues[g.key];
      if (!sel) continue;
      if (g.type === "checkbox" || g.type === "radio") {
        if (!(sel instanceof Set) || sel.size === 0) continue;
        const vals = getProductFieldValues(p, g);
        if (!vals.some((v) => sel.has(v))) return false;
      } else if (g.type === "search") {
        const q = (sel || "").toLowerCase().trim();
        if (!q) continue;
        if (!String(p[g.key] || "").toLowerCase().includes(q)) return false;
      }
    }
    return true;
  });
}