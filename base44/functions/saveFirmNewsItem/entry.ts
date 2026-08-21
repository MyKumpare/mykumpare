import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { newsSignature } from '../../shared/newsDedup.ts';
import { autoTagNewsItemById } from '../../shared/newsAutoTag.ts';

// Manual news entry with global deduplication: if an article with 100%
// identical content (headline + summary + date) already exists anywhere in
// the system, the firm/contact is merged onto that existing record's tags
// instead of creating a duplicate. Returns { merged: true, news } when linked
// to an existing article, or { merged: false, news } when newly created.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const data = body.data || {};
    const firmId = body.firm_id || null;
    const firmName = body.firm_name || '';
    const contactId = body.contact_id || null;
    const contactName = body.contact_name || '';

    if (!data.headline || !String(data.headline).trim()) {
      return Response.json({ error: 'headline is required' }, { status: 400 });
    }

    const tenantId = user.data?.linked_firm_id || firmId;
    const sig = newsSignature(data);

    // Global duplicate check across all existing news.
    const existing = await base44.asServiceRole.entities.FirmNews.list('-created_date', 5000).catch(() => []);
    const dup = existing.find((n: any) => !n.deleted_at && newsSignature(n) === sig);

    if (dup) {
      // Merge the firm/contact onto the existing record instead of duplicating.
      const taggedFirmIds = Array.from(new Set([...(dup.tagged_firm_ids || []), ...(firmId ? [firmId] : [])]));
      const taggedContactIds = Array.from(new Set([...(dup.tagged_contact_ids || []), ...(contactId ? [contactId] : [])]));
      await base44.asServiceRole.entities.FirmNews.update(dup.id, {
        tagged_firm_ids: taggedFirmIds,
        tagged_contact_ids: taggedContactIds,
      });
      return Response.json({ status: 'merged', merged: true, news: { ...dup, tagged_firm_ids: taggedFirmIds, tagged_contact_ids: taggedContactIds } });
    }

    const record = {
      ...data,
      tenant_id: tenantId,
      firm_id: firmId,
      firm_name: firmName,
      source_type: data.source_type || (contactId ? 'contact' : 'firm'),
      source_id: data.source_id || (contactId ? contactId : undefined),
      source_name: data.source_name || (contactId ? contactName : firmName),
      is_pinned: false,
    };
    const created = await base44.asServiceRole.entities.FirmNews.create(record);
    try { await autoTagNewsItemById(base44, created.id); } catch (e) { /* tagging is best-effort */ }
    return Response.json({ status: 'created', merged: false, news: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}