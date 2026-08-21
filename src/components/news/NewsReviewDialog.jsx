import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ClipboardCheck } from "lucide-react";
import { getMyReview } from "./newsReview";

// Per-user review dialog: write a note and determine whether the article needs
// more reviews or should be tagged as a high alert.
// props: open, onOpenChange, item (FirmNews), currentUser ({ id, full_name }), onSave (async ({ note, needs_more_reviews, flagged_high_alert }) => {})
export default function NewsReviewDialog({ open, onOpenChange, item, currentUser, onSave }) {
  const myReview = getMyReview(item, currentUser?.id);
  const [note, setNote] = useState("");
  const [needsMore, setNeedsMore] = useState(false);
  const [flagHigh, setFlagHigh] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNote(myReview?.note || "");
      setNeedsMore(!!myReview?.needs_more_reviews);
      setFlagHigh(!!myReview?.flagged_high_alert);
    }
    // re-initialize each time the dialog opens (item / user may change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, currentUser?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ note, needs_more_reviews: needsMore, flagged_high_alert: flagHigh });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-indigo-500" />
            {myReview ? "Edit Your Review" : "Review Article"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-800 line-clamp-2">{item?.headline}</p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Review note</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-24 text-sm"
              placeholder="Add your review notes..."
              autoFocus
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={needsMore}
                onChange={(e) => setNeedsMore(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span>
                <span className="font-medium">Needs more reviews</span>
                <span className="block text-xs text-gray-400">Flag this article as still needing review by others.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={flagHigh}
                onChange={(e) => setFlagHigh(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              />
              <span>
                <span className="font-medium">Tag as High Alert</span>
                <span className="block text-xs text-gray-400">Sets this article's alert level to High.</span>
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
            {myReview ? "Update Review" : "Save Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}