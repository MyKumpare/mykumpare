/**
 * Computes the overall Pass/Fail and rating label from a weighted final score
 * using the template's rating_config.
 *
 * @param {number} weightedFinalScore - the block-weighted average final score (1-5), or null
 * @param {object} ratingConfig - template.rating_config
 * @returns {{ passFail: string, ratingLabel: string, ratingColor: string }}
 *   passFail is "Pass", "Fail", or "" (when not enabled / no score)
 *   ratingLabel is the matched option's label, or "" (when not enabled / no match)
 */
export function computeOverallRating(weightedFinalScore, ratingConfig) {
  const result = { passFail: "", ratingLabel: "", ratingColor: "" };
  if (weightedFinalScore == null || isNaN(weightedFinalScore)) return result;
  const cfg = ratingConfig || {};

  if (cfg.pass_fail_enabled && cfg.pass_threshold != null && !isNaN(cfg.pass_threshold)) {
    result.passFail = weightedFinalScore >= cfg.pass_threshold ? "Pass" : "Fail";
  }

  if (cfg.rating_enabled && Array.isArray(cfg.rating_options)) {
    const match = cfg.rating_options.find((opt) => {
      const op = opt.operator || "between";
      const v = opt.min_score != null && !isNaN(opt.min_score) ? opt.min_score : null;
      const max = opt.max_score != null && !isNaN(opt.max_score) ? opt.max_score : null;
      if (v == null) return false;
      switch (op) {
        case "gte": return weightedFinalScore >= v;
        case "gt": return weightedFinalScore > v;
        case "lte": return weightedFinalScore <= v;
        case "lt": return weightedFinalScore < v;
        case "eq": return weightedFinalScore === v;
        case "between":
        default: {
          const lo = v;
          const hi = max != null ? max : Infinity;
          return weightedFinalScore >= lo && weightedFinalScore <= hi;
        }
      }
    });
    if (match) {
      result.ratingLabel = match.label || "";
      result.ratingColor = match.color || "";
    }
  }

  return result;
}