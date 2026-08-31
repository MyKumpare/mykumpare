import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Loader2, Download, AlertCircle, BookOpen, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateTrainingManualPdf } from "./trainingManualPdf";
import { useScreenshots, dataUrlToBlob, setCaptureToolOpen } from "./screenshotStore";

/**
 * ScriptToManualDialog — automatically converts an AI-generated video script
 * into a step-by-step training manual PDF using captured app screenshots.
 *
 * Props:
 *   open — boolean
 *   onClose — () => void
 *   script — compiled script text from the Video Creation Assistant conversation
 */
export default function ScriptToManualDialog({ open, onClose, script }) {
  const screenshots = useScreenshots();
  const [step, setStep] = useState("idle"); // idle | converting | preview | error
  const [manual, setManual] = useState(null);
  const [error, setError] = useState(null);
  const startedRef = useRef(false);

  const handleConvert = async () => {
    try {
      setStep("converting");
      setError(null);

      // Upload screenshots so the LLM can see them
      const screenshotUrls = [];
      for (const s of screenshots) {
        const blob = dataUrlToBlob(s.dataUrl);
        const file = new File([blob], `screenshot-${s.id}.jpg`, { type: "image/jpeg" });
        const result = await base44.integrations.Core.UploadFile({ file });
        screenshotUrls.push(result.file_url);
      }

      // Create a structured training manual from the script + screenshots
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are creating a step-by-step training manual from a video script. I have provided ${screenshots.length} screenshots of the application that were captured to illustrate the steps.

Analyze the script and the screenshots, and create a structured training manual with:
- A concise, descriptive title
- A brief 1-2 sentence introduction
- Numbered steps, each with:
  - A short step title
  - The screenshot index (0-based, from 0 to ${screenshots.length - 1}) that best illustrates this step
  - Detailed, actionable instructions describing what the user should do at that step

Match each step to the most relevant screenshot by examining what is visible in each screenshot. If there are more steps than screenshots, reuse screenshots as needed. Make instructions specific enough that someone could follow them without the video.

Script:
${script}

Return as JSON.`,
        file_urls: screenshotUrls,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            intro: { type: "string" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  step_number: { type: "integer" },
                  title: { type: "string" },
                  screenshot_index: { type: "integer" },
                  instructions: { type: "string" },
                },
                required: ["step_number", "title", "screenshot_index", "instructions"],
              },
            },
          },
          required: ["title", "intro", "steps"],
        },
      });

      setManual(result);
      setStep("preview");
    } catch (err) {
      console.error("Manual creation failed:", err);
      setError(err?.message || "Failed to create training manual.");
      setStep("error");
    }
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("idle");
      setManual(null);
      setError(null);
      startedRef.current = false;
    }
  }, [open]);

  // Auto-start conversion when screenshots and script are available
  useEffect(() => {
    if (open && !startedRef.current && screenshots.length > 0 && script?.trim()) {
      startedRef.current = true;
      handleConvert();
    }
  }, [open, screenshots.length, script]);

  if (!open) return null;

  const handleDownload = () => {
    if (!manual) return;
    generateTrainingManualPdf(manual, screenshots.map((s) => s.dataUrl), manual.title);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-gray-800">Training Manual from Script</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* No screenshots */}
          {screenshots.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                <Camera className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">No screenshots captured yet</p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Capture screenshots of the app first, then generate a training manual with them.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" onClick={() => setCaptureToolOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Camera className="w-3.5 h-3.5" /> Open Capture Tool
                </Button>
                <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              </div>
            </div>
          ) : step === "idle" ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-sm text-gray-600">
                {screenshots.length} screenshot(s) ready. Click below to generate a training manual from the script.
              </p>
              <Button onClick={handleConvert} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <BookOpen className="w-4 h-4" /> Generate Training Manual
              </Button>
            </div>
          ) : step === "converting" ? (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <div>
                <p className="text-sm font-medium text-gray-700">Creating training manual…</p>
                <p className="text-xs text-gray-500 mt-1">
                  AI is analyzing {screenshots.length} screenshots and writing step-by-step instructions
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
                {screenshots.map((s) => (
                  <img key={s.id} src={s.dataUrl} alt={s.label} className="w-14 h-10 rounded object-cover border border-gray-200" />
                ))}
              </div>
            </div>
          ) : step === "preview" && manual ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-gray-800">{manual.title}</h3>
                <Button size="sm" onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </Button>
              </div>
              {manual.intro && <p className="text-sm text-gray-600 italic">{manual.intro}</p>}
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {(manual.steps || []).map((s, i) => {
                  const idx = Math.max(0, Math.min(screenshots.length - 1, s.screenshot_index ?? 0));
                  const screenshot = screenshots[idx];
                  return (
                    <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {s.step_number}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-800">{s.title}</h4>
                      </div>
                      {screenshot && (
                        <img src={screenshot.dataUrl} alt={`Step ${s.step_number}`} className="w-full max-h-64 object-contain bg-gray-50" />
                      )}
                      <p className="text-sm text-gray-600 px-4 py-3 leading-relaxed">{s.instructions}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : step === "error" ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Something went wrong</p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleConvert}>Try Again</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}