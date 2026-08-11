/**
 * Calculate total capital additions and redemptions from allocation history
 * for a given level (portfolio, advisor, sub_manager) and optional reference_id.
 */
export function calculateCapitalFlow(allocationHistory, level, referenceId) {
  const entries = (allocationHistory || []).filter(
    (e) => e.level === level && (!referenceId || e.reference_id === referenceId)
  );
  const totalAdditions = entries
    .filter((e) => e.activity_type === "Capital Addition")
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalRedemptions = entries
    .filter((e) => e.activity_type === "Redemption")
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  return { totalAdditions, totalRedemptions };
}

/**
 * Net Capital Flow = initial allocation + total additions - total redemptions
 */
export function calculateNetFlow(initialAllocation, totalAdditions, totalRedemptions) {
  const init = parseFloat(initialAllocation) || 0;
  return init + totalAdditions - totalRedemptions;
}

/**
 * Format a number as currency, or "—" if null/NaN.
 */
export function formatCurrency(n) {
  if (n == null || isNaN(n)) return "—";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}