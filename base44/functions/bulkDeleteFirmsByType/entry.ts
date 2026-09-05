import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Bulk cascade-deletes all firms in the given firm_ids list and their related records.
// Soft-deletes (trash, recoverable): Firm, Product, Contact, Portfolio.
// Hard-deletes (no trash support): FirmDocument, DueDiligence, Ownership, OrgChart.
// Uses the service role so related records owned by other users are removed too.
// Admin-only — non-admins get 403.
// Accepts firm_ids directly (from client-side searchAppData) to avoid read rate limits.
export default async function(req: Request): Promise<Response> {
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
    const now = new Date().toISOString();
    const counts: Record<string, number> = {};
    counts.firms_to_delete = firmIds.length;

    // Process in chunks of 100 IDs to avoid large $in arrays
    const CHUNK = 100;

    // --- 1. Soft-delete products ---
    let prodCount = 0;
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
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

    // --- 2. Soft-delete contacts (firm_ids array contains any firm ID) ---
    let contactCount = 0;
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
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

    // --- 3. Hard-delete FirmDocument ---
    let docCount = 0;
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.FirmDocument.deleteMany({ firm_id: { $in: chunk } });
        docCount += r.deleted_count || 0;
        hasMore = r.has_more;
      }
    }
    counts.firm_documents = docCount;

    // --- 4. Hard-delete DueDiligence ---
    let ddCount = 0;
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.DueDiligence.deleteMany({ firm_id: { $in: chunk } });
        ddCount += r.deleted_count || 0;
        hasMore = r.has_more;
      }
    }
    counts.due_diligence = ddCount;

    // --- 5. Hard-delete Ownership ---
    let ownCount = 0;
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.Ownership.deleteMany({ firm_id: { $in: chunk } });
        ownCount += r.deleted_count || 0;
        hasMore = r.has_more;
      }
    }
    counts.ownership = ownCount;

    // --- 6. Hard-delete OrgChart ---
    let orgCount = 0;
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.OrgChart.deleteMany({ firm_id: { $in: chunk } });
        orgCount += r.deleted_count || 0;
        hasMore = r.has_more;
      }
    }
    counts.org_charts = orgCount;

    // --- 7. Soft-delete Portfolios (firm_id OR advisor_firm_id) ---
    let portCount = 0;
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
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

    // --- 8. Finally, soft-delete the firms themselves ---
    let firmCount = 0;
    for (let i = 0; i < firmIds.length; i += CHUNK) {
      const chunk = firmIds.slice(i, i + CHUNK);
      let hasMore = true;
      while (hasMore) {
        const r: any = await svc.entities.Firm.updateMany(
          { _id: { $in: chunk }, deleted_at: { $exists: false } },
          { $set: { deleted_at: now } },
        );
        firmCount += r.updated || 0;
        hasMore = r.has_more;
      }
    }
    counts.firms_deleted = firmCount;

    return Response.json({ success: true, counts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}