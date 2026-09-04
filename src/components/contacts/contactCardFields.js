// Catalog of all contact fields available for selection in the Contact Card dialog.
// Covers the main contact form, related tabs, and sub-tabs/sub-forms (education,
// professional experience, board memberships, phones, addresses, etc.).
// Users pick from these existing fields — they do not create new ones.

import {
  User, Mail, Phone, MapPin, Globe, Building2, Award, Briefcase, GraduationCap,
  Users, Star, Tag, FileText, Link2, IdCard, Heart, Shield, Flag, CircleUser,
  Network, Stethoscope, ClipboardList, Layers, BookOpen, Trophy,
} from "lucide-react";

const formatPhone = (p) => {
  if (!p) return "";
  return [
    p.country_code ? `+${p.country_code}` : null,
    p.area_code ? `(${p.area_code})` : null,
    [p.number_mid, p.number_last].filter(Boolean).join("-") || null,
  ].filter(Boolean).join(" ");
};

const formatAddress = (a) => {
  if (!a) return "";
  return [
    a.address_line1,
    a.address_line2,
    [a.city, a.state].filter(Boolean).join(", "),
    [a.postal_code, a.country].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
};

const formatEducation = (contact) => {
  return (contact.education || [])
    .map((e) =>
      [e.degree ? `${e.degree},` : null, e.institution, e.graduation_year ? `(${e.graduation_year})` : null]
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean)
    .join("; ");
};

const formatExperience = (contact) => {
  return (contact.professional_experience || [])
    .map((e) =>
      [e.title, e.company_name, [e.start_year, e.end_year].filter(Boolean).join("–")]
        .filter(Boolean)
        .join(", ")
    )
    .filter(Boolean)
    .join("; ");
};

const formatBoardMemberships = (contact) => {
  return (contact.board_memberships || [])
    .map((b) =>
      [b.role, b.organization_name, [b.start_year, b.end_year].filter(Boolean).join("–")]
        .filter(Boolean)
        .join(", ")
    )
    .filter(Boolean)
    .join("; ");
};

const formatAllPhones = (contact) => {
  return (contact.phones || [])
    .map((p) => [p.phone_type, formatPhone(p)].filter(Boolean).join(": "))
    .filter(Boolean)
    .join("; ");
};

const formatAllAddresses = (contact) => {
  return (contact.addresses || [])
    .map((a) => [a.is_primary ? "(Primary)" : null, formatAddress(a)].filter(Boolean).join(" "))
    .filter(Boolean)
    .join("; ");
};

// Each field: { id, label, category, icon, getValue(contact, firms) }
export const AVAILABLE_FIELDS = [
  // === Personal ===
  { id: "name", label: "Full Name", category: "Personal", icon: User,
    getValue: (c) => [c.salutation, c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") + (c.suffix ? `, ${c.suffix}` : "") },
  { id: "salutation", label: "Salutation", category: "Personal", icon: User, getValue: (c) => c.salutation || "" },
  { id: "first_name", label: "First Name", category: "Personal", icon: User, getValue: (c) => c.first_name || "" },
  { id: "middle_name", label: "Middle Name", category: "Personal", icon: User, getValue: (c) => c.middle_name || "" },
  { id: "last_name", label: "Last Name", category: "Personal", icon: User, getValue: (c) => c.last_name || "" },
  { id: "suffix", label: "Suffix", category: "Personal", icon: User, getValue: (c) => c.suffix || "" },
  { id: "title", label: "Job Title", category: "Personal", icon: Briefcase, getValue: (c) => c.title || "" },
  { id: "designations", label: "Designations", category: "Personal", icon: Award, getValue: (c) => (c.designations || []).join(", ") },
  { id: "gender", label: "Gender", category: "Personal", icon: User, getValue: (c) => c.gender || "" },
  { id: "ethnicity", label: "Ethnicity", category: "Personal", icon: Users, getValue: (c) => (c.ethnicity || []).join(", ") },
  { id: "veteran_status", label: "Veteran Status", category: "Personal", icon: Flag, getValue: (c) => c.veteran_status || "" },
  { id: "disability_status", label: "Disability Status", category: "Personal", icon: Heart, getValue: (c) => c.disability_status || "" },
  { id: "biography", label: "Biography", category: "Personal", icon: FileText, getValue: (c) => c.biography || "" },
  { id: "bio_url", label: "Bio URL", category: "Personal", icon: Link2, getValue: (c) => c.bio_url || "" },

  // === Contact Info ===
  { id: "email", label: "Email", category: "Contact Info", icon: Mail, getValue: (c) => c.email || "" },
  { id: "linkedin_url", label: "LinkedIn URL", category: "Contact Info", icon: Link2, getValue: (c) => c.linkedin_url || "" },
  { id: "phone_default", label: "Phone (Default)", category: "Contact Info", icon: Phone,
    getValue: (c) => formatPhone((c.phones || []).find((p) => p.is_default) || (c.phones || [])[0]) },
  { id: "address_primary", label: "Address (Primary)", category: "Contact Info", icon: MapPin,
    getValue: (c) => formatAddress((c.addresses || []).find((a) => a.is_primary) || (c.addresses || [])[0]) },

  // === Professional ===
  { id: "company", label: "Company / Firm", category: "Professional", icon: Building2,
    getValue: (c, firms) => {
      const firm = firms?.find((f) => (c.firm_ids || []).includes(f.id));
      return firm?.name || (c.firm_ids || []).map((id) => firms?.find((f) => f.id === id)?.name).filter(Boolean).join(", ");
    } },
  { id: "firm_website", label: "Firm Website", category: "Professional", icon: Globe,
    getValue: (c, firms) => firms?.find((f) => (c.firm_ids || []).includes(f.id))?.website || "" },
  { id: "firm_linkedin", label: "Firm LinkedIn", category: "Professional", icon: Link2,
    getValue: (c, firms) => firms?.find((f) => (c.firm_ids || []).includes(f.id))?.linkedin_url || "" },
  { id: "employee_status", label: "Employee Status", category: "Professional", icon: IdCard, getValue: (c) => c.employee_status || "" },
  { id: "contact_status", label: "Contact Status", category: "Professional", icon: CircleUser, getValue: (c) => c.contact_status || "" },
  { id: "engagement_status", label: "Engagement Status", category: "Professional", icon: Star, getValue: (c) => c.engagement_status || "" },
  { id: "contact_role", label: "Contact Role", category: "Professional", icon: IdCard, getValue: (c) => c.contact_role || "" },
  { id: "decision_role", label: "Decision Role", category: "Professional", icon: Star, getValue: (c) => c.decision_role || "" },
  { id: "influence_level", label: "Influence Level", category: "Professional", icon: Star, getValue: (c) => c.influence_level || "" },
  { id: "contact_type", label: "Contact Type", category: "Professional", icon: Tag, getValue: (c) => (c.contact_type || []).join(", ") },
  { id: "contact_roles", label: "Contact Roles", category: "Professional", icon: Briefcase, getValue: (c) => (c.contact_roles || []).join(", ") },
  { id: "contact_firm_roles", label: "Contact Firm Roles", category: "Professional", icon: Building2, getValue: (c) => (c.contact_firm_roles || []).join(", ") },
  { id: "investment_team_roles", label: "Investment Team Roles", category: "Professional", icon: Users, getValue: (c) => (c.investment_team_roles || []).join(", ") },
  { id: "tags", label: "Tags", category: "Professional", icon: Tag, getValue: (c) => (c.tags || []).join(", ") },
  { id: "pipeline_stage", label: "Pipeline Stage", category: "Professional", icon: Layers, getValue: (c) => c.pipeline_stage || "" },

  // === Education ===
  { id: "education", label: "Education", category: "Education", icon: GraduationCap, getValue: (c) => formatEducation(c) },

  // === Professional Experience ===
  { id: "professional_experience", label: "Professional Experience", category: "Experience", icon: Briefcase, getValue: (c) => formatExperience(c) },

  // === Board Memberships ===
  { id: "board_memberships", label: "Board Memberships", category: "Board Memberships", icon: Trophy, getValue: (c) => formatBoardMemberships(c) },

  // === Phones (all) ===
  { id: "phones_all", label: "All Phone Numbers", category: "Phones", icon: Phone, getValue: (c) => formatAllPhones(c) },

  // === Addresses (all) ===
  { id: "addresses_all", label: "All Addresses", category: "Addresses", icon: MapPin, getValue: (c) => formatAllAddresses(c) },

  // === Xponance ===
  { id: "primary_xponance_contact", label: "Primary Xponance Contact", category: "Xponance", icon: Network, getValue: (c) => c.primary_xponance_contact_name || "" },
  { id: "secondary_xponance_contact", label: "Secondary Xponance Contact", category: "Xponance", icon: Network, getValue: (c) => c.secondary_xponance_contact_name || "" },

  // === Notes ===
  { id: "notes", label: "Notes", category: "Notes", icon: FileText, getValue: (c) => c.notes || "" },
];

// Returns an href for linkable fields (email, phone, address, website), or "" if not linkable.
export function getFieldHref(fieldId, value) {
  if (!value) return "";
  const v = String(value).trim();
  switch (fieldId) {
    case "email":
      return `mailto:${v}`;
    case "phone_default":
    case "phones_all": {
      // Keep leading + and digits only
      const digits = v.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
      return digits ? `tel:${digits}` : "";
    }
    case "address_primary":
    case "addresses_all":
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
    case "firm_website": {
      if (!v) return "";
      return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    }
    case "linkedin_url":
    case "bio_url":
    case "firm_linkedin": {
      if (!v) return "";
      return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    }
    default:
      return "";
  }
}

// Group fields by category for the dropdown
export const FIELD_CATEGORIES = [...new Set(AVAILABLE_FIELDS.map((f) => f.category))];

export function getFieldDef(fieldId) {
  return AVAILABLE_FIELDS.find((f) => f.id === fieldId);
}

// Build the default card fields from a contact (name always first, then fields with values)
export function buildDefaultFields(contact, firms) {
  if (!contact) return [];
  const nameDef = getFieldDef("name");
  const nameVal = nameDef.getValue(contact, firms);
  const nameField = { id: "name", label: "Full Name", value: nameVal, enabled: true };
  const rest = AVAILABLE_FIELDS.filter((f) => f.id !== "name").map((f) => {
    const value = f.getValue(contact, firms);
    return {
      id: f.id,
      label: f.label,
      value: typeof value === "string" ? value : "",
      enabled: !!value,
    };
  }).filter((f) => f.value);
  return [nameField, ...rest];
}