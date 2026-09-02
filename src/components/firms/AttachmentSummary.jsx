import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown, ChevronUp, Loader2, Copy, FileText, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

const STAGES = [
  "Reading document…",
  "Extracting key points…",
  "Identifying action items…",
  "Finalizing summary…",
];

// Generates and displays an AI summary of a document attached to an onsite visit.
// The summary is stored on the attachment object (att.summary) so it persists on save.
export default function AttachmentSummary({ attachment, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [done, setDone] = useState(false);
  const timersRef = useRef([]);

  // Drive the animated progress bar + stage labels while loading.
  useEffect(() => {
    if (!loading) return;
    setProgress(0);
    setStageIdx(0);
    setDone(false);
    timersRef.current.forEach(clearInterval);
    timersRef.current = [];

    // Stage label rotation — cycles through the status messages.
    const stageTimer = setInterval(() => {
      setStageIdx((i) => (i < STAGES.length - 1 ? i + 1 : i));
    }, 3500);
    timersRef.current.push(stageTimer);

    // Progress bar — eases toward 90% so it never completes before the real call returns.
    const progTimer = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, (90 - p) * 0.08) : p));
    }, 400);
    timersRef.current.push(progTimer);

    return () => {
      timersRef.current.forEach(clearInterval);
      timersRef.current = [];
    };
  }, [loading]);

  const generate = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          "You are an investment due diligence analyst. Read the attached document and produce a concise summary with key takeaways relevant to an onsite due diligence visit. " +
          "Structure your response as: 1) A 2-3 sentence overview, 2) 'Key Takeaways:' as a bulleted list of 3-7 concrete points (strategy, risk, performance, team, operations, or compliance insights), " +
          "3) 'Action Items / Follow-ups:' as a bulleted list of any items the diligence team should follow up on. Keep it under 300 words total.",
        file_urls: [attachment.file_url],
        response_json_schema: {
          type: "object",
          properties: {
            overview: { type: "string" },
            key_takeaways: { type: "array", items: { type: "string" } },
            action_items: { type: "array", items: { type: "string" } },
          },
          required: ["overview", "key_takeaways", "action_items"],
        },
      });
      const data = res?.data || res;
      const summary = {
        overview: data.overview || "",
        key_takeaways: data.key_takeaways || [],
        action_items: data.action_items || [],
        generated_at: new Date().toISOString(),
      };
      onUpdate(attachment.id, { summary });
      setProgress(100);
      setStageIdx(STAGES.length - 1);
      setDone(true);
      toast({ title: "Summary generated" });
    } catch (e) {
      toast({ title: "Could not summarize document", description: e?.message || "Try again later.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copySummary = () => {
    const s = attachment.summary;
    const text = [
      s.overview,
      "",
      "Key Takeaways:",
      ...s.key_takeaways.map((t) => `• ${t}`),
      "",
      "Action Items / Follow-ups:",
      ...s.action_items.map((t) => `• ${t}`),
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Summary copied" });
  };

  const hasSummary = !!attachment.summary;

  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-indigo-600 hover:text-indigo-700"
          onClick={hasSummary ? () => setOpen((o) => !o) : generate}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? "Summarizing…" : hasSummary ? (open ? "Hide Summary" : "View Summary") : "Generate Summary"}
        </Button>
        {hasSummary && !loading && (
          <>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="p-0.5 text-gray-400 hover:text-gray-600"
              title={open ? "Collapse" : "Expand"}
            >
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={copySummary}
              className="p-0.5 text-gray-400 hover:text-gray-600"
              title="Copy summary"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {open && loading && (
        <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-xs space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-700 font-medium">
            <FileText className="w-3.5 h-3.5 animate-pulse" />
            <span>{STAGES[stageIdx]}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-indigo-500">
            <span className="flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Analyzing document…
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      )}

      {open && done && !loading && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Analysis complete
        </div>
      )}

      {open && hasSummary && !loading && (
        <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-xs space-y-2">
          {attachment.summary.overview && (
            <p className="text-gray-700 leading-relaxed">{attachment.summary.overview}</p>
          )}
          {attachment.summary.key_takeaways?.length > 0 && (
            <div>
              <p className="font-semibold text-gray-800 mb-1">Key Takeaways</p>
              <ul className="space-y-1">
                {attachment.summary.key_takeaways.map((t, i) => (
                  <li key={i} className="flex gap-1.5 text-gray-700">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {attachment.summary.action_items?.length > 0 && (
            <div>
              <p className="font-semibold text-gray-800 mb-1">Action Items / Follow-ups</p>
              <ul className="space-y-1">
                {attachment.summary.action_items.map((t, i) => (
                  <li key={i} className="flex gap-1.5 text-gray-700">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] text-gray-400 pt-1">
            Generated {attachment.summary.generated_at ? new Date(attachment.summary.generated_at).toLocaleString() : ""}
          </p>
        </div>
      )}
    </div>
  );
}