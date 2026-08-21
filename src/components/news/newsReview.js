// Per-user news article review helpers.
// A review is stored on the FirmNews record in the `reviews` array, one entry
// per user. "Needs review" is therefore per-user: one user reviewing an article
// does not mark it reviewed for anyone else.

const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Returns the current user's review entry for this article, or undefined.
export function getMyReview(news, userId) {
  if (!news || !userId) return undefined;
  return (news.reviews || []).find((r) => r.user_id === userId);
}

// Whether the current user has already reviewed this article.
export function isReviewedByUser(news, userId) {
  return !!getMyReview(news, userId);
}

// Whether any reviewer flagged this article as needing more reviews.
export function needsFurtherReview(news) {
  return (news.reviews || []).some((r) => r.needs_more_reviews);
}

// Builds the new `reviews` array after the current user saves a review.
// Replaces their existing entry if they already reviewed (edit), otherwise appends.
export function buildReviews(news, userId, userName, { note, needs_more_reviews, flagged_high_alert }) {
  if (!userId) return news.reviews || [];
  const others = (news.reviews || []).filter((r) => r.user_id !== userId);
  const entry = {
    id: uid(),
    user_id: userId,
    user_name: userName || "",
    reviewed_date: new Date().toISOString(),
    note: note || "",
    needs_more_reviews: !!needs_more_reviews,
    flagged_high_alert: !!flagged_high_alert,
  };
  return [...others, entry];
}