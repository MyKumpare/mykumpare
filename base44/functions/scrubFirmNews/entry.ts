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
    const startDate = body.start_date || null;
    const endDate = body.end_date || null;
    const tenantId = user.data?.linked_firm_id || null;

    // ── "all" mode: enqueue every firm for background scrubbing ──
    if (mode === 'all') {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
      const allFirms = await base44.asServiceRole.entities.Firm.list('-created_date', 500);
      const activeFirms = allFirms.filter(f => !f.deleted_at);
      const batchId = `scrub_${Date.now()}`;

      // Read global keyword settings (admin-managed) to focus the nightly scrub
      let globalKeywords = null;
      let globalStartDate = null;
      let globalEndDate = null;
      try {
        const settings = await base44.asServiceRole.entities.NewsScrubSettings.list('-created_date', 10);
        if (settings && settings.length) {
          globalKeywords = (settings[0].keywords || []).filter(k => k && k.trim()).map(k => k.trim());
          if (!globalKeywords.length) globalKeywords = null;
          globalStartDate = settings[0].start_date || null;
          globalEndDate = settings[0].end_date || null;
        }
      } catch (e) {
        console.error('Failed to read NewsScrubSettings:', e.message);
      }

      // Process each firm as a background task so the function returns fast
      for (const firm of activeFirms) {
        waitUntil(scrubOneFirm(base44, firm, batchId, null, globalKeywords, globalStartDate, globalEndDate));
      }

      return Response.json({
        status: 'enqueued',
        total_firms: activeFirms.length,
        batch_id: batchId,
        keywords: globalKeywords || [],
        start_date: globalStartDate,
        end_date: globalEndDate,
      });
    }

    // ── "contact" mode: scrub news for a specific contact ──
    if (mode === 'contact') {
      if (!contactId) {
        return Response.json({ error: 'contact_id is required for contact mode' }, { status: 400 });
      }
      const contact = await base44.entities.Contact.get(contactId);
      if (!contact || contact.deleted_at) {
        return Response.json({ error: 'Contact not found' }, { status: 404 });
      }
      // Use the contact's first associated firm as the owning firm for the news record
      const owningFirmId = contact.firm_ids?.[0] || firmId;
      if (!owningFirmId) {
        return Response.json({ error: 'Contact has no associated firm' }, { status: 400 });
      }
      const firm = await base44.entities.Firm.get(owningFirmId);
      if (!firm || firm.deleted_at) {
        return Response.json({ error: 'Firm not found' }, { status: 404 });
      }

      const batchId = `scrub_${Date.now()}`;
      const created = await scrubOneContact(base44, firm, contact, batchId, tenantId, keywords, startDate, endDate);

      return Response.json({ status: 'success', created: created.length, items: created });
    }

    // ── "single" mode: scrub one firm synchronously ──
    if (!firmId) {
      return Response.json({ error: 'firm_id is required for single mode' }, { status: 400 });
    }

    const firm = await base44.entities.Firm.get(firmId);
    if (!firm || firm.deleted_at) {
      return Response.json({ error: 'Firm not found' }, { status: 404 });
    }

    const batchId = `scrub_${Date.now()}`;
    const created = await scrubOneFirm(base44, firm, batchId, tenantId, keywords, startDate, endDate);

    return Response.json({ status: 'success', created: created.length, items: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ── Scrub a single firm: search the web for news, create FirmNews records ──
async function scrubOneFirm(base44, firm, batchId, tenantId = null, keywords = null, startDate = null, endDate = null) {
  try {
    // Gather context: contacts and products for this firm
    const [contacts, products] = await Promise.all([
      base44.asServiceRole.entities.Contact.filter({ firm_ids: firm.id }).catch(() => []),
      base44.asServiceRole.entities.Product.filter({ firm_id: firm.id }).catch(() => []),
    ]);

    const activeContacts = contacts.filter(c => !c.deleted_at).slice(0, 10);
    const activeProducts = products.filter(p => !p.deleted_at).slice(0, 10);

    const contactNames = activeContacts
      .map(c => [c.first_name, c.last_name].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(', ');
    const productNames = activeProducts.map(p => p.name).filter(Boolean).join(', ');

    const firmTypes = firm.firm_types?.length ? firm.firm_types : firm.firm_type ? [firm.firm_type] : [];

    const keywordLine = keywords && keywords.length
      ? `\nPay special attention to articles matching these priority topics: ${keywords.join(', ')}. Flag any matching items with a higher alert_status.`
      : '';

    const dateLine = (startDate || endDate)
      ? `\nFocus the search on articles published within the period${startDate ? ` from ${startDate}` : ''}${endDate ? ` through ${endDate}` : ''}. Prefer items that fall within this date range; only include out-of-range items if they are highly relevant.`
      : '';

    const prompt = `Search for recent news and public information about "${firm.name}", a ${firmTypes.join(' / ') || 'investment'} firm${firm.website ? ` (website: ${firm.website})` : ''}.
${contactNames ? `Key contacts to look for: ${contactNames}.` : ''}
${productNames ? `Products to look for: ${productNames}.` : ''}${keywordLine}${dateLine}

Find up to 10 recent, relevant news articles, press releases, regulatory filings, or public announcements about this firm, its contacts, or its products. For each item provide:
- date: the publication date (YYYY-MM-DD format, use the current date ${new Date().toISOString().split('T')[0]} if unknown)
- headline: a concise news headline
- summary: a 1-3 sentence summary of the article
- alert_status: "High" (major impact: SEC actions, leadership departures, fraud, large AUM changes, fund closures), "Medium" (notable: product launches, hires, performance news, awards), "Low" (minor: routine mentions, general coverage)
- news_status: "Positive" (good news), "Negative" (bad news), "Neutral" (informational)
- article_url: the full URL to the article
- source_type: "firm", "contact", or "product" depending on what the news is primarily about
- source_name: the name of the specific contact or product if applicable, otherwise the firm name

Only include real, findable articles. Do not fabricate news. If no news is found, return an empty array.`;

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

    const newsItems = llmResponse?.news_items || [];
    if (!newsItems.length) return [];

    // Deduplicate against existing news for this firm (same headline + URL)
    const existing = await base44.asServiceRole.entities.FirmNews.filter({ firm_id: firm.id }).catch(() => []);
    const existingKeys = new Set(existing.map(n => `${(n.headline || '').toLowerCase().trim()}||${(n.article_url || '').toLowerCase().trim()}`));

    const resolvedTenant = tenantId || firm.tenant_id || firm.id;

    const toCreate = newsItems
      .filter(item => {
        const key = `${(item.headline || '').toLowerCase().trim()}||${(item.article_url || '').toLowerCase().trim()}`;
        return !existingKeys.has(key);
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
    console.error(`scrubOneFirm error for ${firm.name}:`, error.message);
    return [];
  }
}

// ── Scrub a single contact: search the web for news about this person ──
async function scrubOneContact(base44, firm, contact, batchId, tenantId = null, keywords = null, startDate = null, endDate = null) {
  try {
    const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
    if (!contactName) return [];

    const firmTypes = firm.firm_types?.length ? firm.firm_types : firm.firm_type ? [firm.firm_type] : [];
    const titleLine = contact.title ? `, ${contact.title}` : '';

    const keywordLine = keywords && keywords.length
      ? `\nPay special attention to articles matching these priority topics: ${keywords.join(', ')}. Flag any matching items with a higher alert_status.`
      : '';

    const dateLine = (startDate || endDate)
      ? `\nFocus the search on articles published within the period${startDate ? ` from ${startDate}` : ''}${endDate ? ` through ${endDate}` : ''}. Prefer items that fall within this date range; only include out-of-range items if they are highly relevant.`
      : '';

    const prompt = `Search for recent news and public information about "${contactName}"${titleLine} at "${firm.name}", a ${firmTypes.join(' / ') || 'investment'} firm${firm.linkedin_url ? ` (LinkedIn: ${firm.linkedin_url})` : ''}.${keywordLine}${dateLine}

Find up to 10 recent, relevant news articles, press releases, regulatory filings, interviews, conference appearances, or public announcements specifically about this person. For each item provide:
- date: the publication date (YYYY-MM-DD format, use the current date ${new Date().toISOString().split('T')[0]} if unknown)
- headline: a concise news headline
- summary: a 1-3 sentence summary of the article
- alert_status: "High" (major impact: SEC actions, leadership departures, fraud, large AUM changes, fund closures), "Medium" (notable: hires, promotions, performance news, awards, conference keynotes), "Low" (minor: routine mentions, general coverage)
- news_status: "Positive" (good news), "Negative" (bad news), "Neutral" (informational)
- article_url: the full URL to the article
- source_type: "contact"
- source_name: "${contactName}"

Only include real, findable articles about this specific person. Do not fabricate news. If no news is found, return an empty array.`;

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

    const newsItems = llmResponse?.news_items || [];
    if (!newsItems.length) return [];

    // Deduplicate against existing news for this firm + contact (same headline + URL)
    const existing = await base44.asServiceRole.entities.FirmNews.filter({ firm_id: firm.id }).catch(() => []);
    const existingKeys = new Set(existing.map(n => `${(n.headline || '').toLowerCase().trim()}||${(n.article_url || '').toLowerCase().trim()}`));

    const resolvedTenant = tenantId || firm.tenant_id || firm.id;

    const toCreate = newsItems
      .filter(item => {
        const key = `${(item.headline || '').toLowerCase().trim()}||${(item.article_url || '').toLowerCase().trim()}`;
        return !existingKeys.has(key);
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
        source_type: 'contact',
        source_id: contact.id,
        source_name: contactName,
        scrub_batch_id: batchId,
        is_pinned: false,
      }));

    if (!toCreate.length) return [];

    const created = await base44.asServiceRole.entities.FirmNews.bulkCreate(toCreate);
    return created;
  } catch (error) {
    console.error(`scrubOneContact error for ${contact.first_name} ${contact.last_name}:`, error.message);
    return [];
  }
}