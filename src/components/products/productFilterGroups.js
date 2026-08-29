import {
  Package,
  Layers,
  DollarSign,
  Tag,
  CheckCircle,
  Globe,
  Building2,
  Calendar,
  BarChart3,
  Hash,
  PieChart,
  Briefcase,
  Target,
  TrendingUp,
  Boxes,
} from "lucide-react";

export const PRODUCT_TYPE_OPTIONS = [
  { value: "Investment Manager Product", label: "Investment Manager Product" },
  { value: "Multi-Manager Product", label: "Multi-Manager Product" },
];

export const PRODUCT_STATUS_OPTIONS = [
  { value: "Not Reviewed", label: "Not Reviewed" },
  { value: "In-Process", label: "In-Process" },
  { value: "On-Hold", label: "On-Hold" },
  { value: "Rejected", label: "Rejected" },
  { value: "Approved", label: "Approved" },
  { value: "Removed", label: "Removed" },
];

export const PRODUCT_FUNDING_OPTIONS = [
  { value: "Funded", label: "Funded" },
  { value: "Terminated", label: "Terminated" },
];

export const PRODUCT_AVAILABILITY_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Closed", label: "Closed" },
];

export const FUNDING_MANUAL_OPTIONS = [
  { value: "true", label: "Manually Set" },
  { value: "false", label: "Auto" },
];

export const ASSET_CLASS_OPTIONS = [
  { value: "Equity", label: "Equity" },
  { value: "Fixed Income", label: "Fixed Income" },
  { value: "Private Equity", label: "Private Equity" },
  { value: "Private Credit", label: "Private Credit" },
];

export const GEOGRAPHY_OPTIONS = [
  { value: "Global", label: "Global" },
  { value: "ACWI x US", label: "ACWI x US" },
  { value: "Developed Non-US", label: "Developed Non-US" },
  { value: "Emerging Markets", label: "Emerging Markets" },
  { value: "Frontier Markets", label: "Frontier Markets" },
  { value: "US", label: "US" },
];

export const MARKET_CAP_OPTIONS = [
  { value: "All Cap", label: "All Cap" },
  { value: "Large Cap", label: "Large Cap" },
  { value: "Mid-Large Cap", label: "Mid-Large Cap" },
  { value: "Mid Cap", label: "Mid Cap" },
  { value: "Small-Mid Cap", label: "Small-Mid Cap" },
  { value: "Small Cap", label: "Small Cap" },
  { value: "Micro Cap", label: "Micro Cap" },
];

export const STYLE_OPTIONS = [
  { value: "Value", label: "Value" },
  { value: "Core", label: "Core" },
  { value: "Growth", label: "Growth" },
];

export const INVESTMENT_PROCESS_OPTIONS = [
  { value: "Quantitative", label: "Quantitative" },
  { value: "Fundamental", label: "Fundamental" },
  { value: "Hybrid", label: "Hybrid" },
];

export const IMPLEMENTATION_PROCESS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Passive", label: "Passive" },
];

export const DIVERSIFICATION_OPTIONS = [
  { value: "Concentrated", label: "Concentrated" },
  { value: "Diversified", label: "Diversified" },
];

export const AAPRYL_STYLE_OPTIONS = [
  { value: "Aggressive Value", label: "Aggressive Value" },
  { value: "Relative Value", label: "Relative Value" },
  { value: "High Quality Blend", label: "High Quality Blend" },
  { value: "GARP", label: "GARP" },
  { value: "Core Growth", label: "Core Growth" },
  { value: "Aggressive Growth", label: "Aggressive Growth" },
];

export const VEHICLE_OFFERINGS_OPTIONS = [
  { value: "Separate Account", label: "Separate Account" },
  { value: "Integrated Managed Portfolio", label: "Integrated Managed Portfolio" },
  { value: "ETF", label: "ETF" },
  { value: "Mutual Fund", label: "Mutual Fund" },
];

export const MARKET_POSITIONING_OPTIONS = [
  { value: "Recovery Cycle", label: "Recovery Cycle" },
  { value: "Mid Cycle", label: "Mid Cycle" },
  { value: "Late Cycle", label: "Late Cycle" },
  { value: "Recession Cycle", label: "Recession Cycle" },
];

