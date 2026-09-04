import { BarChart3, Building, Globe, Award, Calendar, TrendingUp, MapPin, Users } from "lucide-react";

export const PORTFOLIO_REGIONS = [
  "North America",
  "Europe",
  "Asia-Pacific",
  "Latin America",
  "Middle East & Africa",
  "Global",
  "Undefined",
];

export const COVERAGE_STATUS_OPTIONS = [
  { value: "all", label: "All portfolios" },
  { value: "covered", label: "Covered" },
  { value: "uncovered", label: "Uncovered" },
];

/**
 * Filter group config for the Portfolios section.
 * Based on fields available in the portfolio form.
 * Options for allocator, benchmark, and manager are derived dynamically
 * from the loaded portfolios (computed in the section component).
 */
export const portfolioFilterGroups = [
  {
    key: "advisor_type",
    label: "Advisor Type",
    icon: Building,
    type: "checkbox",
    options: [
      { value: "Investment Manager", label: "Investment Manager" },
      { value: "No Advisor", label: "No Advisor" },
    ],
  },
  {
    key: "allocator_name",
    label: "Allocator",
    icon: BarChart3,
    type: "checkbox",
    options: [], // dynamically populated
    defaultOpen: false,
  },
  {
    key: "primary_benchmark_name",
    label: "Primary Benchmark",
    icon: Award,
    type: "checkbox",
    options: [], // dynamically populated
    defaultOpen: false,
  },
  {
    key: "advisor_firm_name",
    label: "Investment Manager",
    icon: Building,
    type: "checkbox",
    options: [], // dynamically populated
    defaultOpen: false,
  },
  {
    key: "portfolio_name_search",
    label: "Portfolio Name",
    icon: Globe,
    type: "search",
    placeholder: "Search portfolio name...",
    defaultOpen: false,
  },
  {
    key: "geographic_region",
    label: "Region",
    icon: MapPin,
    type: "checkbox",
    options: PORTFOLIO_REGIONS.map((r) => ({ value: r, label: r })),
    defaultOpen: false,
  },
  {
    key: "coverage_status",
    label: "Coverage Status",
    icon: Users,
    type: "radio",
    options: COVERAGE_STATUS_OPTIONS,
    defaultOpen: false,
  },
];