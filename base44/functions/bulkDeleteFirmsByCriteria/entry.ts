import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Bulk cascade-deletes all firms matching the given criteria and their related
// records. Soft-deletes (trash, recoverable): Firm, Product, Contact, Portfolio.
// Hard-deletes (no trash support): FirmDocument, DueDiligence, Ownership, OrgChart.
// Uses the service role so related records owned by other users are removed too.
// Admin-only — non-admins get 403.
//
// Accepts a `criteria` array in the request body. Each criterion is an object:
//   { firm_type: "Investment Consultant" }                        — case-insensitive exact match
//   { firm_type: "Allocator", allocator_type_contains: "Family Offices" }  — firm_type match AND
//                                                                     allocator_types array contains
//                                                                     a value matching the substring
// A firm is targeted if it matches ANY criterion.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(entity: any, filter: any, sort: string, limit: number, retries = 5): Promise<any[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await entity.filter(filter, sort, limit);
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('rate') || err?.message?.includes('traffic');
      if (attempt === retries || !is429) throw err;
      const delays = [10000, 20000, 30000, 40000, 50000];
      await sleep(delays[attempt] || 50000);
    }
  }
  throw new Error('fetchWithRetry exhausted all retries');
}

function matchesCriterion(firm: any, criterion: any): boolean {
  if (!criterion.firm_type) return false;
  const target = criterion.firm_type.toLowerCase().trim();
  // Check the single-value firm_type field, AND the legacy firm_types array
  // (older records may have firm_type: null but firm_types: ["Investment Consultant"]).
  const ft = (firm.firm_type || '').toLowerCase().trim();
  const legacyTypes: string[] = Array.isArray(firm.firm_types) ? firm.firm_types : [];
  const typeMatch = ft === target || legacyTypes.some((t: string) => (t || '').toLowerCase().trim() === target);
  if (!typeMatch) return false;
  if (criterion.allocator_type_contains) {
    const needle = criterion.allocator_type_contains.toLowerCase();
    const types = Array.isArray(firm.allocator_types) ? firm.allocator_types : [];
    return types.some((t: string) => (t || '').toLowerCase().includes(needle));
  }
  return true;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const criteria: any[] = body?.criteria || [];
    if (!criteria.length) return Response.json({ error: 'criteria is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();

    // --- Step 1: Find all matching firm IDs (paginate per firm_type) ---
    const targetFirmIds: string[] = [];
    const seenIds = new Set<string>();

    for (const criterion of criteria) {
      const ftRegex = criterion.firm_type;
      // Query 1: firms with firm_type matching the regex (the normal case)
      let cursor: string | null = null;
      while (true) {
        const filter: any = {
          firm_type: { $regex: `^${ftRegex}$`, $options: 'i' },
          deleted_at: null,
        };
        if (cursor) filter.created_date = { $lt: cursor };
        const batch = await fetchWithRetry(svc.entities.Firm, filter, '-created_date', 500);
        for (const f of batch) {
          if (!matchesCriterion(f, criterion)) continue;
          if (!seenIds.has(f.id)) {
            seenIds.add(f.id);
            targetFirmIds.push(f.id);
          }
        }
        if (batch.length < 500) break;
        cursor = batch[batch.length - 1]?.created_date;
        if (!cursor) break;
        await sleep(500);
      }
      // Query 2: firms with firm_type null but legacy firm_types array containing
      // the target type (older records from the multi-select model). The DB filter
      // matches firm_type: null; matchesCriterion does the exact type check on firm_types.
      cursor = null;
      while (true) {
        const filter: any = {
          firm_type: null,
          deleted_at: null,
        };
        if (cursor) filter.created_date = { $lt: cursor };
        const batch = await fetchWithRetry(svc.entities.Firm, filter, '-created_date', 500);
        for (const f of batch) {
          if (!matchesCriterion(f, criterion)) continue;
          if (!seenIds.has(f.id)) {
            seenIds.add(f.id);
            targetFirmIds.push(f.id);
          }
        }
        if (batch.length < 500) break;
        cursor = batch[batch.length - 1]?.created_date;
        if (!cursor) break;
        await sleep(500);
      }
    }

    if (!targetFirmIds.length) {
      return Response.json({ success: true, message: 'No matching firms found', counts: { firms_to_delete: 0 } });
    }

    // --- Step 2: Cascade deletion (same logic as bulkDeleteFirmsByType) ---
    const CHUNK = 100;
    const counts: Record<string, number> = {};
    counts.firms_to_delete = targetFirmIds.length;

    // 1. Soft-delete products
    let prodCount = 0;
    for (let i = 0; i < targetFirmIds.length; i += CHUNK) {
      const chunk = targetFirmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.Product.updateMany(
          { firm_id: { $in: chunk }, deleted_at: { $exists: false } },
          { $set: { deleted_at: now } },
        );
        prodCount += r.updated || 0;
        hasMore = r.has_more;
      }
    }
    counts.products = prodCount;

    // 2. Soft-delete contacts (firm_ids array contains any target firm ID)
    let contactCount = 0;
    for (let i = 0; i < targetFirmIds.length; i += CHUNK) {
      const chunk = targetFirmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.Contact.updateMany(
          { firm_ids: { $in: chunk }, deleted_at: { $exists: false } },
          { $set: { deleted_at: now } },
        );
        contactCount += r.updated || 0;
        hasMore = r.has_more;
      }
    }
    counts.contacts = contactCount;

    // 3. Hard-delete FirmDocument
    let docCount = 0;
    for (let i = 0; i < targetFirmIds.length; i += CHUNK) {
      const chunk = targetFirmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.FirmDocument.deleteMany({ firm_id: { $in: chunk } });
        docCount += r.deleted_count || 0;
        hasMore = r.has_more;
      }
    }
    counts.firm_documents = docCount;

    // 4. Hard-delete DueDiligence
    let ddCount = 0;
    for (let i = 0; i < targetFirmIds.length; i += CHUNK) {
      const chunk = targetFirmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.DueDiligence.deleteMany({ firm_id: { $in: chunk } });
        ddCount += r.deleted_count || 0;
        hasMore = r.has_more;
      }
    }
    counts.due_diligence = ddCount;

    // 5. Hard-delete Ownership
    let ownCount = 0;
    for (let i = 0; i < targetFirmIds.length; i += CHUNK) {
      const chunk = targetFirmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.Ownership.deleteMany({ firm_id: { $in: chunk } });
        ownCount += r.deleted_count || 0;
        hasMore = r.has_more;
      }
    }
    counts.ownership = ownCount;

    // 6. Hard-delete OrgChart
    let orgCount = 0;
    for (let i = 0; i < targetFirmIds.length; i += CHUNK) {
      const chunk = targetFirmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.OrgChart.deleteMany({ firm_id: { $in: chunk } });
        orgCount += r.deleted_count || 0;
        hasMore = r.has_more;
      }
    }
    counts.org_charts = orgCount;

    // 7. Soft-delete Portfolios (firm_id OR advisor_firm_id)
    let portCount = 0;
    for (let i = 0; i < targetFirmIds.length; i += CHUNK) {
      const chunk = targetFirmIds.slice(i, i + CHUNK);
      for (const field of ['firm_id', 'advisor_firm_id']) {
        let hasMore = true;
        while (hasMore) {
          const r: any = await svc.entities.Portfolio.updateMany(
            { [field]: { $in: chunk }, deleted_at: { $exists: false } },
            { $set: { deleted_at: now } },
          );
          portCount += r.updated || 0;
          hasMore = r.has_more;
        }
      }
    }
    counts.portfolios = portCount;

    // 8. Finally, soft-delete the firms themselves.
    //    Use bulkUpdate (explicit IDs) instead of updateMany with _id filter,
    //    because the SDK's updateMany doesn't reliably filter by the built-in _id field.
    let firmCount = 0;
    for (let i = 0; i < targetFirmIds.length; i += CHUNK) {
      const chunk = targetFirmIds.slice(i, i + CHUNK);
      const updates = chunk.map((id) => ({ id, deleted_at: now }));
      const r: any = await svc.entities.Firm.bulkUpdate(updates);
      firmCount += (r.updated || r.updated_count || chunk.length);
    }
    counts.firms_deleted = firmCount;

    return Response.json({ success: true, counts });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}