import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { computeWeightedFinal } from '../../shared/scoringThresholdLogic.ts';

/**
 * checkScoringThresholds
 *
 * Scans finalized ScoringMatrixScore records and raises ScoringThresholdAlert
 * records for any firm whose weighted final score falls below its configured
 * per-firm threshold (ScoringThresholdSetting).
 *
 * Two modes:
 *  - Real-time: pass { score_id } to check a single just-finalized score.
 *  - Sweep (daily workflow): pass no score_id to scan all finalized scores.
 *
 * Deduplication: an alert is only created if no existing ScoringThresholdAlert
 * already references the same score_id (so re-running the sweep or re-checking
 * a score never produces duplicates).
 *
 * Also auto-resolves existing 'active' alerts for a firm when a newer finalized
 * score for the same product+template comes in above threshold (the firm was
 * re-evaluated and improved).
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const singleScoreId = body?.score_id || null;

    // 1. Load all enabled per-firm threshold settings (tenant-scoped via RLS).
    const settings = await base44.entities.ScoringThresholdSetting.list('-created_date', 500);
    const enabledSettings = (settings || []).filter((s) => s.enabled && s.firm_id && s.threshold != null);
    if (enabledSettings.length === 0) {
      return Response.json({ checked: 0, raised: 0, message: 'No enabled threshold settings found.' });
    }
    const thresholdByFirmId = new Map();
    for (const s of enabledSettings) {
      thresholdByFirmId.set(s.firm_id, s);
    }

    // 2. Load finalized scores. Either the single one (real-time) or all (sweep).
    let scoresToCheck;
    if (singleScoreId) {
      const single = await base44.entities.ScoringMatrixScore.get(singleScoreId);
      scoresToCheck = [single];
    } else {
      scoresToCheck = await base44.entities.ScoringMatrixScore.filter({ status: 'finalized' }, '-updated_date', 500);
    }

    // 3. Load existing alerts so we can dedup by score_id and auto-resolve stale ones.
    const existingAlerts = await base44.entities.ScoringThresholdAlert.list('-created_date', 500);
    const alertScoreIds = new Set((existingAlerts || []).map((a) => a.score_id));

    let checked = 0;
    let raised = 0;
    const raisedAlerts = [];

    for (const score of scoresToCheck) {
      if (!score || score.status !== 'finalized') continue;
      const setting = thresholdByFirmId.get(score.firm_id);
      if (!setting) continue; // no threshold configured for this firm

      checked += 1;
      const weighted = computeWeightedFinal(score);
      if (weighted == null) continue;

      // Auto-resolve any prior 'active' alerts for this firm's product+template
      // when this newer score is at or above threshold (firm was re-evaluated).
      if (weighted >= setting.threshold) {
        const stale = (existingAlerts || []).filter(
          (a) =>
            a.firm_id === score.firm_id &&
            a.product_id === score.product_id &&
            a.template_id === score.template_id &&
            a.status === 'active' &&
            a.score_id !== score.id
        );
        for (const a of stale) {
          await base44.entities.ScoringThresholdAlert.update(a.id, {
            status: 'resolved',
            resolved_at: new Date().toISOString()
          });
        }
        continue;
      }

      // Below threshold — raise an alert unless one already exists for this score.
      if (alertScoreIds.has(score.id)) continue;

      const alert = await base44.entities.ScoringThresholdAlert.create({
        tenant_id: score.tenant_id,
        firm_id: score.firm_id,
        firm_name: score.firm_name,
        score_id: score.id,
        product_id: score.product_id,
        product_name: score.product_name,
        template_id: score.template_id,
        template_name: score.template_name,
        version_number: score.version_number || 1,
        weighted_final_score: Math.round(weighted * 100) / 100,
        threshold: setting.threshold,
        scoring_end_date: score.scoring_end_date || '',
        status: 'active'
      });
      raised += 1;
      raisedAlerts.push(alert);
      alertScoreIds.add(score.id);
    }

    return Response.json({
      checked,
      raised,
      raisedAlerts: raisedAlerts.map((a) => ({ id: a.id, firm_name: a.firm_name, weighted_final_score: a.weighted_final_score, threshold: a.threshold }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}