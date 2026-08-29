// Field + section definitions for single-record summary report templates.
// Each entity type (Firm, Product, Portfolio, Contact) has grouped sections;
// each section has fields the user can toggle on/off in the template designer.
// Only selected fields are rendered in the final PDF.
//
// Field types drive formatting in summaryReportPdf.js:
//   text | longtext | number | date | currency | array
//   metric_number | metric_currency  (shown as KPI chips when include_summary_metrics is on)

import { format, parseISO } from "date-fns";

const fmtDate = (v) => {
  if (!v) return "—";
  try {
    return format(parseISO(String(v).slice(0, 10)), "MM/dd/yyyy");
  } catch {
    return String(v);
  }
};
const fmtCurrency = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US")}`;
};
const fmtArray = (v) => {
  if (!Array.isArray(v) || v.length === 0) return "—";
  return v.filter(Boolean).join(", ") || "—";
};

export const FIELD_FORMATTERS = {
  text: (v) => (v == null || v === "" ? "—" : String(v)),
  longtext: (v) => (v == null || v === "" ? "—" : String(v)),
  number: (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("en-US")),
  date: fmtDate,
  currency: fmtCurrency,
  array: fmtArray,
  metric_number: (v) => (v == null ? "0" : Number(v).toLocaleString("en-US")),
  metric_currency: fmtCurrency,
};

export function formatFieldValue(field, record, ctx = {}) {
  let value;
  try {
    value = field.derive ? field.derive(record, ctx) : record ? record[field.key] : undefined;
  } catch {
    value = undefined;
  }
  const fmt = FIELD_FORMATTERS[field.type] || FIELD_FORMATTERS.text;
  return fmt(value);
}

// ── Derive helpers ──
const latestAum = (record) => {
  const hist = record?.aum_history;
  if (!Array.isArray(hist) || hist.length === 0) return null;
  const sorted = [...hist].sort((a, b) => String(b.month_end_date || "").localeCompare(String(a.month_end_date || "")));
  return sorted[0]?.firm_aum ?? null;
};
const aumTrend = (record) => {
  const hist = record?.aum_history;
  if (!Array.isArray(hist) || hist.length < 2) return "—";
  const sorted = [...hist].sort((a, b) => String(a.month_end_date || "").localeCompare(String(b.month_end_date || "")));
  const first = sorted[0]?.firm_aum ?? 0;
  const last = sorted[sorted.length - 1]?.firm_aum ?? 0;
  if (!first) return "—";
  const pct = ((last - first) / first) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
};
const contactFullName = (c) => {
  if (!c) return "—";
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ") || "—";
};

