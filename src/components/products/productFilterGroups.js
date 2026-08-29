import {
  Package,
  Layers,
  DollarSign,
  Tag,
  CheckCircle,
  Globe,
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

/**
 * Filter group config for the Products section.
 * Based on fields available in the product form and classification tabs.
 */
export const productFilterGroups = [
  {
    key: "product_type",
    label: "Product Type",
    icon: Layers,
    type: "checkbox",
    options: PRODUCT_TYPE_OPTIONS,
  },
  {
    key: "product_status",
    label: "Product Status",
    icon: CheckCircle,
    type: "checkbox",
    options: PRODUCT_STATUS_OPTIONS,
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
    key: "product_availability_status",
    label: "Availability",
    icon: Tag,
    type: "checkbox",
    options: PRODUCT_AVAILABILITY_OPTIONS,
    defaultOpen: false,
  },
  {
    key: "asset_class",
    label: "Asset Class",
    icon: Package,
    type: "search",
    placeholder: "Search asset class...",
    defaultOpen: false,
  },
  {
    key: "geography",
    label: "Geography",
    icon: Globe,
    type: "search",
    placeholder: "Search geography...",
    defaultOpen: false,
  },
];