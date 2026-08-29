import { base44 } from "@/api/base44Client";

/**
 * Append a funding-status history entry for a product. Captures every
 * transition (including 'started' — null → Funded/Terminated — and clears).
 * Silently no-ops when prev and next are identical so callers can pass through.
 *
 * @param {object} args
 * @param {string} args.productId
 * @param {string} [args.productName]
 * @param {string} [args.firmId]
 * @param {string|null} args.prevStatus  - previous funding status (Funded|Terminated|null)
 * @param {string|null} args.newStatus   - new funding status (Funded|Terminated|null)
 * @param {string} [args.source]        - "auto" | "manual"
 * @param {string} [args.changedById]
 * @param {string} [args.changedByName]
 * @param {string} [args.note]
 */
export async function logFundingStatusChange({
  productId,
  productName,
  firmId,
  prevStatus,
  newStatus,
  source = "auto",
  changedById,
  changedByName,
  note,
}) {
  const prev = prevStatus || null;
  const next = newStatus || null;
  if (prev === next) return; // no transition
  try {
    await base44.entities.FundingStatusHistory.create({
      product_id: productId,
      product_name: productName || "",
      firm_id: firmId || "",
      previous_status: prev || undefined,
      new_status: next || undefined,
      source,
      changed_by_id: changedById || "",
      changed_by_name: changedByName || "",
      note: note || "",
    });

    // Create a FundingStatusAlert so the team is notified of the change.
    await base44.entities.FundingStatusAlert.create({
      entity_type: "Product",
      entity_id: productId,
      entity_name: productName || "",
      firm_id: firmId || "",
      firm_name: "",
      product_id: productId,
      product_name: productName || "",
      previous_status: prev || undefined,
      new_status: next || undefined,
      source,
      changed_by_id: changedById || "",
      changed_by_name: changedByName || "",
      note: note || "",
      status: "active",
    });
  } catch (err) {
    console.error("logFundingStatusChange failed:", err);
  }
}

/**
 * Create a FundingStatusAlert for a firm-level funding status change.
 * Called from recomputeFirmFundingStatus when the firm's aggregate changes.
 */
async function logFirmFundingStatusAlert({ firmId, firmName, prevStatus, newStatus, note }) {
  const prev = prevStatus || null;
  const next = newStatus || null;
  if (prev === next) return;
  try {
    await base44.entities.FundingStatusAlert.create({
      entity_type: "Firm",
      entity_id: firmId,
      entity_name: firmName || "",
      firm_id: firmId,
      firm_name: firmName || "",
      product_id: "",
      product_name: "",
      previous_status: prev || undefined,
      new_status: next || undefined,
      source: "auto",
      note: note || "Firm aggregate funding status recomputed from products",
      status: "active",
    });
  } catch (err) {
    console.error("logFirmFundingStatusAlert failed:", err);
  }
}

/**
 * Recompute and persist a product's funding_status based on its due diligence
 * completion and portfolio state, then refresh the owning firm's aggregated
 * funding_status.
 *
 * Rules (auto-sync):
 * - "Funded"     → an active portfolio references this product
 *                  (advisor_product_id === product.id, funding_status "Active").
 * - "Terminated" → no active portfolio, but at least one terminated
 *                  portfolio references this product.
 * - null         → otherwise (no portfolio references this product yet).
 *
 * Manual override: if product.funding_status_manual === true, auto-sync is
 * skipped so a user's manual value sticks. Clearing the field (in the product
 * dialog) resets funding_status_manual to false and re-enables auto-sync.
 *
 * @param {object} product - Product record (must include id; firm_id used if present).
 * @param {object} queryClient - React Query client for cache invalidation.
 */
