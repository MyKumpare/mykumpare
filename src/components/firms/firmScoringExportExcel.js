import * as XLSX from "xlsx";
import { format } from "date-fns";
import { computeWeightedScoreMulti } from "@/components/templates/scoringWeightLogic";

/**
 * Exports a firm's full scoring history + the data behind the final radar
 * chart as a multi-sheet Excel workbook.
 *
 * Sheets:
 *  1. Scoring History — one row per scoring version (product, template,
 *     version, status, dates, weighted final, rating, pass/fail, analyst).
 *  2. Latest Score Detail — per-criterion breakdown of the latest finalized
 *     score (block, criterion, primary, final, bonus/penalty, notes).
 *  3. Radar Data — criterion → final score for the latest finalized score
 *     (the numeric data the radar chart visualizes).
 *
 * @param {object} opts
 * @param {object} opts.firm   - Firm record
 * @param {array}  opts.scores - ScoringMatrixScore records for the firm (sorted desc by start date)
 */
export function exportFirmScoringHistoryExcel({ firm, scores }) {
  const safe = (v) => (v == null ? "" : v);

  const weightedFinal = (s) => {
    const v = computeWeightedScoreMulti(s.scoring_blocks || [], "final_score", {
      applyBonusPenalty: true,
      mode: "perCriterion",
    });
    return v != null ? Number(v.toFixed(2)) : "";
  };

  // ── Sheet 1: Scoring History ──
  const historyRows = scores.map((s) => ({
    "Version": `v${s.version_number || 1}`,
    "Product": safe(s.product_name),
    "Template": safe(s.template_name),
    "Status": safe(s.status),
    "Closed": s.is_closed ? "Yes" : "No",
    "Scoring Start": safe(s.scoring_start_date),
    "Scoring End": safe(s.scoring_end_date),
    "Weighted Final": weightedFinal(s),
    "Rating": safe(s.overall_rating),
    "Pass/Fail": safe(s.overall_pass_fail),
    "Primary Analyst": safe(s.primary_analyst_name),
  }));

  // ── Latest finalized score (for detail + radar) ──
  const latestFinal =
    scores.find((s) => s.is_closed && s.final_score_finalized) || scores.find((s) => s.is_closed) || scores[0];

  let detailRows = [];
  let radarRows = [];
  if (latestFinal) {
    (latestFinal.scoring_blocks || []).forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        const finalScore = crit.final_score ?? "";
        const bonus = crit.bonus_penalty_active && crit.bonus_penalty_value
          ? crit.bonus_penalty_value
          : "";
        detailRows.push({
          "Block": safe(block.name),
          "Criterion": safe(crit.name),
          "Category": safe(crit.category),
          "Primary Score": safe(crit.primary_score),
          "Final Score": finalScore,
          "Bonus/Penalty": bonus,
          "Final Notes": safe(crit.final_notes),
        });
        radarRows.push({
          "Criterion": safe(crit.name),
          "Block": safe(block.name),
          "Final Score": finalScore === "" ? "" : Number(finalScore),
        });
      });
    });
  }

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(historyRows.length ? historyRows : [{ "No scoring history": "" }]);
  XLSX.utils.book_append_sheet(wb, ws1, "Scoring History");

  const ws2 = XLSX.utils.json_to_sheet(detailRows.length ? detailRows : [{ "No finalized score": "" }]);
  XLSX.utils.book_append_sheet(wb, ws2, "Latest Score Detail");

  const ws3 = XLSX.utils.json_to_sheet(radarRows.length ? radarRows : [{ "No radar data": "" }]);
  XLSX.utils.book_append_sheet(wb, ws3, "Radar Data");

  const dateStr = format(new Date(), "yyyy-MM-dd");
  const fileName = `Scoring_History_${(firm?.name || "Firm").replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}