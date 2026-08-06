import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, History, User } from "lucide-react";
import { format } from "date-fns";

/**
 * Displays a timeline of note version history for a single due diligence stage.
 *
 * Props:
 *   open: boolean
 *   onOpenChange: (boolean) => void
 *   dueDiligenceId: string
 *   stageId: string
 *   stageName: string
 */
export default function StageNotesHistoryDialog({
  open, onOpenChange, dueDiligenceId, stageId, stageName,
}) {
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["dd-stage-note-versions", dueDiligenceId, stageId],
    queryFn: () => base44.entities.DdStageNoteVersion.filter(
      { due_diligence_id: dueDiligenceId, stage_id: stageId },
      "-edited_date",
      100
    ),
    enabled: !!open && !!dueDiligenceId && !!stageId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4 text-indigo-600" />
            Notes History
            {stageName && <span className="text-gray-400 font-normal">— {stageName}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400 italic">
              No edit history yet. Versions are recorded when you save the due diligence record.
            </div>
          ) : (
            versions.map((v, i) => (
              <div
                key={v.id}
                className="rounded-lg border border-gray-200 bg-gray-50/50 overflow-hidden"
              >
                {/* Version header */}
                <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold">
                      {versions.length - i}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-gray-700">
                      <User className="w-3 h-3 text-gray-400" />
                      {v.edited_by_name || "Unknown"}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Clock className="w-3 h-3" />
                    {v.edited_date ? format(new Date(v.edited_date), "MMM d, yyyy 'at' h:mm a") : ""}
                  </span>
                </div>
                {/* Version content */}
                <div
                  className="px-3 py-2 text-sm text-gray-700 quill-preview max-h-48 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: v.notes_content || "<p class='text-gray-400 italic'>(empty)</p>" }}
                />
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}