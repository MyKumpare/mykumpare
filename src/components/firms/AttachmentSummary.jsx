import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown, ChevronUp, Loader2, Copy } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

// Generates and displays an AI summary of a document attached to an onsite visit.
// The summary is stored on the attachment object (att.summary) so it persists on save.
export default function AttachmentSummary({ attachment, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

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