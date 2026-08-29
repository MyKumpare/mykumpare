// Shared reconciliation logic for portfolio allocation history.
// Ensures every portfolio-level cash flow cascades through the Investment
// Manager (advisor) and, for multi-manager products, down to sub-managers.
//
// Used by:
//   - PortfolioAllocationHistoryTab (single-portfolio "Reconcile Now")
//   - PortfoliosSection (bulk "Reconcile All" across every portfolio)

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/**
 * Find portfolio-level records that lack a linked advisor (downstream) record.
 * These are "un-cascaded" legacy records that need reconciliation.
 */
export function findUnCascadedRecords(allocationHistory) {
  const portfolioRecords = (allocationHistory || []).filter(
    (a) => a.level === "portfolio" && !a.source_record_id
  );
  return portfolioRecords.filter(
    (r) =>
      !(allocationHistory || []).some(
        (a) => a.source_record_id === r.id && a.level === "advisor"
      )
  );
}

/**
 * Given a portfolio (with allocation_history, advisor_type, advisor_firm_id,
 * advisor_firm_name, advisor_product_type, sub_managers), return a new
 * allocation_history array with all un-cascaded portfolio records reconciled:
 * each gets a linked advisor record (full amount) and, for multi-manager
 * products, equally-distributed sub-manager records.
 *
 * Returns { newData, reconciledCount, isMultiManager, subManagerCount } or
 * null if the portfolio has no advisor to cascade to.
 */
export function reconcilePortfolioAllocationHistory(portfolio) {
  const hasAdvisor = !!(portfolio.advisor_type && portfolio.advisor_firm_id);
  if (!hasAdvisor) return null;

  const isMultiManager = portfolio.advisor_product_type === "Multi-Manager Product";
  const subManagers = portfolio.sub_managers || [];
  const allocData = portfolio.allocation_history || [];

  const unCascaded = findUnCascadedRecords(allocData);
  if (unCascaded.length === 0) {
    return {
      newData: allocData,
      reconciledCount: 0,
      isMultiManager,
      subManagerCount: subManagers.length,
    };
  }

  let newData = [...allocData];
  unCascaded.forEach((rec) => {
    // Linked advisor record (full amount cascades through IM)
    newData.push({
      id: genId(),
      activity_date: rec.activity_date,
      activity_type: rec.activity_type,
      amount: rec.amount,
      notes: rec.notes,
      document: rec.document,
      level: "advisor",
      reference_id: portfolio.advisor_firm_id,
      reference_name: `IM: ${portfolio.advisor_firm_name || ""}`,
      source_record_id: rec.id,
    });
    // For multi-manager, equally distribute across sub-managers
    if (isMultiManager && subManagers.length > 0) {
      const per = rec.amount / subManagers.length;
      const rounded = Math.floor(per * 100) / 100;
      subManagers.forEach((sm, i) => {
        let amt = rounded;
        if (i === subManagers.length - 1) {
          const allocated = rounded * (subManagers.length - 1);
          amt = Math.round((rec.amount - allocated) * 100) / 100;
        }
        newData.push({
          id: genId(),
          activity_date: rec.activity_date,
          activity_type: rec.activity_type,
          amount: amt,
          notes: rec.notes,
          document: rec.document,
          level: "sub_manager",
          reference_id: sm.product_id,
          reference_name: `Sub-Manager: ${sm.product_name || ""}`,
          source_record_id: rec.id,
        });
      });
    }
  });

  return {
    newData,
    reconciledCount: unCascaded.length,
    isMultiManager,
    subManagerCount: subManagers.length,
  };
}

/**
 * Check whether a portfolio has outstanding (un-cascaded) records.
 */
export function hasOutstandingReconciliation(portfolio) {
  const hasAdvisor = !!(portfolio.advisor_type && portfolio.advisor_firm_id);
  if (!hasAdvisor) return false;
  return findUnCascadedRecords(portfolio.allocation_history || []).length > 0;
}