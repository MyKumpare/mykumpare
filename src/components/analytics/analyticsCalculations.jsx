// ── Return Series Helpers ─────────────────────────────────────────────────────

const parseMDY = (mdy) => {
  if (!mdy) return null;
  const [m, d, y] = mdy.split("/").map(Number);
  return new Date(y, m - 1, d);
};

const parseYMD = (ymd) => {
  if (!ymd) return null;
  return new Date(ymd + "T00:00:00");
};

// Filter monthly returns within [startDate, endDate] (both inclusive)
export function filterReturns(monthlyReturns, startStr, endStr, returnField = "return_value") {
  if (!monthlyReturns?.length) return [];
  const start = startStr?.includes("/") ? parseMDY(startStr) : parseYMD(startStr);
  const end = endStr?.includes("/") ? parseMDY(endStr) : parseYMD(endStr);
  return monthlyReturns
    .filter((r) => {
      const d = parseYMD(r.date);
      if (!d) return false;
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

function getTrailingStartDate(code, periodEnd, inceptionDate) {
  const endDate = parseMDY(periodEnd) || new Date();
  const yearStart = new Date(endDate.getFullYear(), 0, 1);
  const qStartMonth = Math.floor(endDate.getMonth() / 3) * 3;
  const qtdStart = new Date(endDate.getFullYear(), qStartMonth, 1);

  const offsets = {
    "1M": () => new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate()),
    "3M": () => new Date(endDate.getFullYear(), endDate.getMonth() - 3, endDate.getDate()),
    "QTD": () => qtdStart,
    "YTD": () => yearStart,
    "1Y": () => new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate()),
    "2Y": () => new Date(endDate.getFullYear() - 2, endDate.getMonth(), endDate.getDate()),
    "3Y": () => new Date(endDate.getFullYear() - 3, endDate.getMonth(), endDate.getDate()),
    "4Y": () => new Date(endDate.getFullYear() - 4, endDate.getMonth(), endDate.getDate()),
    "5Y": () => new Date(endDate.getFullYear() - 5, endDate.getMonth(), endDate.getDate()),
    "7Y": () => new Date(endDate.getFullYear() - 7, endDate.getMonth(), endDate.getDate()),
    "10Y": () => new Date(endDate.getFullYear() - 10, endDate.getMonth(), endDate.getDate()),
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
  const categoriesConfig = analysis?.measurement_type?.categories_config ?? [];
  const periodStart = analysis?.period_start;
  const periodEnd = analysis?.period_end;

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
        if (code === "custom") {
          if (pc.trailing_custom_start && pc.trailing_custom_end) {
            windows.push({ label: "Custom Trailing", start: pc.trailing_custom_start, end: pc.trailing_custom_end, type: "trailing" });
          }
        } else {
          const start = getTrailingStartDate(code, periodEnd || formatDateToMDY(new Date()), inceptionDate);
          if (start) {
            const labels = { "1M": "1 Month", "3M": "3 Months", "QTD": "QTD", "YTD": "YTD", "1Y": "1 Year", "2Y": "2 Years", "3Y": "3 Years", "4Y": "4 Years", "5Y": "5 Years", "7Y": "7 Years", "10Y": "10 Years", "since_inception": "Since Inception" };
            windows.push({ label: labels[code] || code, start, end: periodEnd || formatDateToMDY(new Date()), type: "trailing" });
          }
        }
      }

      // Rolling periods: compute a rolling series (one data point per month)
      for (const code of (pc.rolling ?? [])) {
        const rollMonths = { "1M": 1, "2M": 2, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60, "10Y": 120, "custom": null };
        const months = code === "custom" ? null : rollMonths[code];
        if (code === "custom" && pc.rolling_custom_start && pc.rolling_custom_end) {
          windows.push({ label: "Custom Rolling", start: pc.rolling_custom_start, end: pc.rolling_custom_end, type: "rolling_single" });
        } else if (months) {
          const labels = { "1M": "Rolling 1M", "2M": "Rolling 2M", "3M": "Rolling 3M", "6M": "Rolling 6M", "1Y": "Rolling 1Y", "3Y": "Rolling 3Y", "5Y": "Rolling 5Y", "10Y": "Rolling 10Y" };
          windows.push({ label: labels[code] || code, windowMonths: months, type: "rolling", start: periodStart, end: periodEnd });
        }
      }

      // Cumulative
      if (pc.cumulative) {
        windows.push({ label: "Cumulative", start: periodStart, end: periodEnd, type: "cumulative" });
      }

      // Calendar years
      for (const year of (pc.calendar_years ?? [])) {
        const s = `01/01/${year}`, e = `12/31/${year}`;
        windows.push({ label: String(year), start: s, end: e, type: "calendar" });
      }
      if (pc.calendar_include_ctd) {
        const now = new Date();
        const ctdStart = `01/01/${now.getFullYear()}`;
        const ctdEnd = formatDateToMDY(now);
        windows.push({ label: "CTD", start: ctdStart, end: ctdEnd, type: "calendar" });
      }

      // Historical periods
      for (const freq of (pc.historical ?? [])) {
        windows.push({ label: freq.charAt(0).toUpperCase() + freq.slice(1), start: periodStart, end: periodEnd, type: "historical", freq });
      }

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