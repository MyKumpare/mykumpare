import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Matches a single RFP/RFI record against the products offered by the user's
// own firm (Xponance). Uses an LLM to determine whether any offered product
// fits the opportunity, returning a match status (Match / Near Match / No
// Match), the matched product ids + names, and a short explanation. Persists
// the result onto the FirmRfpRfi record so the team can see at a glance which
// product to potentially propose.
//
// Payload: { record_id: string, firm_id?: string }
//   - record_id: the FirmRfpRfi record to check.
//   - firm_id:   optional — the user's own firm whose products to match against.
//                Defaults to the calling user's linked_firm_id.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const recordId = body.record_id;
    if (!recordId) return Response.json({ error: 'record_id is required' }, { status: 400 });

    // Load the RFP/RFI record (service role so any tenant user can check their own records).
    const record = await base44.asServiceRole.entities.FirmRfpRfi.get(recordId).catch(() => null);
    if (!record) return Response.json({ error: 'RFP/RFI record not found' }, { status: 404 });

    // Determine the firm whose products to match against (the user's own firm).
    const targetFirmId = body.firm_id || (user as any).data?.linked_firm_id || (user as any).linked_firm_id || '';
    if (!targetFirmId) {
      return Response.json({ error: 'No firm linked to your account — cannot determine which products to match against.' }, { status: 400 });
    }

    // Load that firm's products (service role to bypass RLS; these are the user's own products).
    const products = await base44.asServiceRole.entities.Product.filter({ firm_id: targetFirmId }).catch(() => []);
    const activeProducts = (products || []).filter((p: any) => p && !p.deleted_at);

    if (!activeProducts.length) {
      // No products to match against — record a No Match with an explanation.
      const updatePayload = {
        product_match_status: 'No Match',
        matched_product_ids: [],
        matched_product_names: [],
        product_match_summary: 'No products are offered by your firm, so none could be matched to this opportunity.',
        product_match_checked_at: new Date().toISOString(),
      };
      await base44.asServiceRole.entities.FirmRfpRfi.update(recordId, updatePayload);
      return Response.json({ ...updatePayload, record_id: recordId });
    }

    // Build a compact product catalog for the LLM.
    const catalog = activeProducts.map((p: any) => ({
      id: p.id,
      name: p.name || '',
      product_type: p.product_type || '',
      asset_class: p.asset_class || '',
      geography: p.geography || '',
      style: p.style || '',
      description: (p.description || '').slice(0, 400),
    }));

    const opportunityText = [
      `Title: ${record.title || ''}`,
      record.summary ? `Summary: ${record.summary}` : '',
      record.rfp_type ? `Type: ${record.rfp_type}` : '',
    ].filter(Boolean).join('\n');

    const prompt =
      `You are an investment-product matching assistant. An investment manager (Xponance) has received an RFP/RFI opportunity and wants to know which of its own products could be proposed in response.\n\n` +
      `OPPORTUNITY:\n${opportunityText}\n\n` +
      `Xponance's offered products (catalog):\n${JSON.stringify(catalog)}\n\n` +
      `Determine whether any of Xponance's products fit this opportunity.\n` +
      `- "Match" = at least one product clearly fits the opportunity's asset class, geography, style, and mandate.\n` +
      `- "Near Match" = at least one product is a close but imperfect fit (e.g. right asset class but wrong geography/style, or adjacent strategy).\n` +
      `- "No Match" = no offered product fits the opportunity at all.\n\n` +
      `Return the match_status, the matched_product_ids (only ids from the catalog above), matched_product_names (the names of those products), and a concise summary explaining which products fit and why (or why none fit). If multiple products fit, list all of them.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          match_status: { type: 'string', enum: ['Match', 'Near Match', 'No Match'] },
          matched_product_ids: { type: 'array', items: { type: 'string' } },
          matched_product_names: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
      },
    });

    const result: any = res || {};
    const matchStatus = ['Match', 'Near Match', 'No Match'].includes(result.match_status) ? result.match_status : 'No Match';

    // Only keep ids that actually exist in the catalog (LLMs sometimes hallucinate ids).
    const validIds = new Set(activeProducts.map((p: any) => p.id));
    const matchedIds = (result.matched_product_ids || []).filter((id: any) => validIds.has(id));
    const matchedNames = (result.matched_product_names || []).filter((n: any) => typeof n === 'string' && n);

    const updatePayload = {
      product_match_status: matchStatus,
      matched_product_ids: matchedIds,
      matched_product_names: matchedNames,
      product_match_summary: result.summary || '',
      product_match_checked_at: new Date().toISOString(),
    };

    await base44.asServiceRole.entities.FirmRfpRfi.update(recordId, updatePayload);
    return Response.json({ ...updatePayload, record_id: recordId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}