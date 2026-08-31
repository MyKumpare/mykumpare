import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * checkFirmAumThresholds
 *
 * Scans each firm's latest month-end AUM against its configured per-firm
 * thresholds (FirmAumThreshold) and raises FirmAumAlert records for any firm
 * whose latest AUM falls below its minimum threshold OR exceeds its maximum
 * threshold.
 *
 * Two modes:
 *  - Real-time: pass { firm_id } to check a single firm (e.g. right after AUM
 *    history is saved).
 *  - Sweep (daily workflow): pass no firm_id to scan all enabled thresholds.
 *
 * Deduplication: an alert is only created if no existing FirmAumAlert already
 * references the same firm_id + month_end_date + alert_type (so re-running the
 * sweep never produces duplicates for the same data point).
 *
 * Also auto-resolves existing 'active' alerts for a firm when a newer AUM data
 * point comes in within thresholds (the firm's AUM recovered).
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const singleFirmId = body?.firm_id || null;

    // 1. Load all enabled per-firm threshold settings (tenant-scoped via RLS).
    const settings = await base44.entities.FirmAumThreshold.list('-created_date', 500);
    const enabledSettings = (settings || []).filter(
      (s) => s.enabled && s.firm_id && (s.threshold != null || s.max_threshold != null)
    );
    if (enabledSettings.length === 0) {
      return Response.json({ checked: 0, raised: 0, message: 'No enabled AUM threshold settings found.' });
    }

    const settingsByFirmId = new Map();
    for (const s of enabledSettings) {
      settingsByFirmId.set(s.firm_id, s);
    }

    // 2. Load existing alerts so we can dedup by firm_id + month_end_date + alert_type
    //    and auto-resolve stale ones.
    const existingAlerts = await base44.entities.FirmAumAlert.list('-created_date', 500);
    const alertKeys = new Set(
      (existingAlerts || []).map((a) => `${a.firm_id}|${a.month_end_date}|${a.alert_type || 'below_min'}`)
    );

    let checked = 0;
    let raised = 0;
    const raisedAlerts = [];

    // 3. For each firm with a threshold, find its latest AUM data point.
    const firmIdsToCheck = singleFirmId
      ? [singleFirmId]
      : Array.from(settingsByFirmId.keys());

    for (const firmId of firmIdsToCheck) {
      const setting = settingsByFirmId.get(firmId);
      if (!setting) continue;

      // Fetch the firm to read its aum_history array.
      let firm;
      try {
        firm = await base44.entities.Firm.get(firmId);
      } catch {
        continue; // firm may have been deleted
      }
      if (!firm || firm.deleted_at) continue;

      const aumHistory = firm.aum_history || [];
      if (aumHistory.length === 0) continue;

      // Find the latest AUM entry by month_end_date.
      const sorted = [...aumHistory].sort((a, b) => {
        const da = a.month_end_date || '';
        const db = b.month_end_date || '';
        return db.localeCompare(da);
      });
      const latest = sorted[0];
      if (!latest || latest.firm_aum == null) continue;

      checked += 1;
      const aum = latest.firm_aum;
      const monthEndDate = latest.month_end_date;

      const minThreshold = setting.threshold;
      const maxThreshold = setting.max_threshold;

      const belowMin = minThreshold != null && aum < minThreshold;
      const aboveMax = maxThreshold != null && aum > maxThreshold;

      // Auto-resolve any prior 'active' alerts for this firm when this newer
      // AUM data point is within thresholds (firm's AUM recovered).
      if (!belowMin && !aboveMax) {
        const stale = (existingAlerts || []).filter(
          (a) => a.firm_id === firmId && a.status === 'active'
        );
        for (const a of stale) {
          await base44.entities.FirmAumAlert.update(a.id, {
            status: 'resolved',
            resolved_at: new Date().toISOString()
          });
        }
        continue;
      }

      // Raise alert(s) — a firm can trigger both below_min and above_max if
      // the thresholds are misconfigured, but normally only one fires.
      const triggers = [];
      if (belowMin) triggers.push({ alert_type: 'below_min', threshold: minThreshold });
      if (aboveMax) triggers.push({ alert_type: 'above_max', threshold: maxThreshold });

      for (const trig of triggers) {
        const dedupKey = `${firmId}|${monthEndDate}|${trig.alert_type}`;
        if (alertKeys.has(dedupKey)) continue;

        const alert = await base44.entities.FirmAumAlert.create({
          tenant_id: firm.tenant_id || setting.tenant_id,
          firm_id: firmId,
          firm_name: firm.name || setting.firm_name || '',
          aum_value: aum,
          threshold: trig.threshold,
          alert_type: trig.alert_type,
          month_end_date: monthEndDate,
          status: 'active'
        });
        raised += 1;
        raisedAlerts.push(alert);
        alertKeys.add(dedupKey);
      }
    }

    return Response.json({
      checked,
      raised,
      raisedAlerts: raisedAlerts.map((a) => ({
        id: a.id,
        firm_name: a.firm_name,
        aum_value: a.aum_value,
        threshold: a.threshold,
        alert_type: a.alert_type,
        month_end_date: a.month_end_date
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}