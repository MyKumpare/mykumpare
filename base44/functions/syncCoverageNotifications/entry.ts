import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Creates "coverage_assignment" DdNotification records for analysts who are
 * newly assigned (as primary or secondary) on a DueDiligence record. Invoked
 * by the "Coverage Assignment Notifier" workflow (entity trigger on
 * DueDiligence create/update), so there is no end-user auth — data access
 * uses the service role.
 *
 * Deduplication: before creating, we check whether a coverage_assignment
 * notification already exists for the same (due_diligence_id, contact_id)
 * pair, so re-saving a record never produces duplicate alerts.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const ddId = body.due_diligence_id;
    if (!ddId) return Response.json({ error: 'due_diligence_id required' }, { status: 400 });

    const eventType = body.event_type || 'update';
    const primaryId = body.primary_analyst_contact_id || '';
    const primaryName = body.primary_analyst_name || '';
    const secondaryId = body.secondary_analyst_contact_id || '';
    const secondaryName = body.secondary_analyst_name || '';
    const firmName = body.firm_name || '';
    const productName = body.product_name || '';
    const oldPrimaryId = body.old_primary_analyst_contact_id || '';
    const oldSecondaryId = body.old_secondary_analyst_contact_id || '';

    // Determine which analysts are newly assigned.
    // On create: every assigned analyst is new.
    // On update: only analysts whose ID differs from the previous value.
    const newAnalysts: Array<{ id: string; name: string; role: 'primary' | 'secondary' }> = [];
    if (primaryId) {
      const isNew = eventType === 'create' || primaryId !== oldPrimaryId;
      if (isNew) newAnalysts.push({ id: primaryId, name: primaryName, role: 'primary' });
    }
    if (secondaryId) {
      const isNew = eventType === 'create' || secondaryId !== oldSecondaryId;
      if (isNew) newAnalysts.push({ id: secondaryId, name: secondaryName, role: 'secondary' });
    }

    if (newAnalysts.length === 0) {
      return Response.json({ skipped: 'no new analyst assignments' });
    }

    let created = 0;
    const errors: Array<Record<string, string>> = [];
    for (const analyst of newAnalysts) {
      try {
        // Deduplicate: skip if a coverage_assignment notification already
        // exists for this (due_diligence_id, contact_id) pair.
        const existing = await base44.asServiceRole.entities.DdNotification.filter(
          { due_diligence_id: ddId, contact_id: analyst.id, type: 'coverage_assignment' },
          '-created_date',
          10
        );
        if (existing.length > 0) continue;

        const roleLabel = analyst.role === 'primary' ? 'Primary' : 'Secondary';
        await base44.asServiceRole.entities.DdNotification.create({
          contact_id: analyst.id,
          contact_name: analyst.name,
          type: 'coverage_assignment',
          title: `New ${roleLabel} coverage assignment`,
          message: `You have been assigned as ${roleLabel} Analyst for ${productName || 'due diligence'}${firmName ? ` at ${firmName}` : ''}.`,
          due_diligence_id: ddId,
          firm_name: firmName,
          product_name: productName,
          coverage_role: analyst.role,
          status: 'unread',
        });
        created++;
      } catch (e) {
        errors.push({ contact_id: analyst.id, error: (e as Error).message });
      }
    }

    return Response.json({ created, checked: newAnalysts.length, errors });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}