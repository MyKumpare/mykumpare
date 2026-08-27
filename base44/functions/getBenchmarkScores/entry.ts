import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Computes benchmark (average historic final scores) for a scoring matrix by
 * aggregating finalized ScoringMatrixScore records from similar investment
 * managers (same asset class, optionally refined by geography).
 *
 * Input:  { product_id, template_id, firm_id }
 * Output: { criteria: { [criterionId]: { avg_score, sample_size } },
 *           total_sample_size, similarity_basis, similar_product_count, similar_firm_count }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { product_id, template_id, firm_id } = body;

    if (!product_id || !template_id) {
      return Response.json({ error: 'product_id and template_id are required' }, { status: 400 });
    }

    // 1. Fetch the current product to determine similarity attributes
    const product = await base44.entities.Product.get(product_id);
    if (!product) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }

    const assetClass = product.asset_class;
    if (!assetClass) {
      return Response.json({
        criteria: {},
        total_sample_size: 0,
        similarity_basis: '',
        similar_product_count: 0,
        similar_firm_count: 0,
        message: 'This product has no asset class set, so similar managers cannot be identified.'
      });
    }

    // 2. Fetch all finalized scores for this template (excluding the current firm)
    const allScores = await base44.entities.ScoringMatrixScore.filter(
      { template_id, status: 'finalized' },
      '-created_date',
      500
    );
    const candidateScores = (allScores || []).filter((s: any) => s.firm_id !== firm_id);

    if (candidateScores.length === 0) {
      return Response.json({
        criteria: {},
        total_sample_size: 0,
        similarity_basis: `Asset Class: ${assetClass}`,
        similar_product_count: 0,
        similar_firm_count: 0,
        message: 'No finalized scores from other firms found for this scoring template yet.'
      });
    }

    // 3. Fetch all products with the same asset class
    const similarProductsRaw = await base44.entities.Product.filter(
      { asset_class: assetClass },
      '-created_date',
      500
    );
    const similarProducts = (similarProductsRaw || []).filter((p: any) => p.id !== product_id);
    const similarProductIds = new Set(similarProducts.map((p: any) => p.id));

    // 4. Filter candidate scores to those whose product is in the similar set
    let benchmarkScores = candidateScores.filter((s: any) => similarProductIds.has(s.product_id));

    let similarityBasis = `Asset Class: ${assetClass}`;

    // 5. Optionally refine by geography if we still have enough samples
    if (product.geography) {
      const geoProductIds = new Set(
        similarProducts.filter((p: any) => p.geography === product.geography).map((p: any) => p.id)
      );
      const geoRefined = benchmarkScores.filter((s: any) => geoProductIds.has(s.product_id));
      if (geoRefined.length >= 3) {
        benchmarkScores = geoRefined;
        similarityBasis += `, Geography: ${product.geography}`;
      }
    }

    if (benchmarkScores.length === 0) {
      return Response.json({
        criteria: {},
        total_sample_size: 0,
        similarity_basis: similarityBasis,
        similar_product_count: similarProducts.length,
        similar_firm_count: 0,
        message: 'No finalized scores from similar investment managers found for this template yet.'
      });
    }

    // 6. Aggregate final_score per criterion across all benchmark scores
    const criterionStats: Record<string, { sum: number; count: number; name: string }> = {};

    benchmarkScores.forEach((score: any) => {
      (score.scoring_blocks || []).forEach((block: any) => {
        (block.criteria || []).forEach((crit: any) => {
          if (crit.final_score != null) {
            const key = crit.id || crit.name;
            if (!criterionStats[key]) {
              criterionStats[key] = { sum: 0, count: 0, name: crit.name || key };
            }
            criterionStats[key].sum += crit.final_score;
            criterionStats[key].count += 1;
          }
        });
      });
    });

    // 7. Compute averages
    const criteria: Record<string, { avg_score: number; sample_size: number }> = {};
    Object.entries(criterionStats).forEach(([id, stats]) => {
      criteria[id] = {
        avg_score: Math.round((stats.sum / stats.count) * 100) / 100,
        sample_size: stats.count
      };
    });

    const similarFirmIds = new Set(
      benchmarkScores.map((s: any) => s.firm_id).filter(Boolean)
    );

    return Response.json({
      criteria,
      total_sample_size: benchmarkScores.length,
      similarity_basis: similarityBasis,
      similar_product_count: similarProducts.length,
      similar_firm_count: similarFirmIds.size
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}