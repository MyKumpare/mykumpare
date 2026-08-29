import {
  User,
  Heart,
  Crown,
  Zap,
  Briefcase,
  Users,
  Shield,
  Award,
  Tag,
  Building2,
  Hash,
  Layers,
} from "lucide-react";

export const CONTACT_STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

export const ENGAGEMENT_STATUS_OPTIONS = [
  { value: "New", label: "New" },
  { value: "Engaged", label: "Engaged" },
  { value: "Archived", label: "Archived" },
];

export const DECISION_ROLE_OPTIONS = [
  { value: "Primary Decision Maker", label: "Primary Decision Maker" },
  { value: "Board Member", label: "Board Member" },
  { value: "Key Influencer", label: "Key Influencer" },
  { value: "Secondary Contact", label: "Secondary Contact" },
  { value: "Other", label: "Other" },
];

export const INFLUENCE_LEVEL_OPTIONS = [
  { value: "Final Decision Maker", label: "Final Decision Maker" },
  { value: "Decision Maker", label: "Decision Maker" },
  { value: "Influencer", label: "Influencer" },
  { value: "Follower", label: "Follower" },
  { value: "Undetermined", label: "Undetermined" },
];

export const EMPLOYEE_STATUS_OPTIONS = [
  { value: "Employee", label: "Employee" },
  { value: "Non-Employee", label: "Non-Employee" },
];

export const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Undetermined", label: "Undetermined" },
];

export const VETERAN_STATUS_OPTIONS = [
  { value: "Veteran Owned", label: "Veteran Owned" },
  { value: "Non-Veteran Owned", label: "Non-Veteran Owned" },
  { value: "Undetermined", label: "Undetermined" },
];

export const DISABILITY_STATUS_OPTIONS = [
  { value: "Disabled", label: "Disabled" },
  { value: "Non-Disabled", label: "Non-Disabled" },
  { value: "Undetermined", label: "Undetermined" },
];

export const SALUTATION_OPTIONS = [
  { value: "Mr.", label: "Mr." },
  { value: "Ms.", label: "Ms." },
  { value: "Mrs.", label: "Mrs." },
  { value: "Dr.", label: "Dr." },
  { value: "Prof.", label: "Prof." },
  { value: "Hon.", label: "Hon." },
];

export const CONTACT_ROLE_OPTIONS = [
  { value: "Primary", label: "Primary" },
  { value: "Secondary", label: "Secondary" },
];

export const ETHNICITY_OPTIONS = [
  { value: "African American", label: "African American" },
  { value: "Asian American", label: "Asian American" },
  { value: "Caucasian", label: "Caucasian" },
  { value: "Latino American", label: "Latino American" },
  { value: "Native American Indian", label: "Native American Indian" },
  { value: "Native Alaskan Indian", label: "Native Alaskan Indian" },
];

/**
 * Filter group config for the Contacts section.
 * Based on fields available in the contact form, profile tabs, and related sub-forms
 * (Info, Classification, Demographics, Education, Experience, Pipeline, etc.).
 * Groups with options: [] are dynamically populated from loaded contact data.
 */
export const contactFilterGroups = [
  {
    key: "contact_status",
    label: "Contact Status",
    icon: User,
    type: "checkbox",
    options: CONTACT_STATUS_OPTIONS,
  },
  {
    key: "engagement_status",
    label: "Engagement",
    icon: Heart,
    type: "checkbox",
    options: ENGAGEMENT_STATUS_OPTIONS,
  },
  {
    key: "decision_role",
    label: "Decision Role",
    icon: Crown,
    type: "checkbox",
    options: DECISION_ROLE_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "influence_level",
    label: "Influence Level",
    icon: Zap,
    type: "checkbox",
    options: INFLUENCE_LEVEL_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "employee_status",
    label: "Employee Status",
    icon: Briefcase,
    type: "checkbox",
    options: EMPLOYEE_STATUS_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "gender",
    label: "Gender",
    icon: Users,
    type: "checkbox",
    options: GENDER_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "veteran_status",
    label: "Veteran Status",
    icon: Shield,
    type: "checkbox",
    options: VETERAN_STATUS_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "disability_status",
    label: "Disability Status",
    icon: Award,
    type: "checkbox",
    options: DISABILITY_STATUS_OPTIONS,
    defaultOpen: false,
  },
  // ── Fields from related tabs and sub-forms ──
  {
    key: "salutation",
    label: "Salutation",
    icon: User,
    type: "checkbox",
    options: SALUTATION_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "contact_role",
    label: "Priority",
    icon: Crown,
    type: "checkbox",
    options: CONTACT_ROLE_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "contact_type",
    label: "Contact Type",
    icon: Tag,
    type: "checkbox",
    options: [], // dynamically populated from contact data
    defaultOpen: false,
  },
  {
    key: "contact_roles",
    label: "Contact Role",
    icon: Briefcase,
    type: "checkbox",
    options: [], // dynamically populated from contact data
    defaultOpen: false,
  },
  {
    key: "contact_firm_roles",
    label: "Contact Department",
    icon: Building2,
    type: "checkbox",
    options: [], // dynamically populated from contact data
    defaultOpen: false,
  },
  {
    key: "investment_team_roles",
    label: "Investment Team Role",
    icon: Users,
    type: "checkbox",
    options: [], // dynamically populated from contact data
    defaultOpen: false,
  },
  {
    key: "tags",
    label: "Tags",
    icon: Hash,
    type: "checkbox",
    options: [], // dynamically populated from contact data
    defaultOpen: false,
  },
  {
    key: "ethnicity",
    label: "Ethnicity",
    icon: Users,
    type: "checkbox",
    options: ETHNICITY_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "pipeline_stage",
    label: "Pipeline Stage",
    icon: Layers,
    type: "checkbox",
    options: [], // dynamically populated from contact data
    defaultOpen: false,
  },
];