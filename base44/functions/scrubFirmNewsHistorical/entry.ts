import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'single'; // "single" | "all" | "contact"
    const firmId = body.firm_id || null;
    const contactId = body.contact_id || null;
    const keywords = Array.isArray(body.keywords) ? body.keywords.filter(k => k && k.trim()).map(k => k.trim()) : null;
    const tenantId = user.data?.linked_firm_id || null;

    // ── "all" mode: enqueue every firm for background historical scrubbing ──
    if (mode === 'all') {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
      const allFirms = await base44.asServiceRole.entities.Firm.list('-created_date', 500);
      const activeFirms = allFirms.filter(f => !f.deleted_at);
      const batchId = `scrub_hist_${Date.now()}`;

      // Read global keyword settings (admin-managed) to focus the historical scrub
      let globalKeywords = null;
      try {
        const settings = await base44.asServiceRole.entities.NewsScrubSettings.list('-created_date', 10);
        if (settings && settings.length) {
          globalKeywords = (settings[0].keywords || []).filter(k => k && k.trim()).map(k => k.trim());
          if (!globalKeywords.length) globalKeywords = null;
        }
      } catch (e) {
        console.error('Failed to read NewsScrubSettings:', e.message);
      }

      for (const firm of activeFirms) {
        waitUntil(scrubOneFirmHistorical(base44, firm, batchId, null, globalKeywords));
      }

      return Response.json({
        status: 'enqueued',
        total_firms: activeFirms.length,
        batch_id: batchId,
        keywords: globalKeywords || [],
      });
    }

    // ── "contact" mode: scrub historical news for a specific contact ──
    if (mode === 'contact') {
      if (!contactId) {
        return Response.json({ error: 'contact_id is required for contact mode' }, { status: 400 });
      }
      const contact = await base44.entities.Contact.get(contactId);
      if (!contact || contact.deleted_at) {
        return Response.json({ error: 'Contact not found' }, { status: 404 });
      }
      const owningFirmId = contact.firm_ids?.[0] || firmId;
      if (!owningFirmId) {
        return Response.json({ error: 'Contact has no associated firm' }, { status: 400 });
      }
      const firm = await base44.entities.Firm.get(owningFirmId);
      if (!firm || firm.deleted_at) {
        return Response.json({ error: 'Firm not found' }, { status: 404 });
      }

      const batchId = `scrub_hist_${Date.now()}`;
      waitUntil(scrubOneContactHistorical(base44, firm, contact, batchId, tenantId, keywords));

      return Response.json({ status: 'enqueued', batch_id: batchId });
    }

    // ── "single" mode: scrub one firm synchronously ──
    if (!firmId) {
      return Response.json({ error: 'firm_id is required for single mode' }, { status: 400 });
    }

    const firm = await base44.entities.Firm.get(firmId);
    if (!firm || firm.deleted_at) {
      return Response.json({ error: 'Firm not found' }, { status: 404 });
    }

    const batchId = `scrub_hist_${Date.now()}`;
    // Process in the background so the function returns fast; UI polls for results
    waitUntil(scrubOneFirmHistorical(base44, firm, batchId, tenantId, keywords));

    return Response.json({ status: 'enqueued', batch_id: batchId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ── Time periods to search across for comprehensive historical coverage ──
const TIME_PERIODS = [
  { label: 'the past year (2025-2026)', before: null, after: null },
  { label: '2022-2024', before: null, after: null },
  { label: 'the founding era through 2021 (earliest available history)', before: null, after: null },
];

// ── Scrub a single firm: search the web for historical news across multiple time periods ──
async function scrubOneFirmHistorical(base44, firm, batchId, tenantId = null) {
  try {
    // Gather context: contacts and products for this firm
    const [allContacts, allProducts] = await Promise.all([
      base44.asServiceRole.entities.Contact.filter({ firm_ids: firm.id }).catch(() => []),
      base44.asServiceRole.entities.Product.filter({ firm_id: firm.id }).catch(() => []),
    ]);

    const activeContacts = allContacts.filter(c => !c.deleted_at).slice(0, 15);
    const activeProducts = allProducts.filter(p => !p.deleted_at).slice(0, 15);

    const contactNames = activeContacts
      .map(c => [c.first_name, c.last_name].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(', ');
    const productNames = activeProducts.map(p => p.name).filter(Boolean).join(', ');

    const firmTypes = firm.firm_types?.length ? firm.firm_types : firm.firm_type ? [firm.firm_type] : [];
    const foundedYear = firm.year_founded ? ` (founded ${firm.year_founded})` : '';

    // Run a search for each time period and collect all results
    const allNewsItems = [];

    for (const period of TIME_PERIODS) {
      const prompt = `Search for historical news and public information about "${firm.name}", a ${firmTypes.join(' / ') || 'investment'} firm${foundedYear}${firm.website ? ` (website: ${firm.website})` : ''}.
Focus specifically on news from ${period.label}.
${contactNames ? `Key contacts to look for: ${contactNames}.` : ''}
${productNames ? `Products to look for: ${productNames}.` : ''}

Find up to 10 news articles, press releases, regulatory filings, leadership announcements, fund launches/closures, performance news, awards, or public announcements from ${period.label} about this firm, its contacts, or its products. For each item provide:
- date: the publication date (YYYY-MM-DD format; if only month/year is known, use the first of that month)
- headline: a concise news headline
- summary: a 1-3 sentence summary of the article
- alert_status: "High" (major impact: SEC actions, leadership departures, fraud, large AUM changes, fund closures, mergers/acquisitions), "Medium" (notable: product launches, hires, performance news, awards, AUM milestones), "Low" (minor: routine mentions, general coverage)
- news_status: "Positive" (good news), "Negative" (bad news), "Neutral" (informational)
- article_url: the full URL to the article
- source_type: "firm", "contact", or "product" depending on what the news is primarily about
- source_name: the name of the specific contact or product if applicable, otherwise the firm name

Only include real, findable articles. Do not fabricate news. If no news is found for this period, return an empty array.`;

      try {
        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              news_items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    headline: { type: 'string' },
                    summary: { type: 'string' },
                    alert_status: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                    news_status: { type: 'string', enum: ['Positive', 'Negative', 'Neutral'] },
                    article_url: { type: 'string' },
                    source_type: { type: 'string', enum: ['firm', 'contact', 'product'] },
                    source_name: { type: 'string' },
                  },
                },
              },
            },
          },
        });

        const items = llmResponse?.news_items || [];
        if (items.length) allNewsItems.push(...items);
      } catch (err) {
        console.error(`Historical scrub error for ${firm.name} (${period.label}):`, err.message);
      }
    }

    if (!allNewsItems.length) return [];

    // Deduplicate against existing news for this firm (same headline + URL)
    const existing = await base44.asServiceRole.entities.FirmNews.filter({ firm_id: firm.id }).catch(() => []);
    const existingKeys = new Set(existing.map(n => `${(n.headline || '').toLowerCase().trim()}||${(n.article_url || '').toLowerCase().trim()}`));

    // Also deduplicate within this batch (same item might appear across periods)
    const seenInBatch = new Set();

    const resolvedTenant = tenantId || firm.tenant_id || firm.id;

    const toCreate = allNewsItems
      .filter(item => {
        const key = `${(item.headline || '').toLowerCase().trim()}||${(item.article_url || '').toLowerCase().trim()}`;
        if (existingKeys.has(key) || seenInBatch.has(key)) return false;
        seenInBatch.add(key);
        return true;
      })
      .map(item => ({
        tenant_id: resolvedTenant,
        firm_id: firm.id,
        firm_name: firm.name,
        news_date: item.date || new Date().toISOString().split('T')[0],
        headline: item.headline || 'Untitled',
        summary: item.summary || '',
        alert_status: item.alert_status || 'Low',
        news_status: item.news_status || 'Neutral',
        article_url: item.article_url || '',
        source_type: item.source_type || 'firm',
        source_name: item.source_name || firm.name,
        scrub_batch_id: batchId,
        is_pinned: false,
      }));

    if (!toCreate.length) return [];

    const created = await base44.asServiceRole.entities.FirmNews.bulkCreate(toCreate);
    return created;
  } catch (error) {
    console.error(`scrubOneFirmHistorical error for ${firm.name}:`, error.message);
    return [];
  }
}