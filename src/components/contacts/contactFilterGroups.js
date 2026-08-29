import {
  User,
  Heart,
  Crown,
  Zap,
  Briefcase,
  Users,
  Shield,
  Award,
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

/**
 * Filter group config for the Contacts section.
 * Based on fields available in the contact form and profile tabs.
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
];