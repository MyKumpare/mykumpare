import { BarChart3, Building, Globe, Award, Calendar, TrendingUp } from "lucide-react";

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
];