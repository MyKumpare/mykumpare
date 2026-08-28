import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, FileText, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

/**
 * MeetingSummaryPanel
 * Lets the user generate an AI summary of the firm's meeting notes (from
 * Meeting-type activity logs) and save it directly to the firm profile.
 *
 * Props:
 *  - firmId: string
 *  - firmName: string
 *  - activities: pre-filtered activity list for this firm (from FirmActivityLogTab)
 */
export default function MeetingSummaryPanel({ firmId, firmName, activities = [] }) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Fetch the firm record so we can display the stored summary + timestamp
  const { data: firm, isLoading } = useQuery({
    queryKey: ["firm_meeting_summary", firmId],
    queryFn: () => base44.entities.Firm.get(firmId),
    enabled: !!firmId,
  });

  const meetingActivities = activities.filter(a => a.activity_type === "Meeting" && a.notes && a.notes.trim());

  const handleGenerate = async () => {
    if (meetingActivities.length === 0) {
      setError("No meeting notes found for this firm. Log a meeting activity with notes first.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Build a consolidated transcript of meeting notes, newest first
      const notesBlock = meetingActivities
        .slice()
        .sort((a, b) => (b.activity_date || "").localeCompare(a.activity_date || ""))
        .map((a, idx) => {
          const date = a.activity_date || "No date";
          const subject = a.subjects && a.subjects.length ? a.subjects.join(", ") : a.subject || "Meeting";
          const contact = a.contact_name || "Unknown contact";
          return `Meeting ${idx + 1} — ${date} (${subject}, with ${contact}):\n${a.notes.trim()}`;
        })
        .join("\n\n---\n\n");

      const prompt = `You are an investment analyst assistant. Below are the meeting notes logged for the firm "${firmName}". Summarize them into a concise, professional meeting recap that a relationship team can quickly scan on the firm profile.

Include:
- Key topics discussed across meetings
- Any commitments, follow-ups, or action items mentioned
- Sentiment / relationship status signals
- Notable changes or developments over time

Write in clear, structured prose (short paragraphs or bullet points). Do not invent information not present in the notes. If the notes are sparse, say so briefly.

MEETING NOTES:
${notesBlock}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "gemini_3_flash",
      });

      const summary = typeof result === "string" ? result : result?.response || result?.text || JSON.stringify(result);

      await base44.entities.Firm.update(firmId, {
        meeting_summary: summary,
        meeting_summary_generated_at: new Date().toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ["firm_meeting_summary", firmId] });
      queryClient.invalidateQueries({ queryKey: ["firm_detail", firmId] });
    } catch (err) {
      console.error("Meeting summary generation failed:", err);
      setError(err?.message || "Failed to generate summary. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const storedSummary = firm?.meeting_summary;
  const generatedAt = firm?.meeting_summary_generated_at;

  const fmtTimestamp = (ts) => {
    if (!ts) return null;
    try {
      return new Date(ts).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
      });
    } catch { return ts; }
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Meeting Summary</h4>
            <p className="text-[11px] text-gray-500">
              {meetingActivities.length} meeting{meetingActivities.length !== 1 ? "s" : ""} with notes available
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          onClick={handleGenerate}
          disabled={isGenerating || meetingActivities.length === 0}
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Generating…
            </>
          ) : storedSummary ? (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Generate Summary
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && !storedSummary && (
        <div className="text-xs text-gray-400 italic py-2">Loading saved summary…</div>
      )}

      {storedSummary && (
        <div className="space-y-1.5">
          {generatedAt && (
            <p className="text-[11px] text-gray-400 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Generated {fmtTimestamp(generatedAt)}
            </p>
          )}
          <div className={`text-xs text-gray-700 leading-relaxed whitespace-pre-wrap ${!expanded ? "line-clamp-4" : ""}`}>
            {storedSummary}
          </div>
          {storedSummary.length > 280 && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
            >
              {expanded ? <>Show less <ChevronUp className="w-3 h-3" /></> : <>Show more <ChevronDown className="w-3 h-3" /></>}
            </button>
          )}
        </div>
      )}

      {!storedSummary && !isLoading && !error && meetingActivities.length === 0 && (
        <div className="text-xs text-gray-400 italic py-1">
          No meeting notes yet — log a meeting activity with notes to generate a summary.
        </div>
      )}
    </div>
  );
}