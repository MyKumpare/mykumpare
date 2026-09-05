import { createClientFromRequest } from 'npm:@base44/sdk@0.8.46';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt < maxRetries - 1 && (err?.status === 429 || err?.message?.includes('429'))) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error('max retries exceeded');
}

async function deleteAll(svc: any, entity: string, filter: any): Promise<number> {
  let count = 0;
  let more = true;
  while (more) {
    const r: any = await withRetry(() => svc.entities[entity].deleteMany(filter));
    count += r.deleted_count || 0;
    more = r.has_more;
  }
  return count;
}

// Permanently (hard) deletes soft-deleted firms and their related records.
// Accepts firm_ids directly (from read_entities) to avoid entity read rate limits.
// Admin-only.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const firmIds: string[] = body?.firm_ids || [];
    if (!firmIds.length) return Response.json({ error: 'firm_ids is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const counts: Record<string, number> = {};
    const CHUNK = 100;
    counts.firms_to_purge = firmIds.length;

    // --- 1. Collect product IDs (for return series) ---
    const productIds: string[] = [];
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
      const products = await withRetry(() => svc.entities.Product.filter({ firm_id: { $in: chunk } }));
      for (const p of products) productIds.push(p.id);
    }

    // --- 2. Hard-delete ReturnSeries ---
    if (productIds.length) {
      let rsCount = 0;
      for (let i = 0; i < productIds.length; i += CHUNK) {
        const chunk = productIds.slice(i, i + CHUNK);
        rsCount += await deleteAll(svc, 'ReturnSeries', { product_id: { $in: chunk } });
      }
      if (rsCount > 0) counts.return_series = rsCount;
    }

    // --- 3. Hard-delete related entities with direct firm_id ---
    const relatedEntities: [string, string][] = [
      ['Product', 'firm_id'],
      ['FirmDocument', 'firm_id'],
      ['DueDiligence', 'firm_id'],
      ['Ownership', 'firm_id'],
      ['OrgChart', 'firm_id'],
      ['FirmConsultant', 'firm_id'],
      ['FirmNews', 'firm_id'],
      ['BoardMeeting', 'firm_id'],
      ['OnsiteVisit', 'firm_id'],
      ['OnsiteVisitRule', 'firm_id'],
      ['FirmAumThreshold', 'firm_id'],
      ['FirmAumAlert', 'firm_id'],
      ['StalledDdAlert', 'firm_id'],
      ['FirmRfpRfi', 'firm_id'],
      ['FirmConference', 'firm_id'],
      ['FirmOwner', 'firm_id'],
    ];

    for (const [entity, field] of relatedEntities) {
      let count = 0;
      for (let i = 0; i < firmIds.length; i += CHUNK) {
        const chunk = firmIds.slice(i, i + CHUNK);
        count += await deleteAll(svc, entity, { [field]: { $in: chunk } });
      }
      if (count > 0) counts[entity] = count;
    }

    // --- 4. Hard-delete Contacts (already soft-deleted) ---
    let contactCount = 0;
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
      contactCount += await deleteAll(svc, 'Contact', {
        firm_ids: { $in: chunk },
        deleted_at: { $exists: true },
      });
    }
    if (contactCount > 0) counts.contacts = contactCount;

    // --- 5. Hard-delete Portfolios (firm_id OR advisor_firm_id) ---
    let portCount = 0;
    for (const field of ['firm_id', 'advisor_firm_id']) {
      for (let i = 0; i < firmIds.length; i += CHUNK) {
        const chunk = firmIds.slice(i, i + CHUNK);
        portCount += await deleteAll(svc, 'Portfolio', { [field]: { $in: chunk } });
      }
    }
    if (portCount > 0) counts.portfolios = portCount;

    // --- 6. Hard-delete the firms themselves ---
    let firmCount = 0;
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
      firmCount += await deleteAll(svc, 'Firm', { id: { $in: chunk } });
    }
    counts.firms_deleted = firmCount;

    return Response.json({ success: true, counts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}