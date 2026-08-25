import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, FileDown, Sparkles, Building, CheckCircle2, AlertCircle, RefreshCw,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { generateBoardMeetingPdf } from "./boardMeetingPdf";

// Simple case-insensitive firm name matcher — returns system firms whose
// names match any of the AI-detected firm names from the minutes.
function matchDetectedFirms(detectedNames, allFirms, excludeFirmId) {
  if (!detectedNames?.length || !allFirms?.length) return [];
  const normalized = detectedNames.map((n) => n.toLowerCase().trim()).filter(Boolean);
  const seen = new Set();
  const matches = [];
  for (const firm of allFirms) {
    if (firm.deleted_at || firm.id === excludeFirmId) continue;
    const fname = (firm.name || "").toLowerCase().trim();
    if (!fname) continue;
    const isMatch = normalized.some(
      (n) => fname === n || fname.includes(n) || n.includes(fname)
    );
    if (isMatch && !seen.has(firm.id)) {
      seen.add(firm.id);
      matches.push(firm);
    }
  }
  return matches;
}

// Dialog that generates an AI executive summary of the board meeting minutes,
// auto-tags mentioned firms, and lets the user download a PDF summary.
export default function BoardMeetingPdfSummaryDialog({ open, onClose, meeting, onTagged }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [detectedFirmNames, setDetectedFirmNames] = useState([]);
  const [autoTagging, setAutoTagging] = useState(false);
  const [autoTaggedIds, setAutoTaggedIds] = useState([]);

  const { data: allFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-name", 5000),
    enabled: open,
  });

  // Reset state when dialog opens for a new meeting
  useEffect(() => {
    if (open) {
      setSummary(null);
      setDetectedFirmNames([]);
      setAutoTaggedIds([]);
    }
  }, [open, meeting?.id]);

  // Generate the executive summary via AI when the dialog opens
  useEffect(() => {
    if (open && meeting?.minutes_content && !summary && !loading) {
      generateSummary();
    }
  }, [open, meeting?.id, meeting?.minutes_content]);

  const generateSummary = async () => {
    if (!meeting?.minutes_content) {
      toast({
        title: "No minutes available",
        description: "Fetch the meeting minutes first to generate a PDF summary.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setSummary(null);
    setDetectedFirmNames([]);
    setAutoTaggedIds([]);
    try {
      const prompt = `You are a financial analyst reviewing board meeting minutes for an investment firm. 
Generate a structured executive summary of the following board meeting minutes.

Meeting Title: ${meeting.title || "Untitled"}
Meeting Date: ${meeting.meeting_date || "Unknown"}
Firm: ${meeting.firm_name || "Unknown"}

Minutes Content:
${meeting.minutes_content}

Return a JSON object with these fields:
- "discussions": A concise summary of the key topics and discussions (2-4 sentences as a single string).
- "decisions": An array of strings, each describing a decision made during the meeting.
- "tabled_items": An array of strings, each describing an item that was tabled, postponed, or deferred.
- "future_agenda": An array of strings, each describing an item scheduled for a future meeting.
- "mentioned_firms": An array of firm/company/organization names (strings) mentioned in the minutes. Only include actual firm or organization names, not government bodies or individuals. Exclude the host firm "${meeting.firm_name || ""}".

If a category has no items, return an empty array. Be specific and factual.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            discussions: { type: "string" },
            decisions: { type: "array", items: { type: "string" } },
            tabled_items: { type: "array", items: { type: "string" } },
            future_agenda: { type: "array", items: { type: "string" } },
            mentioned_firms: { type: "array", items: { type: "string" } },
          },
        },
      });

      setSummary(res);
      setDetectedFirmNames(res.mentioned_firms || []);

      // Auto-tag matched firms automatically
      const matched = matchDetectedFirms(res.mentioned_firms || [], allFirms, meeting.firm_id);
      if (matched.length > 0) {
        await autoTagFirms(matched);
      }
    } catch (err) {
      toast({
        title: "Failed to generate summary",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-tag firms: add each matched firm to the meeting's mentions array
  const autoTagFirms = async (firmsToTag) => {
    if (!firmsToTag?.length || !meeting) return;
    setAutoTagging(true);
    try {
      const existingMentions = meeting.mentions || [];
      const existingIds = new Set(existingMentions.map((m) => m.entity_id).filter(Boolean));
      const newMentions = firmsToTag
        .filter((f) => !existingIds.has(f.id))
        .map((f) => ({
          id: crypto.randomUUID(),
          entity_name: f.name,
          entity_type: "other",
          entity_id: f.id,
          context: "Auto-tagged from meeting minutes",
        }));

      if (newMentions.length === 0) {
        setAutoTaggedIds(firmsToTag.map((f) => f.id));
        return;
      }

      await base44.entities.BoardMeeting.update(meeting.id, {
        mentions: [...existingMentions, ...newMentions],
        needs_review: true,
      });
      setAutoTaggedIds(firmsToTag.map((f) => f.id));
      onTagged?.();
      queryClient.invalidateQueries({ queryKey: ["board-meetings", meeting.firm_id] });
      toast({
        title: `${newMentions.length} firm${newMentions.length === 1 ? "" : "s"} auto-tagged`,
        description: "Mentioned firms were added to this meeting.",
      });
    } catch (err) {
      toast({
        title: "Auto-tagging failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAutoTagging(false);
    }
  };

  const matchedFirms = useMemo(
    () => matchDetectedFirms(detectedFirmNames, allFirms, meeting?.firm_id),
    [detectedFirmNames, allFirms, meeting?.firm_id]
  );

  const handleDownloadPdf = () => {
    generateBoardMeetingPdf(meeting, {
      summary,
      detectedFirmNames,
      matchedFirms,
    });
  };

  const handleClose = () => {
    setSummary(null);
    setDetectedFirmNames([]);
    setAutoTaggedIds([]);
    onClose();
  };

  const hasMinutes = !!meeting?.minutes_content;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileDown className="w-4 h-4 text-indigo-600" />
            PDF Summary — {meeting?.title || "Board Meeting"}
          </DialogTitle>
        </DialogHeader>

        {!hasMinutes ? (
          <div className="py-8 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 font-medium">No minutes available</p>
            <p className="text-xs text-gray-500 mt-1">
              Use "Get Minutes" on the meeting card first to fetch the minutes content, then generate the PDF summary.
            </p>
          </div>
        ) : loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-600 font-medium">Generating executive summary…</p>
            <p className="text-xs text-gray-500 mt-1">Analyzing meeting minutes with AI</p>
          </div>
        ) : summary ? (
          <div className="space-y-4 py-1">
            {/* Discussions */}
            <SummarySection title="Discussions" items={[summary.discussions]} type="text" />

            {/* Decisions */}
            <SummarySection title="Decisions Made" items={summary.decisions} type="list" />

            {/* Tabled Items */}
            <SummarySection title="Items Tabled" items={summary.tabled_items} type="list" />

            {/* Future Agenda */}
            <SummarySection title="Future Agenda" items={summary.future_agenda} type="list" />

            {/* Impacted / Mentioned Firms */}
            <div className="rounded-md border border-indigo-200 bg-indigo-50/40 p-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-indigo-800 mb-2">
                <Building className="w-4 h-4" />
                Impacted / Mentioned Firms
                {autoTagging && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
              </div>
              {detectedFirmNames.length === 0 ? (
                <p className="text-xs text-gray-500">No firms were detected in the meeting minutes.</p>
              ) : (
                <div className="space-y-1.5">
                  {detectedFirmNames.map((name, i) => {
                    const matched = matchedFirms.find(
                      (f) => (f.name || "").toLowerCase() === name.toLowerCase() ||
                      (f.name || "").toLowerCase().includes(name.toLowerCase()) ||
                      name.toLowerCase().includes((f.name || "").toLowerCase())
                    );
                    const isTagged = matched && autoTaggedIds.includes(matched.id);
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {isTagged ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        ) : matched ? (
                          <Building className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 flex-shrink-0 rounded-full border border-gray-300" />
                        )}
                        <span className="text-gray-700">{name}</span>
                        {matched && (
                          <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200 ml-1">
                            In System
                          </Badge>
                        )}
                        {isTagged && (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 ml-1">
                            Auto-Tagged
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                  {matchedFirms.length > 0 && (
                    <p className="text-[11px] text-gray-500 pt-1">
                      {autoTaggedIds.length > 0
                        ? `${autoTaggedIds.length} matching firm${autoTaggedIds.length === 1 ? "" : "s"} in your system were auto-tagged.`
                        : "Matching firms in your system will be auto-tagged."}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Regenerate button */}
            <div className="flex justify-start">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={generateSummary}
                disabled={loading}
              >
                <RefreshCw className="w-3 h-3" /> Regenerate Summary
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <Button
            onClick={handleDownloadPdf}
            disabled={!hasMinutes || loading || !summary}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            <FileDown className="w-4 h-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummarySection({ title, items, type }) {
  const hasContent = type === "text" ? !!items?.[0] : items?.length > 0;
  if (!hasContent) return null;
  return (
    <div>
      <div className="text-sm font-semibold text-gray-800 mb-1">{title}</div>
      {type === "text" ? (
        <p className="text-xs text-gray-600 leading-relaxed">{items[0]}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
              <span className="text-indigo-400 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}