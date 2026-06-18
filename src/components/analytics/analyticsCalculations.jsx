// ── Return Series Helpers ─────────────────────────────────────────────────────

const parseMDY = (mdy) => {
  if (!mdy) return null;
  const [m, d, y] = mdy.split("/").map(Number);
  return new Date(y, m - 1, d);
};

// Get last day of month (handles negative months by rolling back years)
function getLastDayOfMonth(year, month) {
  // Handle negative months or months > 11
  const normalized = new Date(year, month + 1, 0);
  return new Date(normalized.getFullYear(), normalized.getMonth(), normalized.getDate());
}

const parseYMD = (ymd) => {
  if (!ymd) return null;
  return new Date(ymd + "T00:00:00");
};

// Filter monthly returns within [startDate, endDate] (both inclusive)
// For trailing periods, this captures the exact month-end dates needed
export function filterReturns(monthlyReturns, startStr, endStr, returnField = "return_value") {
  if (!monthlyReturns?.length) return [];
  const start = startStr?.includes("/") ? parseMDY(startStr) : parseYMD(startStr);
  const end = endStr?.includes("/") ? parseMDY(endStr) : parseYMD(endStr);
  return monthlyReturns
    .filter((r) => {
      const d = parseYMD(r.date);
      if (!d) return false;
      // Use <= and >= to ensure we capture the exact month-end dates
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Annualize a monthly return array (geometric)
export function annualizeReturns(monthlyReturns) {
  if (!monthlyReturns.length) return null;
  const compound = monthlyReturns.reduce((acc, r) => acc * (1 + r / 100), 1);
  const n = monthlyReturns.length;
  return (Math.pow(compound, 12 / n) - 1) * 100;
}

// Cumulative return (geometric)
export function cumulativeReturn(returns) {
  if (!returns.length) return null;
  return (returns.reduce((acc, r) => acc * (1 + r / 100), 1) - 1) * 100;
}

// Standard deviation (monthly, then annualized)
export function stdDev(returns, annualize = true) {
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const monthly = Math.sqrt(variance);
  return annualize ? monthly * Math.sqrt(12) : monthly;
}

// Downside deviation (vs 0 threshold, annualized)
export function downsideDeviation(returns) {
  if (!returns.length) return null;
  const downside = returns.map((r) => Math.min(r, 0));
  const variance = downside.reduce((acc, r) => acc + r * r, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(12);
}

// Sharpe ratio (annualized, rf=0)
export function sharpeRatio(returns) {
  const ann = annualizeReturns(returns);
  const sd = stdDev(returns, true);
  if (!sd || sd === 0 || ann === null) return null;
  return ann / sd;
}

// Sortino ratio
export function sortinoRatio(returns) {
  const ann = annualizeReturns(returns);
  const dd = downsideDeviation(returns);
  if (!dd || dd === 0 || ann === null) return null;
  return ann / dd;
}

// Max drawdown
export function maxDrawdown(returns) {
  if (!returns.length) return null;
  let peak = 1, maxDD = 0, cumulative = 1;
  for (const r of returns) {
    cumulative *= (1 + r / 100);
    if (cumulative > peak) peak = cumulative;
    const dd = (cumulative - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

// Beta vs benchmark
export function beta(productReturns, benchmarkReturns) {
  const n = Math.min(productReturns.length, benchmarkReturns.length);
  if (n < 2) return null;
  const p = productReturns.slice(0, n);
  const b = benchmarkReturns.slice(0, n);
  const meanP = p.reduce((a, x) => a + x, 0) / n;
  const meanB = b.reduce((a, x) => a + x, 0) / n;
  const cov = p.reduce((acc, pi, i) => acc + (pi - meanP) * (b[i] - meanB), 0) / (n - 1);
  const varB = b.reduce((acc, bi) => acc + Math.pow(bi - meanB, 2), 0) / (n - 1);
  return varB === 0 ? null : cov / varB;
}

// Alpha (annualized, rf=0): alpha = annProduct - beta * annBenchmark
export function alpha(productReturns, benchmarkReturns) {
  const b = beta(productReturns, benchmarkReturns);
  if (b === null) return null;
  const annP = annualizeReturns(productReturns);
  const annB = annualizeReturns(benchmarkReturns);
  if (annP === null || annB === null) return null;
  return annP - b * annB;
}

// R-squared
export function rSquared(productReturns, benchmarkReturns) {
  const n = Math.min(productReturns.length, benchmarkReturns.length);
  if (n < 2) return null;
  const p = productReturns.slice(0, n);
  const b = benchmarkReturns.slice(0, n);
  const meanP = p.reduce((a, x) => a + x, 0) / n;
  const meanB = b.reduce((a, x) => a + x, 0) / n;
  const cov = p.reduce((acc, pi, i) => acc + (pi - meanP) * (b[i] - meanB), 0);
  const varP = p.reduce((acc, pi) => acc + Math.pow(pi - meanP, 2), 0);
  const varB = b.reduce((acc, bi) => acc + Math.pow(bi - meanB, 2), 0);
  const denom = Math.sqrt(varP * varB);
  if (denom === 0) return null;
  return Math.pow(cov / denom, 2) * 100;
}

// Tracking error (annualized std dev of excess returns)
export function trackingError(productReturns, benchmarkReturns) {
  const n = Math.min(productReturns.length, benchmarkReturns.length);
  if (n < 2) return null;
  const excess = productReturns.slice(0, n).map((r, i) => r - benchmarkReturns[i]);
  return stdDev(excess, true);
}

// Information ratio
export function informationRatio(productReturns, benchmarkReturns) {
  const annP = annualizeReturns(productReturns);
  const annB = annualizeReturns(benchmarkReturns);
  const te = trackingError(productReturns, benchmarkReturns);
  if (annP === null || annB === null || !te || te === 0) return null;
  return (annP - annB) / te;
}

// Skewness
export function skewness(returns) {
  if (returns.length < 3) return null;
  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const m2 = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / n;
  const m3 = returns.reduce((acc, r) => acc + Math.pow(r - mean, 3), 0) / n;
  return m2 === 0 ? null : m3 / Math.pow(m2, 1.5);
}

// Kurtosis (excess)
export function kurtosis(returns) {
  if (returns.length < 4) return null;
  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const m2 = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / n;
  const m4 = returns.reduce((acc, r) => acc + Math.pow(r - mean, 4), 0) / n;
  return m2 === 0 ? null : m4 / Math.pow(m2, 2) - 3;
}

// Calmar ratio
export function calmarRatio(returns) {
  const ann = annualizeReturns(returns);
  const mdd = maxDrawdown(returns);
  if (ann === null || !mdd || mdd === 0) return null;
  return ann / Math.abs(mdd);
}

// Value at Risk (parametric, 95%)
export function valueAtRisk(returns, confidence = 0.95) {
  if (returns.length < 5) return null;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return sorted[idx];
}

// Conditional VaR (CVaR / ES)
export function conditionalVaR(returns, confidence = 0.95) {
  if (returns.length < 5) return null;
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoff = Math.floor((1 - confidence) * sorted.length);
  const tail = sorted.slice(0, cutoff + 1);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

// Up/Down period percentage
export function upPeriodPercent(returns) {
  if (!returns.length) return null;
  return (returns.filter(r => r > 0).length / returns.length) * 100;
}
export function downPeriodPercent(returns) {
  if (!returns.length) return null;
  return (returns.filter(r => r < 0).length / returns.length) * 100;
}

// Best / Worst period
export function bestPeriod(returns) { return returns.length ? Math.max(...returns) : null; }
export function worstPeriod(returns) { return returns.length ? Math.min(...returns) : null; }

// Average return (annualized)
export function averageReturn(returns) { return annualizeReturns(returns); }
export function averagePositiveReturn(returns) {
  const pos = returns.filter(r => r > 0);
  return pos.length ? pos.reduce((a, b) => a + b, 0) / pos.length : null;
}
export function averageNegativeReturn(returns) {
  const neg = returns.filter(r => r < 0);
  return neg.length ? neg.reduce((a, b) => a + b, 0) / neg.length : null;
}

// Growth of $100
export function growthOf100(returns) {
  if (!returns.length) return null;
  return returns.reduce((acc, r) => acc * (1 + r / 100), 100);
}

// Variance (annualized)
export function variance(returns) {
  const sd = stdDev(returns, true);
  return sd !== null ? sd * sd : null;
}

// Treynor ratio
export function treynorRatio(returns, benchmarkReturns) {
  const ann = annualizeReturns(returns);
  const b = beta(returns, benchmarkReturns);
  if (ann === null || b === null || b === 0) return null;
  return ann / b;
}

// ── Trailing Period Helpers ───────────────────────────────────────────────────

// Calculate trailing period start date using month-end logic
// For trailing N months ending on month-end, go back (N-1) months to capture N month-ends total
// Example: Trailing 3M ending March 2026 → start = January 2026 (captures Jan, Feb, Mar = 3 months)
function getTrailingStartDate(code, periodEnd, inceptionDate) {
  const endDate = parseMDY(periodEnd) || new Date();
  // Ensure we're working with month-end dates
  const endMonthEnd = getLastDayOfMonth(endDate.getFullYear(), endDate.getMonth());
  
  const yearStart = new Date(endDate.getFullYear(), 0, 1);
  const qStartMonth = Math.floor(endDate.getMonth() / 3) * 3;
  const qtdStart = new Date(endDate.getFullYear(), qStartMonth, 1);

  const offsets = {
    // For month-based periods, calculate start date as the prior month-end to capture exact month-end returns
    // Monthly returns are stored as month-end dates (e.g., Jan return = 01/31), so start date should be the month-end BEFORE the first month to include
    // Example: YTD ending 03/31/2026 → start = 12/31/2025 (captures 01/31, 02/28, 03/31 = 3 months)
    // Example: Trailing 3M ending 03/31/2026 → start = 12/31/2025 (captures 01/31, 02/28, 03/31 = 3 months)
    // Example: Trailing 1M ending 03/31/2026 → start = 02/28/2026 (captures only 03/31 = 1 month)
    "1M": () => getLastDayOfMonth(endMonthEnd.getFullYear(), endMonthEnd.getMonth() - 1), // Prior month-end
    "3M": () => getLastDayOfMonth(endMonthEnd.getFullYear(), endMonthEnd.getMonth() - 3), // 3 months back
    "QTD": () => getLastDayOfMonth(endDate.getFullYear(), qtdStart.getMonth() - 1), // Quarter start month-end
    "YTD": () => new Date(endDate.getFullYear() - 1, 11, 31), // Prior year-end (12/31)
    "1Y": () => getLastDayOfMonth(endMonthEnd.getFullYear() - 1, endMonthEnd.getMonth()), // 12 months back
    "2Y": () => getLastDayOfMonth(endMonthEnd.getFullYear() - 2, endMonthEnd.getMonth()), // 24 months back
    "3Y": () => getLastDayOfMonth(endMonthEnd.getFullYear() - 3, endMonthEnd.getMonth()), // 36 months back
    "4Y": () => getLastDayOfMonth(endMonthEnd.getFullYear() - 4, endMonthEnd.getMonth()), // 48 months back
    "5Y": () => getLastDayOfMonth(endMonthEnd.getFullYear() - 5, endMonthEnd.getMonth()), // 60 months back
    "7Y": () => getLastDayOfMonth(endMonthEnd.getFullYear() - 7, endMonthEnd.getMonth()), // 84 months back
    "10Y": () => getLastDayOfMonth(endMonthEnd.getFullYear() - 10, endMonthEnd.getMonth()), // 120 months back
    "since_inception": () => inceptionDate ? (inceptionDate.includes("/") ? parseMDY(inceptionDate) : parseYMD(inceptionDate)) : null,
  };
  const fn = offsets[code];
  if (!fn) return null;
  const d = fn();
  if (!d) return null;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatDateToMDY(date) {
  if (!date) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

// ── Period Sorting ─────────────────────────────────────────────────────────────

// Sort order for trailing periods (by months approximately)
const TRAILING_SORT_ORDER = {
  "1M": 1, "3M": 3, "QTD": 3, "YTD": 6, "1Y": 12, "2Y": 24, "3Y": 36,
  "4Y": 48, "5Y": 60, "7Y": 84, "10Y": 120, "since_inception": 9999, "custom": 9998
};

function getTrailingSortValue(code) {
  return TRAILING_SORT_ORDER[code] || 9999;
}

function getRollingSortValue(code) {
  const order = { "1M": 1, "2M": 2, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60, "10Y": 120, "custom": 9999 };
  return order[code] || 9999;
}

// Sort windows to ensure logical chronological/numerical order
function sortWindows(windows) {
  return windows.sort((a, b) => {
    // Group by type first: trailing, rolling, cumulative, calendar, historical
    const typeOrder = { trailing: 0, rolling: 1, rolling_single: 1, cumulative: 2, calendar: 3, historical: 4 };
    const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
    if (typeDiff !== 0) return typeDiff;

    // Within trailing periods, sort by numeric order
    if (a.type === "trailing") {
      const aVal = getTrailingSortValue(a.originalCode || a.label);
      const bVal = getTrailingSortValue(b.originalCode || b.label);
      return aVal - bVal;
    }

    // Within rolling periods, sort by numeric order
    if (a.type === "rolling" || a.type === "rolling_single") {
      const aVal = getRollingSortValue(a.originalCode || a.label);
      const bVal = getRollingSortValue(b.originalCode || b.label);
      return aVal - bVal;
    }

    // Calendar years: sort numerically
    if (a.type === "calendar") {
      const aYear = parseInt(a.label) || 9999;
      const bYear = parseInt(b.label) || 9999;
      return aYear - bYear;
    }

    // Historical: keep original order
    return 0;
  });
}

// ── Master Compute Function ───────────────────────────────────────────────────

export function computeAttributeValue(attribute, returns, benchmarkReturns) {
  if (!returns || returns.length === 0) return null;
  const hasBm = benchmarkReturns && benchmarkReturns.length > 0;

  switch (attribute) {
    case "Return": return annualizeReturns(returns);
    case "Cumulative Return": return cumulativeReturn(returns);
    case "Excess Return": return hasBm ? annualizeReturns(returns) - annualizeReturns(benchmarkReturns) : null;
    case "Cumulative Excess Return": return hasBm ? cumulativeReturn(returns) - cumulativeReturn(benchmarkReturns) : null;
    case "Excess Return Geometric": return hasBm ? ((1 + annualizeReturns(returns) / 100) / (1 + annualizeReturns(benchmarkReturns) / 100) - 1) * 100 : null;
    case "Average Return": return averageReturn(returns);
    case "Average Positive Return": return averagePositiveReturn(returns);
    case "Average Negative Return": return averageNegativeReturn(returns);
    case "Growth of $100": return growthOf100(returns);
    case "Best Period": return bestPeriod(returns);
    case "Worst Period": return worstPeriod(returns);
    case "Down Period Percent": return downPeriodPercent(returns);
    case "Up Period Percent": return upPeriodPercent(returns);
    case "Percent Profitable Period": return upPeriodPercent(returns);
    case "Number of Observations": return returns.length;
    case "Standard Deviation": return stdDev(returns, true);
    case "Downside Deviation": return downsideDeviation(returns);
    case "Variance": return variance(returns);
    case "Skewness": return skewness(returns);
    case "Kurtosis": return kurtosis(returns);
    case "Information Ratio": return hasBm ? informationRatio(returns, benchmarkReturns) : null;
    case "Sharpe Ratio": return sharpeRatio(returns);
    case "Sortino Ratio": return sortinoRatio(returns);
    case "Beta": return hasBm ? beta(returns, benchmarkReturns) : null;
    case "Alpha": return hasBm ? alpha(returns, benchmarkReturns) : null;
    case "R-Squared": return hasBm ? rSquared(returns, benchmarkReturns) : null;
    case "Tracking Error": return hasBm ? trackingError(returns, benchmarkReturns) : null;
    case "Treynor Ratio": return hasBm ? treynorRatio(returns, benchmarkReturns) : null;
    case "Maximum Drawdown": return maxDrawdown(returns);
    case "Average Drawdown": return maxDrawdown(returns);
    case "Value at Risk (VaR)": return valueAtRisk(returns);
    case "Conditional VaR (CVaR)": return conditionalVaR(returns);
    case "Calmar Ratio": return calmarRatio(returns);
    case "Recovery Factor": { const mdd = maxDrawdown(returns); const cum = cumulativeReturn(returns); return mdd && mdd !== 0 ? cum / Math.abs(mdd) : null; }
    case "Population Variance": { const n = returns.length; if (n < 2) return null; const mean = returns.reduce((a, b) => a + b, 0) / n; return returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / n; }
    case "Population Standard Deviation": { const pv = computeAttributeValue("Population Variance", returns, benchmarkReturns); return pv !== null ? Math.sqrt(pv) * Math.sqrt(12) : null; }
    case "Population Skewness": return skewness(returns);
    case "Population Kurtosis": return kurtosis(returns);
    default: return null;
  }
}

// Determines if value is a ratio/count (not a percentage)
export function isRatioMetric(attribute) {
  return [
    "Beta", "Alpha", "R-Squared", "Information Ratio", "Sharpe Ratio",
    "Sortino Ratio", "Treynor Ratio", "Calmar Ratio", "Recovery Factor",
    "Number of Observations", "Growth of $100", "Skewness", "Kurtosis",
    "Population Skewness", "Population Kurtosis", "Variance", "Population Variance",
    "Population Standard Deviation",
  ].includes(attribute);
}

// ── Main analysis compute entry point ────────────────────────────────────────

export function runAnalysis({ analysis, allSeries, allBenchmarks }) {
  const periodStart = analysis?.period_start;
  const periodEnd = analysis?.period_end;

  // Support both new (top-level categories_config) and legacy (selected_types + attributes + measurement_periods) formats
  let categoriesConfig = analysis?.categories_config ?? analysis?.measurement_type?.categories_config ?? [];
  if (!categoriesConfig.length) {
    // Build a synthetic category from legacy fields
    const mp = analysis?.measurement_periods ?? {};
    const legacyPeriodConfig = {
      trailing: mp.trailing_periods ?? [],
      trailing_custom_start: mp.trailing_custom_start ?? "",
      trailing_custom_end: mp.trailing_custom_end ?? "",
      rolling: mp.rolling_periods ?? [],
      rolling_custom_start: mp.rolling_custom_start ?? "",
      rolling_custom_end: mp.rolling_custom_end ?? "",
      cumulative: mp.include_cumulative ?? false,
      calendar_years: mp.calendar_years ?? [],
      historical: mp.historical_periods ?? [],
    };
    const attrs = analysis?.measurement_type?.attributes ?? [];
    const types = analysis?.measurement_type?.selected_types ?? [];
    // If no periods selected at all, default to a full-period cumulative window
    const hasPeriod = legacyPeriodConfig.trailing.length || legacyPeriodConfig.rolling.length ||
      legacyPeriodConfig.cumulative || legacyPeriodConfig.calendar_years.length || legacyPeriodConfig.historical.length;
    if (!hasPeriod) legacyPeriodConfig.cumulative = true;

    if (attrs.length > 0 || types.length > 0) {
      categoriesConfig = [{
        category: types[0] ?? "performance",
        attributes: attrs.length ? attrs : ["Return", "Cumulative Return", "Standard Deviation", "Sharpe Ratio"],
        periodConfig: legacyPeriodConfig,
        benchmarkConfig: { show_default: true, secondary_benchmark_ids: [] },
      }];
    } else {
      // Absolute fallback: show basic performance stats over the full analysis period
      categoriesConfig = [{
        category: "performance",
        attributes: ["Return", "Cumulative Return", "Standard Deviation", "Sharpe Ratio", "Maximum Drawdown"],
        periodConfig: { cumulative: true, trailing: [], rolling: [], calendar_years: [], historical: [] },
        benchmarkConfig: { show_default: true, secondary_benchmark_ids: [] },
      }];
    }
  }

  const results = [];

  for (const productConfig of (analysis?.product_configs ?? [])) {
    const productId = productConfig.product_id;
    const returnType = productConfig.return_type ?? "gross";
    const series = allSeries.filter(s => s.product_id === productId);
    const allMonthly = series.flatMap(s => s.monthly_returns ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const inceptionDate = series[0]?.inception_date || allMonthly[0]?.date || "";

    const bmIds = productConfig.benchmark_ids ?? [];
    const bmSeries = bmIds.map(bmId => allBenchmarks.find(b => b.id === bmId)).filter(Boolean);

    const productResult = {
      productName: productConfig.product_name,
      firmName: productConfig.firm_name,
      returnType,
      benchmarkNames: productConfig.benchmark_names ?? [],
      categories: [],
    };

    for (const catCfg of categoriesConfig) {
      const { category, attributes, periodConfig, benchmarkConfig } = catCfg;
      const showDefault = benchmarkConfig?.show_default !== false;
      const secondaryBmIds = benchmarkConfig?.secondary_benchmark_ids ?? [];
      const activeBmSeries = [
        ...(showDefault ? bmSeries : []),
        ...secondaryBmIds.map(id => allBenchmarks.find(b => b.id === id)).filter(Boolean),
      ];
      const primaryBm = activeBmSeries[0];

      const categoryResult = {
        category,
        periodResults: [],
      };

      // ── Build list of period windows to compute ────────────────────────────
      const windows = [];
      const pc = periodConfig || {};

      // Trailing periods
      for (const code of (pc.trailing ?? [])) {
        const start = getTrailingStartDate(code, periodEnd || formatDateToMDY(new Date()), inceptionDate);
        if (start) {
          const labels = { "1M": "1 Month", "3M": "3 Months", "QTD": "QTD", "YTD": "YTD", "1Y": "1 Year", "2Y": "2 Years", "3Y": "3 Years", "4Y": "4 Years", "5Y": "5 Years", "7Y": "7 Years", "10Y": "10 Years", "since_inception": "Since Inception" };
          windows.push({ label: labels[code] || code, start, end: periodEnd || formatDateToMDY(new Date()), type: "trailing", originalCode: code });
        }
      }
      // Legacy single custom trailing (backwards compat)
      if (pc.trailing_custom_start && pc.trailing_custom_end) {
        windows.push({ label: "Custom Trailing", start: pc.trailing_custom_start, end: pc.trailing_custom_end, type: "trailing", originalCode: "custom" });
      }
      // Multiple custom trailing periods
      for (const cp of (pc.trailing_custom_periods ?? [])) {
        if (cp.start && cp.end) {
          windows.push({ label: cp.label || `${cp.start} – ${cp.end}`, start: cp.start, end: cp.end, type: "trailing", originalCode: "custom" });
        }
      }

      // Rolling periods: compute a rolling series (one data point per month)
      const rollMonths = { "1M": 1, "2M": 2, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60, "10Y": 120 };
      for (const code of (pc.rolling ?? [])) {
        const months = rollMonths[code];
        if (months) {
          const labels = { "1M": "Rolling 1M", "2M": "Rolling 2M", "3M": "Rolling 3M", "6M": "Rolling 6M", "1Y": "Rolling 1Y", "3Y": "Rolling 3Y", "5Y": "Rolling 5Y", "10Y": "Rolling 10Y" };
          windows.push({ label: labels[code] || code, windowMonths: months, type: "rolling", start: periodStart, end: periodEnd, originalCode: code });
        }
      }
      // Legacy single custom rolling (backwards compat)
      if (pc.rolling_custom_start && pc.rolling_custom_end) {
        windows.push({ label: "Custom Rolling", start: pc.rolling_custom_start, end: pc.rolling_custom_end, type: "rolling_single", originalCode: "custom" });
      }
      // Multiple custom rolling periods (treated as fixed-range, not a rolling window)
      for (const cp of (pc.rolling_custom_periods ?? [])) {
        if (cp.start && cp.end) {
          windows.push({ label: cp.label || `${cp.start} – ${cp.end}`, start: cp.start, end: cp.end, type: "trailing", originalCode: "custom" });
        }
      }

      // Cumulative
      if (pc.cumulative) {
        windows.push({ label: "Cumulative", start: periodStart, end: periodEnd, type: "cumulative" });
      }

      // Calendar years - use month-end dates for consistency
      for (const year of (pc.calendar_years ?? [])) {
        const s = `01/01/${year}`, e = `12/31/${year}`;
        windows.push({ label: String(year), start: s, end: e, type: "calendar" });
      }
      if (pc.calendar_include_ctd) {
        const now = new Date();
        const ctdStart = `01/01/${now.getFullYear()}`;
        // Use current month-end for CTD end date
        const ctdEnd = formatDateToMDY(getLastDayOfMonth(now.getFullYear(), now.getMonth()));
        windows.push({ label: "CTD", start: ctdStart, end: ctdEnd, type: "calendar" });
      }

      // Historical periods
      for (const freq of (pc.historical ?? [])) {
        windows.push({ label: freq.charAt(0).toUpperCase() + freq.slice(1), start: periodStart, end: periodEnd, type: "historical", freq });
      }

      // Sort windows to ensure logical order
      sortWindows(windows);

      // ── Compute each window ────────────────────────────────────────────────
      for (const win of windows) {
        let filteredProduct, filteredBm;

        if (win.type === "rolling") {
          // Rolling: compute a time-series of rolling window results — pick the latest one for summary
          const allFiltered = filterReturns(allMonthly, win.start, win.end);
          const bmFiltered = primaryBm ? filterReturns(primaryBm.monthly_returns ?? [], win.start, win.end) : [];
          // Build rolling results as array of { date, values }
          const rollingData = [];
          for (let i = win.windowMonths; i <= allFiltered.length; i++) {
            const slice = allFiltered.slice(i - win.windowMonths, i).map(r => returnType === "net" ? (r.net_return ?? r.return_value) : r.return_value);
            const bmSlice = bmFiltered.slice(Math.max(0, i - win.windowMonths), i).map(r => r.return_value);
            const endDate = allFiltered[i - 1]?.date;
            const entry = { date: endDate, values: {} };
            for (const attr of (attributes ?? [])) {
              entry.values[attr] = computeAttributeValue(attr, slice, bmSlice.length ? bmSlice : null);
            }
            rollingData.push(entry);
          }
          categoryResult.periodResults.push({ window: win, rollingData, isRolling: true });
          continue;
        }

        if (win.type === "historical") {
          filteredProduct = filterReturns(allMonthly, win.start, win.end);
          filteredBm = primaryBm ? filterReturns(primaryBm.monthly_returns ?? [], win.start, win.end) : [];
          // Group by freq
          const groupReturns = (rows, freq) => {
            const grouped = {};
            for (const r of rows) {
              const d = new Date(r.date + "T00:00:00");
              let key;
              if (freq === "monthly") key = r.date.slice(0, 7);
              else if (freq === "quarterly") { const q = Math.floor(d.getMonth() / 3) + 1; key = `${d.getFullYear()} Q${q}`; }
              else key = String(d.getFullYear());
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(returnType === "net" ? (r.net_return ?? r.return_value) : r.return_value);
            }
            return Object.entries(grouped).map(([label, vals]) => ({ label, value: cumulativeReturn(vals) }));
          };
          const productGroups = groupReturns(filteredProduct, win.freq);
          const bmGroups = groupReturns(filteredBm, win.freq);
          categoryResult.periodResults.push({ window: win, historicalData: productGroups, bmHistoricalData: bmGroups, isHistorical: true });
          continue;
        }

        filteredProduct = filterReturns(allMonthly, win.start, win.end)
          .map(r => returnType === "net" ? (r.net_return ?? r.return_value) : r.return_value);
        filteredBm = primaryBm ? filterReturns(primaryBm.monthly_returns ?? [], win.start, win.end).map(r => r.return_value) : [];

        const attributeValues = {};
        const bmValues = {};
        for (const attr of (attributes ?? [])) {
          attributeValues[attr] = computeAttributeValue(attr, filteredProduct, filteredBm.length ? filteredBm : null);
          if (primaryBm) bmValues[attr] = computeAttributeValue(attr, filteredBm, null);
        }

        categoryResult.periodResults.push({
          window: win,
          attributeValues,
          bmValues: primaryBm ? bmValues : null,
          observations: filteredProduct.length,
        });
      }

      productResult.categories.push(categoryResult);
    }

    results.push(productResult);
  }

  return results;
}