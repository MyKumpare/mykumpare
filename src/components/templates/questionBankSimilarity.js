/**
 * Shared duplicate-detection for the Question Bank.
 * Used both when pushing a new question and when adding from the picker,
 * so validation is consistent everywhere a question enters the bank.
 */

const normalize = (s) =>
  (s || "").trim().toLowerCase().replace(/[\s_-]+/g, " ").replace(/[^\w\s?]/g, "").replace(/\s+/g, " ").trim();

const levenshtein = (a, b) => {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

// Returns 0..1 similarity ratio (1 = identical)
export const similarity = (a, b) => {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
};

export const SIMILARITY_THRESHOLD = 0.85;

/**
 * Find an existing question that is an exact or near-duplicate of `text`.
 * @param {string} text - the question text to check
 * @param {Array} existing - array of QuestionBank records (with question_text)
 * @returns {Object|null} the duplicate record, or null if none found
 */
export const findQuestionDuplicate = (text, existing = []) => {
  const target = normalize(text);
  if (!target) return null;
  let best = null;
  let bestScore = 0;
  for (const q of existing) {
    const score = similarity(text, q.question_text);
    if (score >= SIMILARITY_THRESHOLD && score > bestScore) {
      best = q;
      bestScore = score;
    }
  }
  return best;
};