export const SUMMARY_ENTITY_TYPES = {
  Firm: {
    label: "Firm",
    recordNameField: "name",
    sections: [
      {
        key: "overview",
        label: "Overview",
        fields: [
          { key: "name", label: "Firm Name", type: "text" },
          { key: "firm_types", label: "Firm Types", type: "array" },
          { key: "website", label: "Website", type: "text" },
          { key: "linkedin_url", label: "LinkedIn", type: "text" },
          { key: "email", label: "Email", type: "text" },
          { key: "year_founded", label: "Year Founded", type: "number" },
          { key: "geographic_region", label: "Geographic Region", type: "text" },
          { key: "location", label: "Location", type: "text" },
          { key: "description", label: "Description", type: "longtext" },
        ],
      },
      {
        key: "aum",
        label: "AUM",
        fields: [
          { key: "latest_aum", label: "Latest AUM", type: "metric_currency", derive: latestAum },
          { key: "aum_trend", label: "AUM Trend", type: "text", derive: aumTrend },
          { key: "aum_history_count", label: "AUM History Points", type: "metric_number", derive: (r) => (r?.aum_history ? r.aum_history.length : 0) },
        ],
      },
      {
        key: "products",
        label: "Products",
        fields: [
          { key: "product_count", label: "Product Count", type: "metric_number", derive: (r, ctx) => (ctx.products ? ctx.products.length : 0) },
          { key: "product_list", label: "Products", type: "longtext", derive: (r, ctx) => (ctx.products || []).map((p) => p.name).filter(Boolean).join(", ") || "—" },
        ],
      },
      {
        key: "contacts",
        label: "Contacts",
        fields: [
          { key: "contact_count", label: "Contact Count", type: "metric_number", derive: (r, ctx) => (ctx.contacts ? ctx.contacts.length : 0) },
          { key: "key_contacts", label: "Key Contacts", type: "longtext", derive: (r, ctx) => (ctx.contacts || []).slice(0, 5).map(contactFullName).join("; ") || "—" },
        ],
      },
      {
        key: "sourcing",
        label: "Sourcing",
        fields: [
          { key: "sourcing_sources", label: "Sourcing Sources", type: "array" },
          { key: "sourcing_date", label: "Sourcing Date", type: "date" },
          { key: "sourcing_contact_name", label: "Sourcing Contact", type: "text" },
          { key: "sourcing_notes", label: "Sourcing Notes", type: "longtext" },
        ],
      },
      {
        key: "registration",
        label: "Legal & Registration",
        fields: [
          { key: "registration_number", label: "Registration Number", type: "text" },
          { key: "registration_source_url", label: "Registration Source URL", type: "text" },
        ],
      },
      {
        key: "meeting",
        label: "Meeting Summary",
        fields: [
          { key: "meeting_summary", label: "Meeting Summary", type: "longtext" },
          { key: "meeting_summary_generated_at", label: "Summary Generated At", type: "date" },
        ],
      },
    ],
  },
  Product: {
    label: "Product",
    recordNameField: "name",
    sections: [
      {
        key: "overview",
        label: "Overview",
        fields: [
          { key: "name", label: "Product Name", type: "text" },
          { key: "product_type", label: "Product Type", type: "text" },
          { key: "firm_name", label: "Firm", type: "text" },
          { key: "description", label: "Description", type: "longtext" },
          { key: "asset_class", label: "Asset Class", type: "text" },
          { key: "geography", label: "Geography", type: "text" },
          { key: "market_cap", label: "Market Cap", type: "text" },
          { key: "style", label: "Style", type: "text" },
        ],
      },
      {
        key: "investment",
        label: "Investment",
        fields: [
          { key: "investment_process", label: "Investment Process", type: "longtext" },
          { key: "implementation_process", label: "Implementation Process", type: "longtext" },
          { key: "aapryl_style", label: "Aapryl Style", type: "text" },
        ],
      },
      {
        key: "aum",
        label: "AUM",
        fields: [
          { key: "latest_aum", label: "Latest AUM", type: "metric_currency", derive: latestAum },
          { key: "aum_history_count", label: "AUM History Points", type: "metric_number", derive: (r) => (r?.aum_history ? r.aum_history.length : 0) },
        ],
      },
      {
        key: "benchmarks",
        label: "Benchmarks",
        fields: [
          { key: "benchmarks", label: "Benchmarks", type: "longtext", derive: (r) => (r?.benchmarks || []).map((b) => b.name || b).filter(Boolean).join(", ") || "—" },
        ],
      },
      {
        key: "team",
        label: "Investment Team",
        fields: [
          { key: "team_count", label: "Team Members", type: "metric_number", derive: (r, ctx) => (ctx.team ? ctx.team.length : 0) },
          { key: "team_members", label: "Team Roster", type: "longtext", derive: (r, ctx) => (ctx.team || []).map((t) => `${t.contact_name || t.name || ""}${t.role ? ` (${t.role})` : ""}`.trim()).filter(Boolean).join("; ") || "—" },
        ],
      },
    ],
  },
  Portfolio: {
    label: "Portfolio",
    recordNameField: "portfolio_name",
    sections: [
      {
        key: "overview",
        label: "Overview",
        fields: [
          { key: "portfolio_name", label: "Portfolio Name", type: "text" },
          { key: "allocator_name", label: "Allocator", type: "text" },
          { key: "advisor_type", label: "Advisor Type", type: "text" },
          { key: "advisor_firm_name", label: "Advisor Firm", type: "text" },
          { key: "inception_date", label: "Inception Date", type: "date" },
          { key: "advisor_inception_date", label: "Advisor Inception", type: "date" },
        ],
      },
      {
        key: "aum",
        label: "AUM & Capital",
        fields: [
          { key: "latest_aum", label: "Latest AUM", type: "metric_currency", derive: latestAum },
          { key: "aum_history_count", label: "AUM History Points", type: "metric_number", derive: (r) => (r?.aum_history ? r.aum_history.length : 0) },
        ],
      },
      {
        key: "lineup",
        label: "Lineup",
        fields: [
          { key: "constituent_count", label: "Constituent Count", type: "metric_number", derive: (r, ctx) => (ctx.constituents ? ctx.constituents.length : 0) },
          { key: "constituents", label: "Constituents", type: "longtext", derive: (r, ctx) => (ctx.constituents || []).map((c) => c.product_name || c.name || "").filter(Boolean).join(", ") || "—" },
        ],
      },
      {
        key: "benchmarks",
        label: "Benchmarks",
        fields: [
          { key: "benchmarks", label: "Benchmarks", type: "longtext", derive: (r) => (r?.benchmarks || []).map((b) => b.name || b).filter(Boolean).join(", ") || "—" },
        ],
      },
    ],
  },
  Contact: {
    label: "Contact",
    recordNameField: null,
    sections: [
      {
        key: "overview",
        label: "Overview",
        fields: [
          { key: "full_name", label: "Full Name", type: "text", derive: contactFullName },
          { key: "title", label: "Job Title", type: "text" },
          { key: "email", label: "Email", type: "text" },
          { key: "phone", label: "Phone", type: "text", derive: (r) => {
            const p = r?.phones?.find((x) => x.is_default) || r?.phones?.[0];
            if (!p) return "—";
            return [p.country_code, p.area_code, p.number_mid, p.number_last].filter(Boolean).join("-") || "—";
          } },
          { key: "firm", label: "Firm", type: "text", derive: (r, ctx) => ctx.firmName || "—" },
          { key: "contact_status", label: "Contact Status", type: "text" },
          { key: "employee_status", label: "Employee Status", type: "text" },
          { key: "engagement_status", label: "Engagement Status", type: "text" },
        ],
      },
      {
        key: "classification",
        label: "Classification",
        fields: [
          { key: "contact_type", label: "Contact Type", type: "array" },
          { key: "contact_roles", label: "Roles", type: "array" },
          { key: "decision_role", label: "Decision Role", type: "text" },
          { key: "influence_level", label: "Influence Level", type: "text" },
          { key: "tags", label: "Tags", type: "array" },
        ],
      },
      {
        key: "demographics",
        label: "Demographics",
        fields: [
          { key: "gender", label: "Gender", type: "text" },
          { key: "ethnicity", label: "Ethnicity", type: "array" },
          { key: "veteran_status", label: "Veteran Status", type: "text" },
          { key: "disability_status", label: "Disability Status", type: "text" },
        ],
      },
      {
        key: "education",
        label: "Education",
        fields: [
          { key: "education_list", label: "Education", type: "longtext", derive: (r) => (r?.education || []).map((e) => [e.degree, e.institution, e.graduation_year].filter(Boolean).join(", ")).filter(Boolean).join("; ") || "—" },
        ],
      },
      {
        key: "experience",
        label: "Experience",
        fields: [
          { key: "professional_experience", label: "Professional Experience", type: "longtext", derive: (r) => (r?.professional_experience || []).map((e) => [e.title, e.company_name, e.start_year && e.end_year ? `${e.start_year}-${e.end_year}` : e.start_year || e.end_year].filter(Boolean).join(", ")).filter(Boolean).join("; ") || "—" },
          { key: "board_memberships", label: "Board Memberships", type: "longtext", derive: (r) => (r?.board_memberships || []).map((b) => [b.role, b.organization_name, b.start_year && b.end_year ? `${b.start_year}-${b.end_year}` : b.start_year || ""].filter(Boolean).join(", ")).filter(Boolean).join("; ") || "—" },
        ],
      },
    ],
  },
};

// Flatten all fields for an entity type (for lookups)
export function allFieldsFor(entityType) {
  const cfg = SUMMARY_ENTITY_TYPES[entityType];
  if (!cfg) return [];
  return cfg.sections.flatMap((s) => s.fields.map((f) => ({ ...f, sectionKey: s.key, sectionLabel: s.label })));
}

export function findField(entityType, fieldKey) {
  return allFieldsFor(entityType).find((f) => f.key === fieldKey);
}

// Record display name for a given entity type
export function recordDisplayName(entityType, record) {
  if (!record) return "—";
  const cfg = SUMMARY_ENTITY_TYPES[entityType];
  if (!cfg) return record.name || "—";
  if (cfg.recordNameField && record[cfg.recordNameField]) return record[cfg.recordNameField];
  if (entityType === "Contact") return contactFullName(record);
  return record.name || "—";
}