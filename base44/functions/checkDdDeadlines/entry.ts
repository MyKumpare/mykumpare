import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * checkDdDeadlines
 *
 * Scans all active due diligence processes and creates "deadline_approaching"
 * DdNotification records for team members whose sub-stage assignments, task
 * assignments, or milestone target dates are approaching within the threshold
 * (default 3 days).
 *
 * Called daily by the "DD Deadline Notifications" scheduled workflow.
 * Can also be invoked manually with { due_diligence_id } to check a single record.
 *
 * Deduplication: a notification is only created if no existing
 * "deadline_approaching" notification references the same
 * (due_diligence_id, contact_id, deadline_date, deadline_type, stage_name, sub_stage_name).
 */
const DEFAULT_THRESHOLD_DAYS = 3;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const singleDdId = body?.due_diligence_id || null;
    const thresholdDays = body?.threshold_days ?? DEFAULT_THRESHOLD_DAYS;

    // 1. Load all due diligence records.
    const records = await base44.entities.DueDiligence.list('-created_date', 500);
    const active = (records || []).filter((r) => !r.deleted_at);
    if (active.length === 0) {
      return Response.json({ checked: 0, created: 0, message: 'No due diligence records found.' });
    }

    // 2. Load existing deadline_approaching notifications for dedup.
    const existingNotifs = await base44.entities.DdNotification.filter(
      { type: 'deadline_approaching' },
      '-created_date',
      500
    );
    const notifKeySet = new Set();
    for (const n of (existingNotifs || [])) {
      const key = [
        n.due_diligence_id || '',
        n.contact_id || '',
        n.deadline_date || '',
        n.deadline_type || '',
        n.stage_name || '',
        n.sub_stage_name || ''
      ].join('|');
      notifKeySet.add(key);
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const thresholdDate = new Date(now);
    thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);
    const thresholdStr = thresholdDate.toISOString().slice(0, 10);

    let checked = 0;
    let created = 0;
    const createdNotifs = [];

    const recordsToCheck = singleDdId
      ? active.filter((r) => r.id === singleDdId)
      : active;

    for (const rec of recordsToCheck) {
      checked += 1;
      const stages = rec.stages || [];

      // ── A. Sub-stage assignment due dates ──
      for (const stage of stages) {
        if (stage.completed) continue;
        const stageName = stage.name || '';
        for (const ss of (stage.sub_stages || [])) {
          if (ss.status === 'completed') continue;
          const ssName = ss.name || '';
          for (const a of (ss.assignments || [])) {
            if (a.status === 'completed') continue;
            if (!a.contact_id || !a.due_date) continue;
            if (a.due_date < todayStr || a.due_date > thresholdStr) continue;

            const dedupKey = [
              rec.id, a.contact_id, a.due_date,
              'sub_stage_assignment', stageName, ssName
            ].join('|');
            if (notifKeySet.has(dedupKey)) continue;
            notifKeySet.add(dedupKey);

            const daysAway = Math.ceil(
              (new Date(a.due_date) - now) / (1000 * 60 * 60 * 24)
            );

            const notif = await base44.entities.DdNotification.create({
              contact_id: a.contact_id,
              contact_name: a.contact_name || '',
              type: 'deadline_approaching',
              title: `Deadline approaching: "${ssName}" in ${stageName}`,
              message: `Sub-stage "${ssName}" (stage "${stageName}") for ${rec.product_name || 'due diligence'}${rec.firm_name ? ` (${rec.firm_name})` : ''} is due in ${daysAway} day(s) — ${a.due_date}.`,
              due_diligence_id: rec.id,
              firm_name: rec.firm_name || '',
              product_name: rec.product_name || '',
              stage_name: stageName,
              sub_stage_name: ssName,
              deadline_date: a.due_date,
              deadline_type: 'sub_stage_assignment',
              deadline_days_away: daysAway,
              status: 'unread'
            });
            created += 1;
            createdNotifs.push({ id: notif.id, contact: a.contact_name, deadline: a.due_date });
          }
        }
      }

      // ── B. Task assignment due dates (approval_process_logic) ──
      for (const step of (rec.approval_process_logic || [])) {
        const stepName = step.name || '';
        const stageName = step.stage_name || '';
        for (const ta of (step.task_assignments || [])) {
          if (ta.status === 'completed') continue;
          if (!ta.contact_id || !ta.due_date) continue;
          if (ta.due_date < todayStr || ta.due_date > thresholdStr) continue;

          const dedupKey = [
            rec.id, ta.contact_id, ta.due_date,
            'task_assignment', stageName, stepName
          ].join('|');
          if (notifKeySet.has(dedupKey)) continue;
          notifKeySet.add(dedupKey);

          const daysAway = Math.ceil(
            (new Date(ta.due_date) - now) / (1000 * 60 * 60 * 24)
          );

          const notif = await base44.entities.DdNotification.create({
            contact_id: ta.contact_id,
            contact_name: ta.contact_name || '',
            type: 'deadline_approaching',
            title: `Task deadline approaching: "${stepName}"`,
            message: `Task "${stepName}"${stageName ? ` (stage "${stageName}")` : ''} for ${rec.product_name || 'due diligence'}${rec.firm_name ? ` (${rec.firm_name})` : ''} is due in ${daysAway} day(s) — ${ta.due_date}.`,
            due_diligence_id: rec.id,
            firm_name: rec.firm_name || '',
            product_name: rec.product_name || '',
            stage_name: stageName,
            sub_stage_name: stepName,
            deadline_date: ta.due_date,
            deadline_type: 'task_assignment',
            deadline_days_away: daysAway,
            status: 'unread'
          });
          created += 1;
          createdNotifs.push({ id: notif.id, contact: ta.contact_name, deadline: ta.due_date });
        }
      }

      // ── C. Milestone target dates ──
      for (const m of (rec.milestones || [])) {
        if (m.completed) continue;
        if (!m.target_date) continue;
        if (m.target_date < todayStr || m.target_date > thresholdStr) continue;

        // Notify primary analyst (and secondary if present)
        const milestoneRecipients = [];
        if (rec.primary_analyst_contact_id) {
          milestoneRecipients.push({
            contact_id: rec.primary_analyst_contact_id,
            contact_name: rec.primary_analyst_name || ''
          });
        }
        if (rec.secondary_analyst_contact_id) {
          milestoneRecipients.push({
            contact_id: rec.secondary_analyst_contact_id,
            contact_name: rec.secondary_analyst_name || ''
          });
        }

        for (const recip of milestoneRecipients) {
          const dedupKey = [
            rec.id, recip.contact_id, m.target_date,
            'milestone', '', m.name || ''
          ].join('|');
          if (notifKeySet.has(dedupKey)) continue;
          notifKeySet.add(dedupKey);

          const daysAway = Math.ceil(
            (new Date(m.target_date) - now) / (1000 * 60 * 60 * 24)
          );

          const notif = await base44.entities.DdNotification.create({
            contact_id: recip.contact_id,
            contact_name: recip.contact_name,
            type: 'deadline_approaching',
            title: `Milestone deadline approaching: "${m.name}"`,
            message: `Milestone "${m.name}" for ${rec.product_name || 'due diligence'}${rec.firm_name ? ` (${rec.firm_name})` : ''} is due in ${daysAway} day(s) — ${m.target_date}.`,
            due_diligence_id: rec.id,
            firm_name: rec.firm_name || '',
            product_name: rec.product_name || '',
            stage_name: '',
            sub_stage_name: m.name || '',
            deadline_date: m.target_date,
            deadline_type: 'milestone',
            deadline_days_away: daysAway,
            status: 'unread'
          });
          created += 1;
          createdNotifs.push({ id: notif.id, contact: recip.contact_name, deadline: m.target_date });
        }
      }
    }

    return Response.json({
      checked,
      created,
      threshold_days: thresholdDays,
      notifications: createdNotifs.slice(0, 20)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}