import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Generates a printable summary report for a firm, including:
 *  - Firm profile (name, type, website, location, description)
 *  - Latest total adjusted weighted score (with bonus/penalty applied)
 *  - Current scoring workflow status + overall rating / pass-fail
 *  - History of recent bonus/penalty adjustments across all scoring versions
 *
 * Frontend invokes via base44.functions.invoke('generateFirmSummaryReport', { firm_id })
 * and renders the returned payload as a printable report / PDF.
 */

const num = (v) => (v == null || isNaN(v) ? 1 : Number(v));

/**
 * Compute the block-weighted average of per-criterion final_score values,
 * applying bonus/penalty adjustments (clamped to 1-5) and honoring block +
 * criterion multiplier factors. Mirrors the "perCriterion" mode used by the
 * scorecard UI so the report matches what analysts see on screen.
 */
function computeWeightedTotal(blocks) {
  if (!Array.isArray(blocks)) return null;
  let total = 0;
  let totalWeight = 0;

  for (const block of blocks) {
    const crits = block.criteria || [];
    const blockEff = (block.weight || 0) * num(block.multiplier);
    for (const crit of crits) {
      let s = crit.final_score;
      if (s == null) s = crit.adjusted_primary_score;
      if (s == null) s = crit.primary_score;
      if (s == null) continue;
      if (crit.bonus_penalty_active && crit.bonus_penalty_value) {
        s = Math.max(1, Math.min(5, s + crit.bonus_penalty_value));
      }
      const w = blockEff * num(crit.multiplier);
      total += s * w;
      totalWeight += w;
    }
  }

  if (totalWeight <= 0) return null;
  return total / totalWeight;
}

/**
 * Extract all bonus/penalty adjustments from a score's scoring_blocks, keyed
 * by criterion. Returns one entry per active adjustment with block, criterion,
 * value, notes, and the score version it came from.
 */
function extractAdjustments(score) {
  const out = [];
  if (!score.scoring_blocks) return out;
  for (const block of score.scoring_blocks) {
    for (const crit of block.criteria || []) {
      if (crit.bonus_penalty_active && crit.bonus_penalty_value) {
        out.push({
          score_id: score._id,
          version: score.version_number || 1,
          template_name: score.template_name || "",
          product_name: score.product_name || "",
          block_name: block.name || "",
          criterion_name: crit.name || "",
          criterion_number: crit.number ?? null,
          direction: crit.bonus_penalty_value > 0 ? "bonus" : "penalty",
          value: crit.bonus_penalty_value,
          notes: crit.bonus_penalty_notes || "",
          scoring_end_date: score.scoring_end_date || "",
          status: score.status || "",
          created_date: score.created_date || "",
        });
      }
    }
  }
  return out;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const firmId = body.firm_id;
    if (!firmId) return Response.json({ error: "firm_id is required" }, { status: 400 });

    // ── Firm profile ──
    const firm = await base44.entities.Firm.get(firmId).catch(() => null);
    if (!firm || firm.deleted_at) {
      return Response.json({ error: "Firm not found" }, { status: 404 });
    }

    // ── All scoring records for this firm (newest first) ──
    const scores = await base44.entities.ScoringMatrixScore.filter(
      { firm_id: firmId },
      "-created_date",
      100
    );

    if (!scores || scores.length === 0) {
      return Response.json({
        firm: {
          id: firm._id,
          name: firm.name,
          firm_type: firm.firm_type || "",
          website: firm.website || "",
          location: firm.location || "",
          geographic_region: firm.geographic_region || "",
          description: firm.description || "",
          year_founded: firm.year_founded || null,
        },
        latest_score: null,
        total_adjusted_score: null,
        current_status: null,
        overall_rating: null,
        overall_pass_fail: null,
        bonus_penalty_history: [],
        scoring_count: 0,
        generated_at: new Date().toISOString(),
      });
    }

    // ── Latest score (first in the -created_date sorted list) ──
    const latest = scores[0];
    const totalAdjusted = computeWeightedTotal(latest.scoring_blocks);

    // ── Bonus/penalty history across all versions (newest first) ──
    const allAdjustments = [];
    for (const s of scores) {
      const adj = extractAdjustments(s);
      for (const a of adj) allAdjustments.push(a);
    }

    // ── Current status summary ──
    const statusLabel = {
      draft: "Draft",
      primary_scoring: "Primary Scoring",
      secondary_scoring: "Secondary Scoring",
      team_review: "Team Review",
      ic_review: "IC Review",
      finalized: "Finalized",
    }[latest.status] || latest.status || "Draft";

    return Response.json({
      firm: {
        id: firm._id,
        name: firm.name,
        firm_type: firm.firm_type || "",
        website: firm.website || "",
        location: firm.location || "",
        geographic_region: firm.geographic_region || "",
        description: firm.description || "",
        year_founded: firm.year_founded || null,
      },
      latest_score: {
        id: latest._id,
        template_name: latest.template_name || "",
        product_name: latest.product_name || "",
        version: latest.version_number || 1,
        status: latest.status || "draft",
        status_label: statusLabel,
        scoring_start_date: latest.scoring_start_date || "",
        scoring_end_date: latest.scoring_end_date || "",
        primary_analyst_name: latest.primary_analyst_name || "",
        is_closed: !!latest.is_closed,
      },
      total_adjusted_score: totalAdjusted != null ? Number(totalAdjusted.toFixed(2)) : null,
      current_status: statusLabel,
      overall_rating: latest.overall_rating || null,
      overall_pass_fail: latest.overall_pass_fail || "",
      bonus_penalty_history: allAdjustments,
      scoring_count: scores.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}