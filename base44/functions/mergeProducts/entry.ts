import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { pickScalar, toArray, union, dedupeByKey, mergeAumHistory } from '../../shared/mergeUtils.ts';

// Merges two Product entities (same firm) into one, consolidating their data
// and reassigning all references from the secondary product to the primary
// product, then deletes the secondary product. Administrative operation.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const primaryId = body?.primary_id;
    const secondaryId = body?.secondary_id;
    if (!primaryId || !secondaryId || primaryId === secondaryId) {
      return Response.json({ error: 'Invalid product ids' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const primary = await svc.entities.Product.get(primaryId);
    const secondary = await svc.entities.Product.get(secondaryId);
    if (!primary || !secondary) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }

    const merged = { ...primary };
    const pick = pickScalar(primary, secondary);
    [
      'name', 'description', 'product_type', 'product_status', 'firm_id', 'firm_name',
      'asset_class', 'geography', 'market_cap', 'style', 'investment_process',
      'implementation_process', 'diversification_classification', 'aapryl_style',
      'inv_desc_edge', 'inv_desc_philosophy', 'inv_desc_universe', 'inv_desc_process',
      'inv_desc_process_buy_discipline', 'inv_desc_process_sell_discipline',
      'inv_desc_portfolio_expectations',
      'inv_desc_tracking_error_min', 'inv_desc_tracking_error_max',
      'inv_desc_excess_return_min', 'inv_desc_excess_return_max',
      'inv_desc_information_ratio_min', 'inv_desc_information_ratio_max',
      'inv_desc_holdings_min', 'inv_desc_holdings_max',
    ].forEach((k) => { merged[k] = pick(k); });

    merged.vehicle_offerings = union(primary.vehicle_offerings, secondary.vehicle_offerings);
    merged.inv_desc_market_positioning = union(primary.inv_desc_market_positioning, secondary.inv_desc_market_positioning);

    // constituent_product_ids — replace secondaryId with primaryId, dedupe
    merged.constituent_product_ids = Array.from(
      new Set(
        [...toArray(primary.constituent_product_ids), ...toArray(secondary.constituent_product_ids)]
          .map((id) => (id === secondaryId ? primaryId : id))
          .filter((id) => id !== primaryId) // avoid self-reference
      )
    );

    // investment_team — dedupe by contact_id
    merged.investment_team = dedupeByKey(
      [...(primary.investment_team || []), ...(secondary.investment_team || [])].filter((m) => m && m.contact_id),
      (m) => m.contact_id
    );

    // inv_desc_benchmarks — dedupe by id
    merged.inv_desc_benchmarks = dedupeByKey(
      [...(primary.inv_desc_benchmarks || []), ...(secondary.inv_desc_benchmarks || [])].filter((b) => b && b.id),
      (b) => b.id
    );

    // inv_desc_product_biases — merge sub-arrays
    const biases = primary.inv_desc_product_biases || {};
    const secBiases = secondary.inv_desc_product_biases || {};
    const mergedBiases = { ...biases };
    for (const key of ['regional', 'country', 'sector', 'industry']) {
      mergedBiases[key] = [...(biases[key] || []), ...(secBiases[key] || [])];
    }
    if (biases.cash_level == null && secBiases.cash_level != null) mergedBiases.cash_level = secBiases.cash_level;
    merged.inv_desc_product_biases = mergedBiases;

    // AUM history — union by month_end_date (primary wins on conflict)
    merged.aum_history = mergeAumHistory(primary.aum_history, secondary.aum_history);

    await svc.entities.Product.update(primaryId, merged);

    const primaryName = primary.name;

    // --- ReturnSeries: reassign product_id ---
    const rs = await svc.entities.ReturnSeries.filter({ product_id: secondaryId });
    for (const r of rs) {
      try { await svc.entities.ReturnSeries.update(r.id, { product_id: primaryId }); } catch {}
    }

    // --- DueDiligence: reassign product_id and product_name ---
    const dd = await svc.entities.DueDiligence.filter({ product_id: secondaryId });
    for (const d of dd) {
      try { await svc.entities.DueDiligence.update(d.id, { product_id: primaryId, product_name: primaryName }); } catch {}
    }

    // --- Portfolios: reassign sub_managers and allocation_history references ---
    const allPortfolios = await svc.entities.Portfolio.list('-created_date', 5000);
    for (const p of allPortfolios) {
      const updates = {};
      let changed = false;

      if (Array.isArray(p.sub_managers)) {
        let smChanged = false;
        const newSm = p.sub_managers.map((sm) => {
          if (sm && sm.product_id === secondaryId) {
            smChanged = true;
            return { ...sm, product_id: primaryId, product_name: sm.product_name ? primaryName : sm.product_name };
          }
          return sm;
        });
        if (smChanged) { updates.sub_managers = newSm; changed = true; }
      }

      if (Array.isArray(p.allocation_history)) {
        let ahChanged = false;
        const newAh = p.allocation_history.map((ah) => {
          if (ah && ah.level === 'sub_manager' && ah.reference_id === secondaryId) {
            ahChanged = true;
            return { ...ah, reference_id: primaryId, reference_name: ah.reference_name ? primaryName : ah.reference_name };
          }
          return ah;
        });
        if (ahChanged) { updates.allocation_history = newAh; changed = true; }
      }

      if (Array.isArray(p.historical_aum)) {
        let haChanged = false;
        const newHa = p.historical_aum.map((ha) => {
          if (ha && ha.level === 'sub_manager' && ha.reference_id === secondaryId) {
            haChanged = true;
            return { ...ha, reference_id: primaryId, reference_name: ha.reference_name ? primaryName : ha.reference_name };
          }
          return ha;
        });
        if (haChanged) { updates.historical_aum = newHa; changed = true; }
      }

      if (changed) {
        try { await svc.entities.Portfolio.update(p.id, updates); } catch {}
      }
    }

    // --- Other MoM products: replace secondaryId with primaryId in constituent_product_ids ---
    const allProducts = await svc.entities.Product.list('-created_date', 5000);
    for (const p of allProducts) {
      if (p.id === primaryId || p.id === secondaryId) continue;
      if (Array.isArray(p.constituent_product_ids) && p.constituent_product_ids.includes(secondaryId)) {
        const newIds = Array.from(
          new Set(p.constituent_product_ids.map((id) => (id === secondaryId ? primaryId : id)))
        );
        try { await svc.entities.Product.update(p.id, { constituent_product_ids: newIds }); } catch {}
      }
    }

    // --- Analysis: reassign product_configs product_id and product_name ---
    const allAnalyses = await svc.entities.Analysis.list('-created_date', 5000);
    for (const a of allAnalyses) {
      if (Array.isArray(a.product_configs)) {
        let pcChanged = false;
        const newPc = a.product_configs.map((pc) => {
          if (pc && pc.product_id === secondaryId) {
            pcChanged = true;
            return { ...pc, product_id: primaryId, product_name: pc.product_name ? primaryName : pc.product_name };
          }
          return pc;
        });
        if (pcChanged) {
          try { await svc.entities.Analysis.update(a.id, { product_configs: newPc }); } catch {}
        }
      }
    }

    // --- Delete the secondary product ---
    await svc.entities.Product.delete(secondaryId);

    return Response.json({ success: true, merged_product_id: primaryId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}