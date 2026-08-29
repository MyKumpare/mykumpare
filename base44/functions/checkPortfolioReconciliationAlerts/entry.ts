import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * checkPortfolioReconciliationAlerts
 *
 * Flags portfolios where the sum of sub-manager allocations does not match the
 * parent investment manager's (advisor) total — the core reconciliation check
 * for multi-manager portfolios.
 *
 * Two modes:
 *  - Real-time: pass { portfolio_id } to check a single portfolio (e.g. right
 *    after its allocation history is saved).
 *  - Sweep (daily workflow): pass no portfolio_id to scan all portfolios.
 *
 * For each portfolio that has sub-managers (multi-manager), computes:
 *   advisor_total     = net sum of advisor-level allocation records
 *   sub_manager_total = net sum of sub_manager-level allocation records
 * A mismatch (|advisor_total - sub_manager_total| > tolerance) raises a
 * PortfolioReconciliationAlert. When a previously-mismatched portfolio now
 * matches, its active alert is auto-resolved.
 *
 * Deduplication: at most one 'active' alert per portfolio_id at a time.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const singlePortfolioId = body?.portfolio_id || null;

    // 1. Load portfolios (tenant-scoped via RLS).
    let portfolios;
    if (singlePortfolioId) {
      try {
        const p = await base44.entities.Portfolio.get(singlePortfolioId);
        portfolios = p ? [p] : [];
      } catch {
        portfolios = [];
      }
    } else {
      portfolios = await base44.entities.Portfolio.list('-updated_date', 500);
    }

    // Only multi-manager portfolios (those with sub-managers) are relevant.
    const candidates = (portfolios || []).filter(
      (p) => !p.deleted_at && (p.sub_managers || []).length > 0
    );
    if (candidates.length === 0) {
      return Response.json({ checked: 0, raised: 0, resolved: 0, message: 'No multi-manager portfolios found.' });
    }

    // 2. Load existing active alerts so we can dedup and auto-resolve.
    const existingAlerts = await base44.entities.PortfolioReconciliationAlert.list('-created_date', 500);
    const activeByPortfolio = new Map();
    for (const a of existingAlerts || []) {
      if (a.status === 'active' && a.portfolio_id) {
        activeByPortfolio.set(a.portfolio_id, a);
      }
    }

    const tolerance = (advisorTotal) => Math.max(1, Math.abs(advisorTotal) * 0.005); // 0.5% or $1

    const calcNetTotal = (allocHistory, level) =>
      (allocHistory || [])
        .filter((e) => e.level === level)
        .reduce((sum, e) =>
          e.activity_type === 'Redemption' ? sum - (e.amount || 0) : sum + (e.amount || 0), 0);

    let checked = 0;
    let raised = 0;
    let resolved = 0;
    const raisedAlerts = [];

    for (const p of candidates) {
      checked += 1;
      const advisorTotal = calcNetTotal(p.allocation_history, 'advisor');
      const subManagerTotal = calcNetTotal(p.allocation_history, 'sub_manager');
      const variance = Math.round((advisorTotal - subManagerTotal) * 100) / 100;
      const isMismatch = Math.abs(variance) > tolerance(advisorTotal);

      const existing = activeByPortfolio.get(p.id);

      if (isMismatch) {
        if (existing) {
          // Update the existing alert with the latest totals so it reflects
          // the current state (variance may have changed without crossing back).
          await base44.entities.PortfolioReconciliationAlert.update(existing.id, {
            advisor_total: advisorTotal,
            sub_manager_total: subManagerTotal,
            variance,
            sub_manager_count: (p.sub_managers || []).length,
            advisor_firm_name: p.advisor_firm_name || existing.advisor_firm_name,
          });
        } else {
          const alert = await base44.entities.PortfolioReconciliationAlert.create({
            tenant_id: p.tenant_id || user.linked_firm_id,
            portfolio_id: p.id,
            portfolio_name: p.portfolio_name || '',
            advisor_firm_id: p.advisor_firm_id || '',
            advisor_firm_name: p.advisor_firm_name || '',
            advisor_total: advisorTotal,
            sub_manager_total: subManagerTotal,
            variance,
            sub_manager_count: (p.sub_managers || []).length,
            status: 'active',
          });
          raised += 1;
          raisedAlerts.push(alert);
          activeByPortfolio.set(p.id, alert);
        }
      } else {
        // Matching now — auto-resolve any active alert for this portfolio.
        if (existing) {
          await base44.entities.PortfolioReconciliationAlert.update(existing.id, {
            status: 'resolved',
            resolved_at: new Date().toISOString(),
          });
          resolved += 1;
          activeByPortfolio.delete(p.id);
        }
      }
    }

    return Response.json({
      checked,
      raised,
      resolved,
      raisedAlerts: raisedAlerts.map((a) => ({
        id: a.id,
        portfolio_name: a.portfolio_name,
        advisor_total: a.advisor_total,
        sub_manager_total: a.sub_manager_total,
        variance: a.variance,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}