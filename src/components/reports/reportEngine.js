import { base44 } from "@/api/base44Client";
import { DATA_SOURCES } from "./reportConfig";

export async function fetchReportData(dataSource) {
  const entity = base44.entities[dataSource];
  if (!entity) throw new Error(`Unknown data source: ${dataSource}`);
  return entity.list("-created_date", 500);
}

export function formatCellValue(value, fieldType) {
  if (value == null) return "";
  if (fieldType === "date") return formatDate(value);
  if (fieldType === "number") return value;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return formatObject(value);
  return String(value);
}

function formatDate(val) {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return String(val);
  }
}

function formatObject(obj) {
  if (Array.isArray(obj)) return obj.map(formatObject).join("; ");
  if (typeof obj !== "object" || obj === null) return String(obj);
  const parts = [];
  if (obj.address_line1) parts.push(obj.address_line1);
  if (obj.city) parts.push(obj.city);
  if (obj.state) parts.push(obj.state);
  if (obj.country) parts.push(obj.country);
  if (obj.phone_type || obj.area_code || obj.number_mid || obj.number_last) {
    const num = [obj.area_code, obj.number_mid, obj.number_last].filter(Boolean).join("-");
    if (num) parts.push(`${obj.phone_type || ""} ${num}`.trim());
  }
  if (obj.company_name) parts.push(obj.company_name);
  if (obj.degree) parts.push(obj.degree);
  if (obj.title) parts.push(obj.title);
  if (parts.length === 0) return JSON.stringify(obj);
  return parts.filter(Boolean).join(", ");
}

export function sortData(data, sortBy, sortOrder) {
  if (!sortBy) return data;
  const sorted = [...data].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv));
  });
  return sortOrder === "desc" ? sorted.reverse() : sorted;
}

export function groupData(data, groupBy) {
  if (!groupBy) return { _all: data };
  const groups = {};
  data.forEach((item) => {
    const key = item[groupBy] || "N/A";
    const keyStr = Array.isArray(key) ? key.join(", ") : String(key);
    if (!groups[keyStr]) groups[keyStr] = [];
    groups[keyStr].push(item);
  });
  return groups;
}

export function runComputations(data, computations) {
  if (!computations || computations.length === 0) return [];
  return computations.map((comp) => {
    const { type, target_field, group_by, label } = comp;
    const groups = groupData(data, group_by);
    const results = {};

    Object.entries(groups).forEach(([groupKey, items]) => {
      switch (type) {
        case "count":
          results[groupKey] = items.length;
          break;
        case "sum": {
          results[groupKey] = items.reduce((sum, i) => sum + (Number(i[target_field]) || 0), 0);
          break;
        }
        case "average": {
          const nums = items.map((i) => Number(i[target_field])).filter((n) => !isNaN(n));
          results[groupKey] = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          break;
        }
        case "min": {
          const nums = items.map((i) => Number(i[target_field])).filter((n) => !isNaN(n));
          results[groupKey] = nums.length > 0 ? Math.min(...nums) : 0;
          break;
        }
        case "max": {
          const nums = items.map((i) => Number(i[target_field])).filter((n) => !isNaN(n));
          results[groupKey] = nums.length > 0 ? Math.max(...nums) : 0;
          break;
        }
        case "percentage": {
          results[groupKey] = data.length > 0 ? (items.length / data.length) * 100 : 0;
          break;
        }
        default:
          results[groupKey] = 0;
      }
    });

    return {
      label: label || `${type}${target_field ? ` of ${target_field}` : ""}${group_by ? ` by ${group_by}` : ""}`,
      type,
      group_by,
      results,
    };
  });
}

export function buildTableRows(data, selectedFields, dataSourceKey) {
  const fields = DATA_SOURCES[dataSourceKey]?.fields || [];
  return data.map((item) => {
    const row = {};
    selectedFields.forEach((key) => {
      const fieldDef = fields.find((f) => f.key === key);
      row[key] = formatCellValue(item[key], fieldDef?.type);
    });
    return row;
  });
}

export function generateCSV(rows, headers) {
  const headerRow = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",");
  const dataRows = rows.map((row) =>
    headers
      .map((h) => {
        const val = typeof row[h] === "object" ? JSON.stringify(row[h]) : row[h];
        return `"${String(val ?? "").replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [headerRow, ...dataRows].join("\n");
}

export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "report.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}