import { base44 } from "@/api/base44Client";

/**
 * Fetch all portfolios associated with a firm, covering three relationships:
 *  1. Allocator  — portfolio.firm_id === firmId (the firm owns the client portfolio)
 *  2. Advisor    — portfolio.advisor_firm_id === firmId (the firm is the investment manager)
 *  3. Sub-manager — any of the firm's products appears in a portfolio's sub_managers[] array
 *                   (the firm's product is held inside a multi-manager product run by another advisor)
 *
 * The sub-manager case is the one most commonly missed: a portfolio's advisor_firm_id
 * points at the MoM firm, not the sub-manager firm, so a simple advisor_firm_id filter
 * returns nothing for sub-manager firms.
 *
 * @param {string} firmId
 * @param {object} [options]
 * @param {boolean} [options.includeSubManager=true] — include portfolios where the firm's
 *   products are sub-managers (requires fetching the firm's products + all portfolios).
 * @returns {Promise<{ portfolios: Array, products: Array, roleMap: Object }>}
 *   roleMap: { [portfolioId]: { isAllocator, isAdvisor, isSubManager, matchedProductIds: [] } }
 */
export async function fetchFirmAssociatedPortfolios(firmId, options = {}) {
  const { includeSubManager = true } = options;
  if (!firmId) return { portfolios: [], products: [], roleMap: {} };

  // Always fetch the firm's products (needed for sub-manager matching + funded-product counts).
  const products = await base44.entities.Product.filter(
    { firm_id: firmId },
    "-created_date",
    500
  );
  const liveProducts = products.filter((p) => !p.deleted_at);
  const productIds = new Set(liveProducts.map((p) => p.id));

  // Fetch allocator + advisor portfolios directly.
  const [allocatorPortfolios, advisorPortfolios] = await Promise.all([
    base44.entities.Portfolio.filter({ firm_id: firmId }, "-created_date", 500),
    base44.entities.Portfolio.filter({ advisor_firm_id: firmId }, "-created_date", 500),
  ]);

  const seen = new Set();
  const merged = [];
  const roleMap = {};

  const addPortfolio = (p, role) => {
    if (!p || seen.has(p.id)) {
      if (p && roleMap[p.id]) {
        // Merge roles for an already-seen portfolio
        if (role === "allocator") roleMap[p.id].isAllocator = true;
        if (role === "advisor") roleMap[p.id].isAdvisor = true;
      }
      return;
    }
    seen.add(p.id);
    merged.push(p);
    roleMap[p.id] = {
      isAllocator: role === "allocator",
      isAdvisor: role === "advisor",
      isSubManager: false,
      matchedProductIds: [],
    };
  };

  for (const p of allocatorPortfolios) addPortfolio(p, "allocator");
  for (const p of advisorPortfolios) addPortfolio(p, "advisor");

  // Sub-manager case: scan all portfolios for sub_managers[] entries whose product_id
  // belongs to this firm. We fetch a broad list and filter client-side because there
  // is no server-side filter for "sub_managers contains product_id in <set>".
  if (includeSubManager && productIds.size > 0) {
    const allPortfolios = await base44.entities.Portfolio.list("-created_date", 500);
    for (const p of allPortfolios) {
      if (!p || p.deleted_at) continue;
      const subs = Array.isArray(p.sub_managers) ? p.sub_managers : [];
      const matched = subs
        .filter((sm) => sm.product_id && productIds.has(sm.product_id))
        .map((sm) => sm.product_id);
      if (matched.length > 0) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          merged.push(p);
          roleMap[p.id] = {
            isAllocator: p.firm_id === firmId,
            isAdvisor: p.advisor_firm_id === firmId,
            isSubManager: true,
            matchedProductIds: matched,
          };
        } else {
          roleMap[p.id].isSubManager = true;
          roleMap[p.id].matchedProductIds = [
            ...new Set([...(roleMap[p.id].matchedProductIds || []), ...matched]),
          ];
        }
      }
    }
  }

  return { portfolios: merged, products: liveProducts, roleMap };
}

/**
 * Compute the net funding for a single portfolio from its allocation_history records.
 * For advisor/allocator view: portfolio + advisor level records.
 * For sub-manager view: sub_manager level records matching the firm's product IDs.
 *
 * @param {object} portfolio
 * @param {string[]} [matchedProductIds] — product IDs that belong to this firm (for sub-manager filtering)
 * @param {object} [role] — { isAllocator, isAdvisor, isSubManager }
 * @returns {number} net funding amount
 */
export function computePortfolioNetFunding(portfolio, matchedProductIds = [], role = {}) {
  const history = Array.isArray(portfolio.allocation_history) ? portfolio.allocation_history : [];
  let records;
  if (role.isSubManager && !role.isAdvisor && !role.isAllocator) {
    // Sub-manager-only view: sum sub_manager records for this firm's products
    const idSet = new Set(matchedProductIds);
    records = history.filter(
      (r) => r.level === "sub_manager" && idSet.has(r.reference_id)
    );
  } else {
    // Advisor/allocator view: portfolio + advisor level records (cash flows through the advisor)
    records = history.filter(
      (r) => r.level === "portfolio" || r.level === "advisor"
    );
  }
  let total = 0;
  for (const r of records) {
    const amt = Number(r.amount) || 0;
    if (r.activity_type === "Redemption") {
      total -= Math.abs(amt);
    } else {
      total += amt;
    }
  }
  // Fallback to initial allocation amounts when no history records exist
  if (total === 0 && records.length === 0) {
    if (role.isSubManager && !role.isAdvisor && !role.isAllocator) {
      // Sum sub-manager initial allocations from the sub_managers array
      const subs = Array.isArray(portfolio.sub_managers) ? portfolio.sub_managers : [];
      const idSet = new Set(matchedProductIds);
      for (const sm of subs) {
        if (idSet.has(sm.product_id) && sm.funding_status !== "Terminated") {
          total += Number(sm.initial_allocation_amount) || 0;
        }
      }
    } else {
      total += Number(portfolio.advisor_initial_allocation_amount) || Number(portfolio.initial_allocation_amount) || 0;
    }
  }
  return total;
}