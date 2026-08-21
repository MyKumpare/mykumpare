import React from "react";
import { AlertTriangle, Eye } from "lucide-react";

// Prominent visual status badges for news items so users can instantly spot
// high-priority articles and items that still need review.
//
// "High Priority" = alert_status is High.
// "Needs Review"  = High or Medium alert AND no notes AND no content tags
//                   (i.e. it's been flagged as impactful but not yet looked at).
//
// props: item (a FirmNews record)
export default function NewsStatusBadges({ item }) {
  const isHighPriority = item.alert_status === "High";
  const needsReview =
    (item.alert_status === "High" || item.alert_status === "Medium") &&
    !item.notes &&
    !(item.content_tags && item.content_tags.length);

  if (!isHighPriority && !needsReview) return null;

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {isHighPriority && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white shadow-sm">
          <AlertTriangle className="w-2.5 h-2.5" /> HIGH PRIORITY
        </span>
      )}
      {needsReview && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 shadow-sm">
          <Eye className="w-2.5 h-2.5" /> NEEDS REVIEW
        </span>
      )}
    </div>
  );
}