export async function syncProductFundingStatus(product, queryClient) {
  if (!product?.id) return;
  try {
    // Fetch the latest product — callers may pass a stale snapshot.
    const fresh = await base44.entities.Product.get(product.id);
    if (!fresh || fresh.deleted_at) return;

    // Respect manual override — auto-sync does not touch manually set products.
    if (fresh.funding_status_manual) {
      if (fresh.firm_id) await recomputeFirmFundingStatus(fresh.firm_id, queryClient);
      return;
    }

    // Portfolios referencing this product as the advisor product OR as a sub-manager
    // product. A product can be funded two ways:
    //   1. It is the advisor_product_id of a portfolio (direct advisor relationship)
    //   2. It appears in a portfolio's sub_managers[] array (sub-manager inside a
    //      multi-manager product run by another advisor firm)
    // The sub-manager case is missed by a simple advisor_product_id filter, so we
    // also scan all portfolios for sub_managers[] entries matching this product.
    const [advisorPortfolios, allPortfolios] = await Promise.all([
      base44.entities.Portfolio.filter({ advisor_product_id: fresh.id }, "-created_date", 500),
      base44.entities.Portfolio.list("-created_date", 500),
    ]);
    const subManagerPortfolios = allPortfolios.filter(
      (p) => !p.deleted_at &&
        Array.isArray(p.sub_managers) &&
        p.sub_managers.some((sm) => sm.product_id === fresh.id)
    );
    const live = [...advisorPortfolios, ...subManagerPortfolios].filter((p) => !p.deleted_at);
    const dedupedLive = [];
    const seenIds = new Set();
    for (const p of live) {
      if (!seenIds.has(p.id)) { seenIds.add(p.id); dedupedLive.push(p); }
    }
    const hasActive = dedupedLive.some((p) => (p.funding_status || "Active") === "Active");
    const hasTerminated = dedupedLive.some((p) => p.funding_status === "Terminated");

    let nextStatus = null;
    if (hasActive) {
      nextStatus = "Funded";
    } else if (hasTerminated) {
      nextStatus = "Terminated";
    }

    if ((fresh.funding_status || null) !== (nextStatus || null)) {
      await logFundingStatusChange({
        productId: fresh.id,
        productName: fresh.name,
        firmId: fresh.firm_id,
        prevStatus: fresh.funding_status,
        newStatus: nextStatus,
        source: "auto",
        note: "Auto-synced from portfolio allocation state",
      });
      await base44.entities.Product.update(fresh.id, {
        funding_status: nextStatus || undefined,
      });
      if (queryClient) queryClient.invalidateQueries({ queryKey: ["products"] });
    }

    if (fresh.firm_id) {
      await recomputeFirmFundingStatus(fresh.firm_id, queryClient);
    }
  } catch (err) {
    console.error("syncProductFundingStatus failed:", err);
  }
}

/**
 * Recompute the firm's aggregated funding_status from its products.
 * - "Funded"    → at least one product is "Funded".
 * - "Terminated" → no product is "Funded" but at least one is "Terminated".
 * - null        → no product has a funding status.
 *
 * @param {string} firmId - The firm whose aggregate to recompute.
 * @param {object} queryClient - React Query client for cache invalidation.
 */
export async function recomputeFirmFundingStatus(firmId, queryClient) {
  if (!firmId) return;
  try {
    const products = await base44.entities.Product.filter(
      { firm_id: firmId },
      "-created_date",
      500
    );
    const live = products.filter((p) => !p.deleted_at);

    let aggregate = null;
    if (live.some((p) => p.funding_status === "Funded")) {
      aggregate = "Funded";
    } else if (live.some((p) => p.funding_status === "Terminated")) {
      aggregate = "Terminated";
    }

    const firm = await base44.entities.Firm.get(firmId);
    if (firm && !firm.deleted_at && (firm.funding_status || null) !== (aggregate || null)) {
      await logFirmFundingStatusAlert({
        firmId,
        firmName: firm.name || "",
        prevStatus: firm.funding_status,
        newStatus: aggregate,
      });
      await base44.entities.Firm.update(firmId, {
        funding_status: aggregate || undefined,
      });
      if (queryClient) queryClient.invalidateQueries({ queryKey: ["firms"] });
    }
  } catch (err) {
    console.error("recomputeFirmFundingStatus failed:", err);
  }
}