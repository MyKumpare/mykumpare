import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * checkStalledDdProcesses
 *
 * Scans all due diligence processes and raises StalledDdAlert records for any
 * process that has been in the same stage for more than 6 months (180 days).
 *
 * Two modes:
 *  - Real-time: pass { due_diligence_id } to check a single record (e.g. right
 *    after a stage update).
 *  - Sweep (weekly workflow): pass no due_diligence_id to scan all records.
 *
 * Deduplication: an alert is only created if no existing 'active' StalledDdAlert
 * already references the same due_diligence_id + stage_id.
 *
 * Auto-resolve: when a process has advanced past the stage an existing 'active'
 * alert references, that alert is automatically resolved.
 *
 * Notification: sends an email to the primary analyst contact (if they have an
 * email) when a new alert is raised.
 */
const THRESHOLD_DAYS = 180;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const singleDdId = body?.due_diligence_id || null;

    // 1. Load all due diligence records (tenant-scoped via RLS).
    const records = await base44.entities.DueDiligence.list('-created_date', 500);
    const active = (records || []).filter((r) => !r.deleted_at);
    if (active.length === 0) {
      return Response.json({ checked: 0, raised: 0, message: 'No due diligence records found.' });
    }

    // 2. Load existing alerts for dedup + auto-resolve.
    const existingAlerts = await base44.entities.StalledDdAlert.list('-created_date', 500);
    const activeAlertMap = new Map();
    for (const a of (existingAlerts || [])) {
      if (a.status === 'active') {
        activeAlertMap.set(`${a.due_diligence_id}|${a.stage_id}`, a);
      }
    }

    let checked = 0;
    let raised = 0;
    let resolved = 0;
    let notified = 0;
    const raisedAlerts = [];

    // 3. For each DD record, determine how long it's been in the current stage.
    const recordsToCheck = singleDdId
      ? active.filter((r) => r.id === singleDdId)
      : active;

    const now = new Date();

    for (const rec of recordsToCheck) {
      const stages = rec.stages || [];
      if (stages.length === 0) continue;

      const currentIdx = rec.current_stage_index || 0;
      const currentStage = stages[currentIdx];
      if (!currentStage || currentStage.completed) {
        // Stage is completed or doesn't exist — auto-resolve any active alert
        // for a prior stage of this record.
        for (const [key, alert] of activeAlertMap.entries()) {
          if (alert.due_diligence_id === rec.id) {
            await base44.entities.StalledDdAlert.update(alert.id, {
              status: 'resolved',
              resolved_at: now.toISOString()
            });
            activeAlertMap.delete(key);
            resolved += 1;
          }
        }
        continue;
      }

      // Determine the stage start date.
      let stageStart = currentStage.start_date || rec.start_date || null;
      let daysInStage = 0;
      if (stageStart) {
        try {
          const start = new Date(stageStart);
          if (!isNaN(start.getTime())) {
            daysInStage = Math.floor((now - start) / (1000 * 60 * 60 * 24));
          }
        } catch { /* skip invalid date */ }
      }

      checked += 1;

      // Auto-resolve alerts for a DIFFERENT stage (the process advanced).
      const currentKey = `${rec.id}|${currentStage.id || currentIdx}`;
      for (const [key, alert] of activeAlertMap.entries()) {
        if (alert.due_diligence_id === rec.id && key !== currentKey) {
          await base44.entities.StalledDdAlert.update(alert.id, {
            status: 'resolved',
            resolved_at: now.toISOString()
          });
          activeAlertMap.delete(key);
          resolved += 1;
        }
      }

      // Not stalled — skip.
      if (daysInStage < THRESHOLD_DAYS) continue;

      // Already has an active alert for this stage — skip (dedup).
      if (activeAlertMap.has(currentKey)) continue;

      // Raise a new alert.
      const alert = await base44.entities.StalledDdAlert.create({
        tenant_id: rec.tenant_id || '',
        due_diligence_id: rec.id,
        firm_id: rec.firm_id || '',
        firm_name: rec.firm_name || '',
        product_id: rec.product_id || '',
        product_name: rec.product_name || '',
        template_name: rec.template_name || '',
        stage_id: currentStage.id || String(currentIdx),
        stage_name: currentStage.name || '',
        stage_index: currentIdx,
        stage_start_date: stageStart || '',
        days_in_stage: daysInStage,
        threshold_days: THRESHOLD_DAYS,
        primary_analyst_name: rec.primary_analyst_name || '',
        dd_status: rec.status || '',
        notification_sent: false,
        status: 'active'
      });

      raised += 1;
      raisedAlerts.push(alert);
      activeAlertMap.set(currentKey, alert);

      // Send email notification to the primary analyst contact if available.
      let analystEmail = null;
      if (rec.primary_analyst_contact_id) {
        try {
          const contact = await base44.entities.Contact.get(rec.primary_analyst_contact_id);
          if (contact && contact.email) analystEmail = contact.email;
        } catch { /* contact may have been deleted */ }
      }

      if (analystEmail) {
        try {
          const subject = `Stalled Due Diligence Alert: ${rec.firm_name || ''} — ${currentStage.name || ''} (${daysInStage} days)`;
          const bodyText = [
            `A due diligence process has been stalled in the same stage for over 6 months and requires immediate attention.`,
            ``,
            `Firm: ${rec.firm_name || '—'}`,
            `Product: ${rec.product_name || '—'}`,
            `Template: ${rec.template_name || '—'}`,
            `Current Stage: ${currentStage.name || '—'} (Stage ${currentIdx + 1} of ${stages.length})`,
            `Days in Stage: ${daysInStage}`,
            `Primary Analyst: ${rec.primary_analyst_name || '—'}`,
            `Status: ${rec.status || '—'}`,
            ``,
            `Please review this process and take action to advance it or document the reason for the delay.`,
            ``,
            `Powered by MyKumpare`
          ].join('\n');
          await base44.integrations.Core.SendEmail({
            to: analystEmail,
            subject,
            body: bodyText
          });
          await base44.entities.StalledDdAlert.update(alert.id, {
            notification_sent: true,
            last_notified_at: now.toISOString()
          });
          notified += 1;
        } catch (e) {
          // Email send failed — alert is still raised; notification_sent stays false.
          console.error('Failed to send stalled DD notification email:', e.message);
        }
      }
    }

    return Response.json({
      checked,
      raised,
      resolved,
      notified,
      threshold_days: THRESHOLD_DAYS,
      raisedAlerts: raisedAlerts.map((a) => ({
        id: a.id,
        firm_name: a.firm_name,
        product_name: a.product_name,
        stage_name: a.stage_name,
        days_in_stage: a.days_in_stage
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}