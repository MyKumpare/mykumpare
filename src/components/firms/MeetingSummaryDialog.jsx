import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Sparkles, Save, ClipboardList, Calendar, Building2, ListTodo, Plus, X,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// MeetingSummaryDialog: generates and edits meeting summary notes using the
// BoardMeetingTemplate's agenda sections. AI drafts notes from the meeting
// minutes; the user edits per-section notes, an overall summary, and key
// decisions, then saves. Action items can be extracted from the notes into
// FollowUpTask records via the existing extractor.
export default function MeetingSummaryDialog({ open, onClose, meeting, onSaved }) {
  const queryClient = useQueryClient();
  const [sections, setSections] = useState([]);
  const [summary, setSummary] = useState("");
  const [decisions, setDecisions] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Load existing notes from the meeting record when the dialog opens
  useEffect(() => {
    if (open && meeting) {
      setSections(
        (meeting.agenda_sections || []).map((s) => ({
          id: s.id || crypto.randomUUID(),
          title: s.title || "",
          description: s.description || "",
          notes: s.notes || "",
        }))
      );
      setSummary(meeting.meeting_summary || "");
      setDecisions(Array.isArray(meeting.key_decisions) ? meeting.key_decisions : []);
    }
  }, [open, meeting?.id]);

  const hasMinutes = !!meeting?.minutes_content;
  const hasSections = sections.length > 0;

  const updateSectionNotes = (idx, notes) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, notes } : s)));
  };

  // AI generates structured notes from the meeting minutes, following the
  // template's agenda section structure. Fills in per-section notes, an
  // overall executive summary, and key decisions.
  const generateSummary = async () => {
    if (!hasMinutes && !sections.some((s) => s.notes.trim()) && !summary.trim()) {
      toast({
        title: "Nothing to generate from",
        description: "Fetch meeting minutes or add notes first.",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    try {
      const sectionTitles = sections.map((s) => s.title);
      const existingNotes = sections.map((s) => s.notes);
      const prompt = `You are documenting meeting summary notes for an investment firm's board meeting.

Meeting: ${meeting.title || "Untitled"}
Date: ${meeting.meeting_date || "Unknown"}
Firm: ${meeting.firm_name || "Unknown"}
Topics: ${(meeting.meeting_topics || []).join(", ") || "None specified"}

${hasMinutes ? `Meeting Minutes:\n${meeting.minutes_content}\n` : ""}
${hasSections ? `Agenda sections (generate notes for each):\n${sectionTitles.map((t, i) => `${i + 1}. ${t}${existingNotes[i] ? `\n   Existing notes: ${existingNotes[i]}` : ""}`).join("\n")}\n` : ""}

Generate a structured meeting summary.${hasSections ? " For each agenda section, write 2-4 sentences of notes summarizing what was discussed and decided, based on the meeting minutes." : ""} Also provide an overall executive summary (3-5 sentences) and extract key decisions.

Return a JSON object:
- "section_notes": array of strings, one per agenda section in order. Each string is 2-4 sentences of notes. If no information is available for a section, write "No specific discussion recorded for this section."
- "overall_summary": a concise executive summary (3-5 sentences) of the entire meeting.
- "key_decisions": array of strings, each describing a key decision made during the meeting. Empty array if none identified.

Be factual and specific. Do not invent information not present in the minutes or existing notes.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            section_notes: { type: "array", items: { type: "string" } },
            overall_summary: { type: "string" },
            key_decisions: { type: "array", items: { type: "string" } },
          },
        },
      });

      if (res?.section_notes?.length && hasSections) {
        setSections((prev) =>
          prev.map((s, i) => ({
            ...s,
            notes: res.section_notes[i] || s.notes,
          }))
        );
      }
      if (res?.overall_summary) setSummary(res.overall_summary);
      if (Array.isArray(res?.key_decisions)) setDecisions(res.key_decisions);
      toast({ title: "Summary generated", description: "Review and edit, then save." });
    } catch (err) {
      toast({
        title: "Generation failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Save the per-section notes, overall summary, and key decisions to the meeting
  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.BoardMeeting.update(meeting.id, {
        agenda_sections: sections.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          notes: s.notes,
        })),
        meeting_summary: summary,
        key_decisions: decisions.filter((d) => d.trim()),
      });
      queryClient.invalidateQueries({ queryKey: ["board-meetings", meeting.firm_id] });
      queryClient.invalidateQueries({ queryKey: ["board-meetings-all"] });
      queryClient.invalidateQueries({ queryKey: ["board-meeting-action-items", meeting.id] });
      toast({ title: "Meeting summary saved" });
      onSaved?.();
      onClose();
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Extract action items from the meeting notes/minutes into FollowUpTask records
  const handleExtractActions = async () => {
    setExtracting(true);
    try {
      const res = await base44.functions.invoke("extractBoardMeetingActionItems", { meeting_id: meeting.id });
      const data = res?.data ?? res ?? {};
      queryClient.invalidateQueries({ queryKey: ["board-meeting-action-items", meeting.id] });
      queryClient.invalidateQueries({ queryKey: ["board-meetings", meeting.firm_id] });
      const created = data.tasks_created ?? 0;
      const high = data.high_priority ?? 0;
      if (created === 0) {
        toast({ title: "No action items found", description: "The notes didn't contain extractable action items." });
      } else {
        toast({ title: `${created} action item${created === 1 ? "" : "s"} extracted`, description: high ? `${high} flagged as high-priority.` : undefined });
      }
    } catch (err) {
      toast({ title: "Extraction failed", description: err?.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const addDecision = () => setDecisions((prev) => [...prev, ""]);
  const updateDecision = (idx, val) => setDecisions((prev) => prev.map((d, i) => (i === idx ? val : d)));
  const removeDecision = (idx) => setDecisions((prev) => prev.filter((_, i) => i !== idx));

  const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d + "T00:00:00");
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-cyan-600" />
            Meeting Summary Notes
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
            <span className="font-medium text-gray-700">{meeting?.title}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(meeting?.meeting_date)}</span>
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {meeting?.firm_name}</span>
            {meeting?.applied_template_name && (
              <Badge variant="outline" className="text-[10px]">{meeting.applied_template_name}</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* AI generate bar */}
          <div className="flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50/40 p-2">
            <Button type="button" size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1" onClick={generateSummary} disabled={generating}>
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Generate from {hasMinutes ? "Minutes" : "Notes"}
            </Button>
            <span className="text-xs text-gray-500">
              {hasMinutes ? "AI drafts notes from meeting minutes" : "AI structures your notes"}
            </span>
          </div>

          {/* Agenda section notes (from template) */}
          {hasSections && (
            <div className="space-y-2.5">
              <div className="text-sm font-semibold text-gray-700">Agenda Notes</div>
              {sections.map((s, i) => (
                <div key={s.id} className="rounded-md border border-gray-200 p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-cyan-700">{i + 1}.</span>
                    <span className="text-sm font-medium text-gray-800">{s.title}</span>
                  </div>
                  {s.description && <p className="text-[11px] text-gray-500 mb-1.5">{s.description}</p>}
                  <textarea
                    value={s.notes}
                    onChange={(e) => updateSectionNotes(i, e.target.value)}
                    placeholder="Notes for this section…"
                    className="w-full text-xs border border-gray-200 rounded p-2 min-h-[70px] resize-y focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Overall summary */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-1">Overall Summary</div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Executive summary of the meeting…"
              className="w-full text-sm border border-gray-200 rounded p-2 min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>

          {/* Key decisions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-700">Key Decisions</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addDecision}>
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            {decisions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No key decisions recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {decisions.map((d, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-cyan-500 mt-1.5 text-xs">•</span>
                    <input
                      value={d}
                      onChange={(e) => updateDecision(i, e.target.value)}
                      placeholder="Describe a key decision…"
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                    <button type="button" onClick={() => removeDecision(i)} className="text-gray-300 hover:text-red-500 mt-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Extract action items */}
          <div className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/40 p-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleExtractActions} disabled={extracting}>
              {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListTodo className="w-3 h-3" />}
              Extract Action Items
            </Button>
            <span className="text-xs text-gray-500">Parse minutes/notes into follow-up tasks</span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Summary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}