/**
 * Filter group config for the Products section sidebar.
 * Covers fields from the product Details form, Classifications tab,
 * Investment Description tab, and 3rd Party tab (form fields, tabs, and
 * related sub-forms). Groups with options: [] are dynamically populated from
 * the loaded product data. isArray: true indicates the field stores an array
 * of values (multi-select) and is matched via array membership.
 */
export const productFilterGroups = [
  // ── Details tab ──
  {
    key: "product_type",
    label: "Product Type",
    icon: Layers,
    type: "checkbox",
    options: PRODUCT_TYPE_OPTIONS,
  },
  {
    key: "firm_name",
    label: "Firm",
    icon: Building2,
    type: "checkbox",
    options: [], // dynamically populated
    defaultOpen: false,
  },
  {
    key: "product_status",
    label: "Product Status",
    icon: CheckCircle,
    type: "checkbox",
    options: PRODUCT_STATUS_OPTIONS,
  },
  {
    key: "product_availability_status",
    label: "Availability",
    icon: Tag,
    type: "checkbox",
    options: PRODUCT_AVAILABILITY_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "funding_status",
    label: "Funding Status",
    icon: DollarSign,
    type: "checkbox",
    options: PRODUCT_FUNDING_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "funding_status_manual",
    label: "Funding Override",
    icon: PieChart,
    type: "checkbox",
    options: FUNDING_MANUAL_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "evestment_universe",
    label: "eVestment Universe",
    icon: BarChart3,
    type: "checkbox",
    options: [], // dynamically populated
    defaultOpen: false,
  },
  {
    key: "default_benchmark_name",
    label: "Default Benchmark",
    icon: Target,
    type: "checkbox",
    options: [], // dynamically populated
    defaultOpen: false,
  },
  {
    key: "inception_date",
    label: "Inception Date",
    icon: Calendar,
    type: "search",
    placeholder: "Search inception date...",
    defaultOpen: false,
  },
  // ── Classifications tab ──
  {
    key: "asset_class",
    label: "Asset Class",
    icon: Package,
    type: "checkbox",
    options: ASSET_CLASS_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "geography",
    label: "Geography",
    icon: Globe,
    type: "checkbox",
    options: GEOGRAPHY_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "market_cap",
    label: "Market Cap",
    icon: BarChart3,
    type: "checkbox",
    options: MARKET_CAP_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "style",
    label: "Style",
    icon: TrendingUp,
    type: "checkbox",
    options: STYLE_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "investment_process",
    label: "Investment Approach",
    icon: Briefcase,
    type: "checkbox",
    options: INVESTMENT_PROCESS_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "implementation_process",
    label: "Implementation",
    icon: Boxes,
    type: "checkbox",
    options: IMPLEMENTATION_PROCESS_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "diversification_classification",
    label: "Diversification",
    icon: PieChart,
    type: "checkbox",
    options: DIVERSIFICATION_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "aapryl_style",
    label: "Aapryl Style",
    icon: Layers,
    type: "checkbox",
    options: AAPRYL_STYLE_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "vehicle_offerings",
    label: "Vehicle Offerings",
    icon: Boxes,
    type: "checkbox",
    options: VEHICLE_OFFERINGS_OPTIONS,
    isArray: true,
    defaultOpen: false,
  },
  // ── Investment Description tab ──
  {
    key: "inv_desc_market_positioning",
    label: "Market Positioning",
    icon: TrendingUp,
    type: "checkbox",
    options: MARKET_POSITIONING_OPTIONS,
    isArray: true,
    defaultOpen: false,
  },
  // ── 3rd Party tab ──
  {
    key: "evestment_id",
    label: "eVestment ID",
    icon: Hash,
    type: "search",
    placeholder: "Search eVestment ID...",
    defaultOpen: false,
  },
  {
    key: "custodian_id",
    label: "Custodian ID",
    icon: Hash,
    type: "search",
    placeholder: "Search custodian ID...",
    defaultOpen: false,
  },
  {
    key: "aapryl_id",
    label: "Aapryl ID",
    icon: Hash,
    type: "search",
    placeholder: "Search Aapryl ID...",
    defaultOpen: false,
  },
  {
    key: "xponance_internal_id",
    label: "Xponance Internal ID",
    icon: Hash,
    type: "search",
    placeholder: "Search Xponance ID...",
    defaultOpen: false,
  },
];