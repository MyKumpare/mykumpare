// Benchmark template generation and parsing for bulk benchmark creation
// with monthly returns (gross + net).
//
// Template format is a two-section CSV:
//
//   [BENCHMARKS]
//   Name,Asset Class,Region,Market Cap,Style,Inception Date,Description
//   MSCI Emerging Markets,Equity,Emerging Markets,Large Cap,Core,2001-01-01,Emerging markets index
//
//   [RETURNS]
//   Benchmark Name,Date,Gross Return (%),Net Return (%)
//   MSCI Emerging Markets,2024-01-31,1.2500,1.1000
//   MSCI Emerging Markets,2024-02-29,0.8300,0.7200

import * as XLSX from "xlsx";
import { endOfMonth, parseISO, format, subMonths } from "date-fns";

const BENCHMARK_SECTION = "[BENCHMARKS]";
const RETURNS_SECTION = "[RETURNS]";

const BENCHMARK_HEADERS = [
  "Name",
  "Asset Class",
  "Region",
  "Market Cap",
  "Style",
  "Inception Date",
  "Description",
];

const RETURN_HEADERS = [
  "Benchmark Name",
  "Date",
  "Gross Return (%)",
  "Net Return (%)",
];

const VALID_ASSET_CLASSES = [
  "Equity",
  "Fixed Income",
  "Commodities",
  "Real Estate",
  "Alternatives",
];

/**
 * Download a blank benchmark template CSV with two sections:
 * a BENCHMARKS section (one row per benchmark to create) and a
 * RETURNS section (one row per monthly return, linked by benchmark name).
 */
export function downloadBenchmarkTemplate() {
  const lines = [];

  lines.push(BENCHMARK_SECTION);
  lines.push(BENCHMARK_HEADERS.join(","));
  // Two example rows so the user understands the format
  lines.push(
    [
      '"MSCI Emerging Markets"',
      "Equity",
      "Emerging Markets",
      "Large Cap",
      "Core",
      "2001-01-01",
      '"Emerging markets equity index"',
    ].join(",")
  );
  lines.push(
    [
      '"MSCI ACWI"',
      "Equity",
      "Global",
      "All Cap",
      "Core",
      "2008-03-31",
      '"All Country World Index"',
    ].join(",")
  );

  lines.push("");
  lines.push(RETURNS_SECTION);
  lines.push(RETURN_HEADERS.join(","));
  // Example return rows for the first benchmark
  const lastMonth = endOfMonth(subMonths(new Date(), 1));
  const prevMonth = endOfMonth(subMonths(new Date(), 2));
  lines.push(
    [
      '"MSCI Emerging Markets"',
      format(lastMonth, "yyyy-MM-dd"),
      "1.2500",
      "1.1000",
    ].join(",")
  );
  lines.push(
    [
      '"MSCI Emerging Markets"',
      format(prevMonth, "yyyy-MM-dd"),
      "-0.4800",
      "-0.5800",
    ].join(",")
  );
  lines.push(
    [
      '"MSCI ACWI"',
      format(lastMonth, "yyyy-MM-dd"),
      "2.1000",
      "1.9500",
    ].join(",")
  );

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "benchmark_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse a CSV cell that may be quoted.
 */
function unquote(val) {
  if (!val) return "";
  const v = val.trim();
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/""/g, '"');
  return v;
}

function parseCSVLine(line) {
  // Simple CSV parser that handles quoted fields with commas
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  result.push(cur);
  return result.map(unquote);
}

function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/**
 * Parse a benchmark template file (CSV or Excel) into a structured object.
 * Returns { benchmarks, errors } where benchmarks is an array of
 * { name, asset_class, region, market_capitalization, style, inception_date,
 *    description, returns: [{ date, return_value, net_return_value }] }.
 */
export function parseBenchmarkTemplate(fileText) {
  const lines = fileText.trim().split(/\r?\n/);
  const errors = [];
  const benchmarks = []; // keyed by name for dedup
  const benchmarkMap = {};

  let section = null;
  let headerRow = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line === BENCHMARK_SECTION || line === RETURNS_SECTION) {
      section = line;
      headerRow = null;
      continue;
    }

    if (!section) {
      // Lines before any section marker — skip
      continue;
    }

    if (!headerRow) {
      headerRow = parseCSVLine(line);
      continue;
    }

    const cols = parseCSVLine(line);

    if (section === BENCHMARK_SECTION) {
      const name = cols[0]?.trim();
      if (!name) {
        errors.push(`BENCHMARKS row ${i + 1}: missing benchmark name`);
        continue;
      }
      const assetClass = cols[1]?.trim() || "";
      if (!VALID_ASSET_CLASSES.includes(assetClass)) {
        errors.push(
          `BENCHMARKS row ${i + 1}: invalid asset class "${assetClass}". Valid: ${VALID_ASSET_CLASSES.join(", ")}`
        );
        continue;
      }
      if (benchmarkMap[name]) {
        errors.push(`BENCHMARKS row ${i + 1}: duplicate benchmark name "${name}"`);
        continue;
      }
      const inceptionDate = parseDate(cols[5]);
      const entry = {
        name,
        asset_class: assetClass,
        region: cols[2]?.trim() || "",
        market_capitalization: cols[3]?.trim() || "",
        style: cols[4]?.trim() || "",
        inception_date: inceptionDate || "",
        description: cols[6]?.trim() || "",
        returns: [],
      };
      benchmarkMap[name] = entry;
      benchmarks.push(entry);
    } else if (section === RETURNS_SECTION) {
      const benchName = cols[0]?.trim();
      const dateStr = parseDate(cols[1]);
      const grossRaw = cols[2]?.trim();
      const netRaw = cols[3]?.trim();

      if (!benchName) {
        errors.push(`RETURNS row ${i + 1}: missing benchmark name`);
        continue;
      }
      if (!dateStr) {
        errors.push(`RETURNS row ${i + 1}: invalid date "${cols[1] || ""}"`);
        continue;
      }
      const gross = parseFloat(grossRaw);
      if (isNaN(gross)) {
        errors.push(`RETURNS row ${i + 1}: invalid gross return "${grossRaw}"`);
        continue;
      }
      const net = netRaw ? parseFloat(netRaw) : null;
      if (netRaw && isNaN(net)) {
        errors.push(`RETURNS row ${i + 1}: invalid net return "${netRaw}"`);
        continue;
      }

      // Attach to a benchmark declared in the BENCHMARKS section, or create
      // an ad-hoc entry (returns-only for an existing benchmark).
      if (!benchmarkMap[benchName]) {
        benchmarkMap[benchName] = {
          name: benchName,
          asset_class: "",
          region: "",
          market_capitalization: "",
          style: "",
          inception_date: "",
          description: "",
          returns: [],
          _returnsOnly: true,
        };
        benchmarks.push(benchmarkMap[benchName]);
      }
      benchmarkMap[benchName].returns.push({
        date: dateStr,
        return_value: gross,
        ...(net !== null ? { net_return_value: net } : {}),
      });
    }
  }

  return { benchmarks, errors };
}

/**
 * Read an uploaded file (CSV or Excel) as text.
 * For Excel files, converts the first sheet to CSV text.
 */
export function readBenchmarkTemplateFile(file) {
  return new Promise((resolve, reject) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          resolve(csv);
        } catch (err) {
          reject(new Error("Could not read Excel file: " + err.message));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    }
  });
}