import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';
import { autoTagNewsItems } from '../../shared/newsAutoTag.ts';
import { dedupCreateNews } from '../../shared/newsDedup.ts';

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
    const startDate = body.start_date || null; // YYYY-MM-DD
    const endDate = body.end_date || null; // YYYY-MM-DD
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

      const [allContacts, allFirmsList] = await Promise.all([
        base44.asServiceRole.entities.Contact.list('-created_date', 5000).catch(() => []),
        base44.asServiceRole.entities.Firm.list('-created_date', 5000).catch(() => []),
      ]);
      const tagContext = {
        contacts: allContacts.filter(c => !c.deleted_at),
        firms: allFirmsList.filter(f => !f.deleted_at),
      };

      for (const firm of activeFirms) {
        waitUntil(scrubOneFirmHistorical(base44, firm, batchId, null, globalKeywords, startDate, endDate, tagContext));
      }

      return Response.json({
        status: 'enqueued',
        total_firms: activeFirms.length,
        batch_id: batchId,
        keywords: globalKeywords || [],
        start_date: startDate,
        end_date: endDate,
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
      waitUntil(scrubOneContactHistorical(base44, firm, contact, batchId, tenantId, keywords, startDate, endDate));

      return Response.json({ status: 'enqueued', batch_id: batchId, start_date: startDate, end_date: endDate });
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
    waitUntil(scrubOneFirmHistorical(base44, firm, batchId, tenantId, keywords, startDate, endDate));

    return Response.json({ status: 'enqueued', batch_id: batchId, start_date: startDate, end_date: endDate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ── Default time periods to search across for comprehensive historical coverage ──
const DEFAULT_TIME_PERIODS = [
  { label: 'the past year (2025-2026)', before: null, after: null },
  { label: '2022-2024', before: null, after: null },
  { label: 'the founding era through 2021 (earliest available history)', before: null, after: null },
];

// Build the list of time periods to search, honoring an optional user date range.
// If both start and end are provided, a single focused period is used.
// If only one bound is provided, an open-ended period is used.
// If neither is provided, the default multi-period history search runs.
function buildTimePeriods(startDate, endDate) {
  if (!startDate && !endDate) return DEFAULT_TIME_PERIODS;
  const fmt = (d) => {
    try {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return d; }
  };
  if (startDate && endDate) {
    return [{ label: `the period from ${fmt(startDate)} through ${fmt(endDate)}`, before: endDate, after: startDate }];
  }
  if (startDate) {
    return [{ label: `the period from ${fmt(startDate)} to the present`, before: null, after: startDate }];
  }
  return [{ label: `the period up to ${fmt(endDate)}`, before: endDate, after: null }];
}

// ── Scrub a single firm: search the web for historical news across multiple time periods ──
async function scrubOneFirmHistorical(base44, firm, batchId, tenantId = null, keywords = null, startDate = null, endDate = null, tagContext = null) {
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

    const keywordLine = keywords && keywords.length
      ? `\nPay special attention to articles matching these priority topics: ${keywords.join(', ')}. Flag any matching items with a higher alert_status.`
      : '';

    // Run a search for each time period and collect all results
    const allNewsItems = [];
    const periods = buildTimePeriods(startDate, endDate);

    for (const period of periods) {
      const prompt = `Search for historical news and public information about "${firm.name}", a ${firmTypes.join(' / ') || 'investment'} firm${foundedYear}${firm.website ? ` (website: ${firm.website})` : ''}.
Focus specifically on news from ${period.label}.
${contactNames ? `Key contacts to look for: ${contactNames}.` : ''}
${productNames ? `Products to look for: ${productNames}.` : ''}${keywordLine}

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

    const resolvedTenant = tenantId || firm.tenant_id || firm.id;
    const { created } = await dedupCreateNews(base44, allNewsItems, {
      firmId: firm.id, firmName: firm.name, tenantId: resolvedTenant, batchId,
    });
    if (created.length) await autoTagNewsItems(base44, created, tagContext?.contacts, tagContext?.firms);
    return created;
  } catch (error) {
    console.error(`scrubOneFirmHistorical error for ${firm.name}:`, error.message);
    return [];
  }
}

// ── Scrub a single contact: search the web for historical news across multiple time periods ──
async function scrubOneContactHistorical(base44, firm, contact, batchId, tenantId = null, keywords = null, startDate = null, endDate = null) {
  try {
    const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
    if (!contactName) return [];

    const firmTypes = firm.firm_types?.length ? firm.firm_types : firm.firm_type ? [firm.firm_type] : [];
    const titleLine = contact.title ? `, ${contact.title}` : '';

    const keywordLine = keywords && keywords.length
      ? `\nPay special attention to articles matching these priority topics: ${keywords.join(', ')}. Flag any matching items with a higher alert_status.`
      : '';

    const allNewsItems = [];
    const periods = buildTimePeriods(startDate, endDate);

    for (const period of periods) {
      const prompt = `Search for historical news and public information about "${contactName}"${titleLine} at "${firm.name}", a ${firmTypes.join(' / ') || 'investment'} firm.
Focus specifically on news from ${period.label}.${keywordLine}

Find up to 10 news articles, press releases, regulatory filings, interviews, conference appearances, leadership announcements, or public announcements from ${period.label} specifically about this person. For each item provide:
- date: the publication date (YYYY-MM-DD format; if only month/year is known, use the first of that month)
- headline: a concise news headline
- summary: a 1-3 sentence summary of the article
- alert_status: "High" (major impact: SEC actions, leadership departures, fraud, large AUM changes, fund closures, mergers/acquisitions), "Medium" (notable: hires, promotions, performance news, awards, conference keynotes, AUM milestones), "Low" (minor: routine mentions, general coverage)
- news_status: "Positive" (good news), "Negative" (bad news), "Neutral" (informational)
- article_url: the full URL to the article
- source_type: "contact"
- source_name: "${contactName}"

Only include real, findable articles about this specific person. Do not fabricate news. If no news is found for this period, return an empty array.`;

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
        console.error(`Historical contact scrub error for ${contactName} (${period.label}):`, err.message);
      }
    }

    if (!allNewsItems.length) return [];

    const resolvedTenant = tenantId || firm.tenant_id || firm.id;
    const { created } = await dedupCreateNews(base44, allNewsItems, {
      firmId: firm.id, firmName: firm.name, contactId: contact.id, contactName: contactName,
      tenantId: resolvedTenant, batchId,
    });
    if (created.length) await autoTagNewsItems(base44, created);
    return created;
  } catch (error) {
    console.error(`scrubOneContactHistorical error for ${contact.first_name} ${contact.last_name}:`, error.message);
    return [];
  }
}