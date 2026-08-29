import React, { useState, useMemo } from "react";
import { MessageSquare, Send, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Stage Comments Dialog — lets team members discuss feedback on a specific
 * due diligence stage directly from the kanban board.
 *
 * Props:
 *   open, onOpenChange
 *   record — the DueDiligence record
 *   stageIndex — index of the stage being commented on
 *   onSave — async callback(updatedStages) that persists the record
 */
export default function StageCommentsDialog({ open, onOpenChange, record, stageIndex, onSave }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const stage = useMemo(() => record?.stages?.[stageIndex], [record, stageIndex]);
  const comments = useMemo(() => stage?.comments || [], [stage]);

  const handleAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed || !record || !stage) return;
    setSaving(true);
    try {
      const newComment = {
        id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        author_id: user?.id || "",
        author_name: user?.full_name || user?.data?.full_name || "Unknown",
        text: trimmed,
        timestamp: new Date().toISOString(),
      };
      const updatedStages = (record.stages || []).map((s, i) =>
        i === stageIndex ? { ...s, comments: [...(s.comments || []), newComment] } : s
      );
      await onSave?.(updatedStages);
      setText("");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            Stage Discussion
          </DialogTitle>
        </DialogHeader>

        {stage && (
          <div className="space-y-3">
            {/* Stage label */}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">{stage.name || "Unnamed Stage"}</span>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-gray-500 truncate">{record?.firm_name || "—"}</span>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-gray-500 truncate">{record?.product_name || "—"}</span>
            </div>

            {/* Comments list */}
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {comments.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6">
                  No comments yet. Start the discussion below.
                </p>
              ) : (
                comments.map((c) => {
                  let timeLabel = "";
                  try {
                    timeLabel = formatDistanceToNow(parseISO(c.timestamp), { addSuffix: true });
                  } catch { /* ignore */ }
                  return (
                    <div key={c.id} className="flex gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {(c.author_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-gray-700">{c.author_name || "Unknown"}</span>
                          <span className="text-[10px] text-gray-400">{timeLabel}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap break-words">{c.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add comment */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your comment... (Cmd/Ctrl+Enter to send)"
                className="text-sm min-h-[60px] resize-none"
                disabled={saving}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">{comments.length} comment{comments.length !== 1 ? "s" : ""}</span>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={saving || !text.trim()}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Post
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}