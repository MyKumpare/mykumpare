import {
  Building,
  MapPin,
  Activity,
  DollarSign,
  Calendar,
  Search,
} from "lucide-react";

export const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
  "Other",
];

export const REGIONS = [
  "North America",
  "Europe",
  "Asia-Pacific",
  "Latin America",
  "Middle East & Africa",
  "Global",
  "Undefined",
];

export const ACTIVITY_OPTIONS = [
  { value: "all", label: "All firms" },
  { value: "30", label: "Active (≤ 30 days)" },
  { value: "90", label: "Reviewed (31–90 days)" },
  { value: "stale", label: "Stale (90+ days)" },
];

export const FUNDING_STATUS_OPTIONS = [
  { value: "Funded", label: "Funded" },
  { value: "Terminated", label: "Terminated" },
];

export const YEAR_FOUNDED_OPTIONS = [
  { value: "before_2000", label: "Before 2000" },
  { value: "2000s", label: "2000 – 2009" },
  { value: "2010s", label: "2010 – 2019" },
  { value: "2020s", label: "2020 +" },
];

export const SOURCING_SOURCE_OPTIONS = [
  { value: "Consultant Recommendation", label: "Consultant Recommendation" },
  { value: "Conference/Event", label: "Conference / Event" },
  { value: "Network/Referral", label: "Network / Referral" },
  { value: "Direct Outreach", label: "Direct Outreach" },
  { value: "Existing Relationship", label: "Existing Relationship" },
];

/**
 * Filter group config for the Firms section.
 * Groups are based on fields available in the firm form, tabs, and related sub-forms.
 */
export const firmFilterGroups = [
  {
    key: "firm_type",
    label: "Firm Type",
    icon: Building,
    type: "checkbox",
    options: FIRM_TYPES.map((t) => ({ value: t, label: t })),
  },
  {
    key: "geographic_region",
    label: "Location",
    icon: MapPin,
    type: "checkbox",
    hasSearch: true,
    searchPlaceholder: "Search location text...",
    options: REGIONS.map((r) => ({ value: r, label: r })),
  },
  {
    key: "recent_activity",
    label: "Recent Activity",
    icon: Activity,
    type: "radio",
    options: ACTIVITY_OPTIONS,
  },
  {
    key: "funding_status",
    label: "Funding Status",
    icon: DollarSign,
    type: "checkbox",
    options: FUNDING_STATUS_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "year_founded",
    label: "Year Founded",
    icon: Calendar,
    type: "checkbox",
    options: YEAR_FOUNDED_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "sourcing_source",
    label: "Sourcing Source",
    icon: Search,
    type: "checkbox",
    options: SOURCING_SOURCE_OPTIONS,
    defaultOpen: false,
  },
];