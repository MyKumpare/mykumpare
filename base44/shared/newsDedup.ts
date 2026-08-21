// Global deduplication for FirmNews: an article with 100% identical content
// (headline + summary + date) is saved only once. When a duplicate is found,
// the current firm/contact is merged onto the existing record's tags instead
// of creating a second copy — so one article can be tagged across many
// firms/contacts without duplication.
//
// Shared by the news scrub functions (scrubFirmNews, scrubFirmNewsHistorical)
// and the manual-entry saveFirmNewsItem endpoint.

function norm(s: any): string {
  return (s == null ? '' : String(s)).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Content signature: headline + summary + date, normalized. Two articles with
// the same signature are considered the same article (regardless of owner firm).
export function newsSignature(item: any): string {
  const date = item.news_date || item.date || '';
  return `${norm(item.headline)}||${norm(item.summary)}||${norm(date)}`;
}

type DedupOpts = {
  firmId: string | null;
  firmName?: string;
  contactId?: string | null;
  contactName?: string;
  tenantId?: string | null;
  batchId?: string;
};

// Given candidate articles (from an AI scrub) for a single firm/contact,
// deduplicate them GLOBALLY against all existing FirmNews. Exact content
// matches are merged onto the existing record (firm added to tagged_firm_ids,
// contact added to tagged_contact_ids) instead of being re-created.
// Returns { created, merged } where `created` are the newly inserted records
// (callers auto-tag these) and `merged` are the tag-merge updates applied.
export async function dedupCreateNews(base44: any, candidates: any[], opts: DedupOpts) {
  const { firmId, firmName, contactId, contactName, tenantId, batchId } = opts;
  if (!candidates || !candidates.length) return { created: [], merged: [] };

  // Load all existing news once for global matching.
  const existing = await base44.asServiceRole.entities.FirmNews.list('-created_date', 5000).catch(() => []);
  const existingBySig = new Map<string, any>();
  for (const n of existing) {
    if (n.deleted_at) continue;
    existingBySig.set(newsSignature(n), n);
  }

  const resolvedTenant = tenantId || firmId;
  const toCreate: any[] = [];
  const mergeUpdates: any[] = [];
  const createdSigs = new Set<string>();

  for (const item of candidates) {
    const sig = newsSignature(item);
    const dup = existingBySig.get(sig);
    if (dup) {
      // Merge the current firm/contact onto the existing record's tags.
      const taggedFirmIds = Array.from(new Set([...(dup.tagged_firm_ids || []), ...(firmId ? [firmId] : [])]));
      const taggedContactIds = Array.from(new Set([...(dup.tagged_contact_ids || []), ...(contactId ? [contactId] : [])]));
      mergeUpdates.push({ id: dup.id, tagged_firm_ids: taggedFirmIds, tagged_contact_ids: taggedContactIds });
      // Keep the in-memory copy current so later batch duplicates merge onto
      // the same tag set rather than re-reading stale tags.
      existingBySig.set(sig, { ...dup, tagged_firm_ids: taggedFirmIds, tagged_contact_ids: taggedContactIds });
      continue;
    }
    if (createdSigs.has(sig)) continue; // within-batch duplicate — already creating one
    createdSigs.add(sig);

    const sourceType = item.source_type || (contactId ? 'contact' : 'firm');
    toCreate.push({
      tenant_id: resolvedTenant,
      firm_id: firmId,
      firm_name: firmName,
      news_date: item.news_date || item.date || new Date().toISOString().split('T')[0],
      headline: item.headline || 'Untitled',
      summary: item.summary || '',
      alert_status: item.alert_status || 'Low',
      news_status: item.news_status || 'Neutral',
      article_url: item.article_url || '',
      source_type: sourceType,
      source_id: item.source_id || (contactId ? contactId : undefined),
      source_name: item.source_name || (contactId ? contactName : firmName),
      scrub_batch_id: batchId,
      is_pinned: false,
    });
  }

  let created: any[] = [];
  if (toCreate.length) {
    created = await base44.asServiceRole.entities.FirmNews.bulkCreate(toCreate);
  }
  if (mergeUpdates.length) {
    try {
      await base44.asServiceRole.entities.FirmNews.bulkUpdate(mergeUpdates);
    } catch (e) {
      console.error('dedupCreateNews merge updates failed:', e.message);
    }
  }
  return { created, merged: mergeUpdates };
}