import React from "react";
import { ClipboardCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { isReviewedByUser, getMyReview, needsFurtherReview } from "./newsReview";

// Per-user review badge. Shows whether the CURRENT user has reviewed this
// article ("Needs Review" vs "Reviewed"), plus an indicator if any reviewer
// flagged it as needing more reviews.
// props: item (FirmNews), currentUser ({ id })
export default function NewsReviewBadge({ item, currentUser }) {
  if (!currentUser?.id) return null;
  const reviewed = isReviewedByUser(item, currentUser.id);
  const my = getMyReview(item, currentUser.id);
  const further = needsFurtherReview(item);

  return (
    <span className="inline-flex items-center gap-1">
      {further && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5"
          title="A reviewer flagged this article as needing more review"
        >
          <AlertCircle className="w-2.5 h-2.5" /> Needs further review
        </span>
      )}
      {reviewed ? (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-0.5"
          title={my?.note ? `Your review: ${my.note}` : "You reviewed this article"}
        >
          <CheckCircle2 className="w-2.5 h-2.5" /> Reviewed
        </span>
      ) : (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5"
          title="You haven't reviewed this article yet"
        >
          <ClipboardCheck className="w-2.5 h-2.5" /> Needs Review
        </span>
      )}
    </span>
  );
}