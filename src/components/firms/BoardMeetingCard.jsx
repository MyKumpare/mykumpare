import React, { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, MapPin, Video, Users, FileText, ScrollText, AlertTriangle,
  CheckCircle2, Loader2, ExternalLink, Flag, Trash2, FileDown, ListTodo, Tag,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { generateBoardMeetingPdf } from "./boardMeetingPdf";
import TagMentionedFirmDialog from "./TagMentionedFirmDialog";

const FORMAT_LABEL = { "in-person": "In-Person", virtual: "Virtual", hybrid: "Hybrid", unknown: "—" };
const SESSION_LABEL = { public_meeting: "Public Meeting", closed_session: "Closed Session", unknown: "—" };

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Single board meeting card: shows all scraped fields, a "Get Minutes" action
// that scrapes the minutes on demand, mention flags, and a review toggle.
export default function BoardMeetingCard({ meeting, firmId, onFirmClick }) {
  const queryClient = useQueryClient();
  const [fetchingMinutes, setFetchingMinutes] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reviewNotes, setReviewNotes] = useState(meeting.review_notes || "");
  const [savingReview, setSavingReview] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [showTagFirm, setShowTagFirm] = useState(false);
  const [showMentions, setShowMentions] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["board-meetings", firmId] });

  // Fetch the action items (FollowUpTask records) extracted from this meeting
  // so the user can see them directly in the card after running "Extract Actions".
  const { data: actionItems = [] } = useQuery({
    queryKey: ["board-meeting-action-items", meeting.id],
    queryFn: () => base44.entities.FollowUpTask.filter({ board_meeting_id: meeting.id }, "-created_date", 100),
    enabled: !!meeting.id,
  });

  const handleGetMinutes = async () => {
    setFetchingMinutes(true);
    try {
      const res = await base44.functions.invoke("scrapeBoardMeetingMinutes", { meeting_id: meeting.id });
      const data = res?.data ?? res ?? {};
      if (!data.found && !data.minutes_content) {
        toast({ title: "Minutes not available", description: data.notes || "Could not retrieve minutes from the source URL.", variant: "destructive" });
      } else {
        await base44.entities.BoardMeeting.update(meeting.id, { minutes_content: data.minutes_content || "" });
        invalidate();
        toast({ title: "Minutes retrieved", description: data.notes || undefined });
      }
    } catch (err) {
      toast({ title: "Failed to get minutes", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setFetchingMinutes(false);
    }
  };

  const handleMarkReviewed = async () => {
    setSavingReview(true);
    try {
      await base44.entities.BoardMeeting.update(meeting.id, { reviewed: true, review_notes: reviewNotes });
      invalidate();
      toast({ title: "Marked as reviewed" });
    } catch (err) {
      toast({ title: "Failed to save", description: err?.message, variant: "destructive" });
    } finally {
      setSavingReview(false);
    }
  };

  const handleDelete = async () => {
    try {
      await base44.entities.BoardMeeting.update(meeting.id, { deleted_at: new Date().toISOString() });
      invalidate();
      toast({ title: "Meeting removed" });
    } catch (err) {
      toast({ title: "Failed to remove", description: err?.message, variant: "destructive" });
    }
  };

  const needsReview = meeting.needs_review && !meeting.reviewed;

  const handleExtractActionItems = async () => {
    setExtracting(true);
    try {
      const res = await base44.functions.invoke("extractBoardMeetingActionItems", { meeting_id: meeting.id });
      const data = res?.data ?? res ?? {};
      invalidate();
      const created = data.tasks_created ?? 0;
      const high = data.high_priority ?? 0;
      if (created === 0) {
        toast({ title: "No action items found", description: "The meeting notes didn't contain extractable action items." });
      } else {
        toast({ title: `${created} action item${created === 1 ? "" : "s"} extracted`, description: high ? `${high} flagged as high-priority. See them below.` : "See them below in this card." });
      }
    } catch (err) {
      toast({ title: "Extraction failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className={`rounded-lg border p-3 ${needsReview ? "border-amber-300 bg-amber-50/40" : "border-gray-200 bg-white"}`}>
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 truncate">{meeting.title || "Untitled board meeting"}</span>
            <Badge variant="outline" className={`text-[10px] ${meeting.status === "upcoming" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
              {meeting.status === "upcoming" ? "Upcoming" : "Completed"}
            </Badge>
            {needsReview && (
              <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200">
                <Flag className="w-3 h-3 mr-0.5" /> Needs Review
              </Badge>
            )}
            {meeting.reviewed && (
              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Reviewed
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(meeting.meeting_date)}{meeting.end_date ? ` – ${fmtDate(meeting.end_date)}` : ""}</span>
            {meeting.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {meeting.location}</span>}
            <span className="flex items-center gap-1">
              {meeting.meeting_format === "virtual" ? <Video className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              {FORMAT_LABEL[meeting.meeting_format] || "—"}
            </span>
            <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {SESSION_LABEL[meeting.session_type] || "—"}</span>
          </div>
        </div>
        <button type="button" onClick={handleDelete} className="text-gray-300 hover:text-red-500" title="Remove meeting">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Topics */}
      {meeting.meeting_topics?.length > 0 && (
        <div className="mt-2 flex items-start gap-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase w-14 pt-0.5 flex-shrink-0">Topics</span>
          <div className="flex flex-wrap gap-1">
            {meeting.meeting_topics.map((t, i) => (
              <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Mentions — toggleable panel triggered by the icon in the actions row */}

      {/* Links + actions */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {meeting.source_url && (
          <a href={meeting.source_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Source
          </a>
        )}
        {meeting.agenda_url && (
          <a href={meeting.agenda_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1">
            <FileText className="w-3 h-3" /> Agenda
          </a>
        )}
        {meeting.minutes_url && (
          <a href={meeting.minutes_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1">
            <ScrollText className="w-3 h-3" /> Minutes link
          </a>
        )}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleGetMinutes} disabled={fetchingMinutes}>
          {fetchingMinutes ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScrollText className="w-3 h-3" />}
          {meeting.minutes_content ? "Re-fetch Minutes" : "Get Minutes"}
        </Button>
        {meeting.minutes_content && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-[11px] text-gray-500 hover:text-gray-700">
            {expanded ? "Hide minutes" : "View minutes"}
          </button>
        )}
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => generateBoardMeetingPdf(meeting)}>
          <FileDown className="w-3 h-3" /> PDF Summary
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleExtractActionItems} disabled={extracting || !meeting.minutes_content}>
          {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListTodo className="w-3 h-3" />}
          {meeting.action_items_extracted ? "Re-extract Actions" : "Extract Actions"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowTagFirm(true)}>
          <Tag className="w-3 h-3" /> Tag Firm
        </Button>
        {meeting.mentions?.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`h-7 text-xs gap-1 ${showMentions ? "bg-amber-50 border-amber-300 text-amber-700" : ""}`}
            onClick={() => setShowMentions((v) => !v)}
            title="View firms mentioned in this meeting"
          >
            <Users className="w-3 h-3" /> Mentioned Firms
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-semibold">
              {meeting.mentions.length}
            </span>
          </Button>
        )}
      </div>

      {/* Mentioned firms panel — firms with an entity_id are hyperlinks to that firm */}
      {meeting.mentions?.length > 0 && showMentions && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Firms mentioned in this meeting
          </div>
          <ul className="space-y-1">
            {meeting.mentions.map((mt) => {
              const inSystem = !!mt.entity_id && onFirmClick;
              return (
                <li key={mt.id} className="text-[11px] text-amber-800 flex items-start gap-1">
                  {inSystem ? (
                    <button
                      type="button"
                      onClick={() => onFirmClick({ id: mt.entity_id, name: mt.entity_name })}
                      className="font-medium text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      {mt.entity_name}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  ) : (
                    <span className="font-medium">{mt.entity_name}</span>
                  )}
                  {mt.context && <span className="text-amber-700">— {mt.context}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Tag mentioned firm dialog */}
      <TagMentionedFirmDialog
        open={showTagFirm}
        onClose={() => setShowTagFirm(false)}
        meeting={meeting}
        onTagged={invalidate}
      />

      {/* Extracted action items */}
      {actionItems.length > 0 && (
        <div className="mt-2 rounded-md border border-indigo-200 bg-indigo-50/40 p-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800 mb-1.5">
            <ListTodo className="w-3.5 h-3.5" />
            Extracted Action Items ({actionItems.length})
          </div>
          <ul className="space-y-1">
            {actionItems.map((item) => (
              <li key={item.id} className="text-[11px] text-gray-700 flex items-start gap-1.5">
                <span className={`mt-0.5 flex-shrink-0 ${item.is_high_priority ? "text-red-500" : "text-gray-400"}`}>
                  {item.is_high_priority ? <Flag className="w-3 h-3" /> : <span className="w-3 h-3 inline-block rounded-full border border-gray-300" />}
                </span>
                <span className="flex-1">
                  <span dangerouslySetInnerHTML={{ __html: item.task_description || "Untitled task" }} />
                  {item.due_date && <span className="text-gray-500 ml-1">— due {fmtDate(item.due_date)}</span>}
                  {item.assigned_to_contact_name && <span className="text-gray-500 ml-1">— {item.assigned_to_contact_name}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Minutes content */}
      {meeting.minutes_content && expanded && (
        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2 max-h-60 overflow-y-auto">
          <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans">{meeting.minutes_content}</pre>
        </div>
      )}

      {/* Review notes (for flagged meetings) */}
      {needsReview && (
        <div className="mt-2 rounded-md border border-amber-200 bg-white p-2">
          <textarea
            placeholder="Add review notes…"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded p-1.5 min-h-[40px] resize-y"
          />
          <div className="flex justify-end mt-1">
            <Button type="button" size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={handleMarkReviewed} disabled={savingReview}>
              {savingReview ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Mark Reviewed
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}