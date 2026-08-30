import React, { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { X, FileText, Loader2, Download, AlertCircle, Upload, Film, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSlideshowVideo } from "./manualToVideo";

export default function ManualToVideoDialog({ open, onClose }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState("select"); // select | uploading | analyzing | generating_audio | rendering | preview | error
  const [selectedFile, setSelectedFile] = useState(null);
  const [script, setScript] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [savedToLibrary, setSavedToLibrary] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setStep("select");
      setSelectedFile(null);
      setScript(null);
      setVideoUrl(null);
      setProgress(0);
      setError(null);
      setSavedToLibrary(false);
    }
  }, [open]);

  if (!open) return null;

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;
    try {
      setError(null);
      setSavedToLibrary(false);

      // 1. Upload the training manual
      setStep("uploading");
      const fileResult = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const fileUrl = fileResult.file_url;

      // 2. Analyze the document and create a video script
      setStep("analyzing");
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are creating a video script from a training manual document. Analyze the document and create a structured script for a narrated slideshow training video.

Create:
- A concise, descriptive video title
- A brief intro narration (1-2 sentences, spoken at the start to introduce the topic)
- 5-8 scenes, each with:
  - A slide title (short, 3-6 words, displayed on screen)
  - Narration text (2-4 sentences, what the voiceover says for this scene — must flow naturally when read aloud)
  - 2-4 bullet points (concise key points displayed on screen, each under 12 words)

The narration across all scenes should flow as a continuous training guide. Keep the total narration under 4500 characters. Focus on actionable, step-by-step instructions.

Return the result as JSON.`,
        file_urls: [fileUrl],
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            intro: { type: "string" },
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  narration: { type: "string" },
                  bullets: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["title", "narration", "bullets"],
              },
            },
          },
          required: ["title", "intro", "scenes"],
        },
      });

      setScript(result);

      // 3. Generate narration audio
      setStep("generating_audio");
      const fullNarration = [result.intro, ...(result.scenes || []).map((s) => s.narration)].join(" ");
      const speechResult = await base44.integrations.Core.GenerateSpeech({
        text: fullNarration.slice(0, 5000),
        voice: "river",
      });

      // 4. Create the slideshow video
      setStep("rendering");
      setProgress(0);
      const allSlides = [
        { title: result.title, narration: result.intro, bullets: [], isIntro: true },
        ...(result.scenes || []).map((s) => ({ ...s, isIntro: false })),
      ];

      const videoBlob = await createSlideshowVideo(allSlides, speechResult.url, (current, total) => {
        setProgress(Math.round((current / total) * 100));
      });

      // 5. Upload the generated video
      const safeName = (result.title || "training-video").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const videoFile = new File([videoBlob], `${safeName}.webm`, { type: "video/webm" });
      const videoResult = await base44.integrations.Core.UploadFile({ file: videoFile });
      setVideoUrl(videoResult.file_url);

      setStep("preview");
    } catch (err) {
      console.error("Manual to video conversion failed:", err);
      setError(err?.message || "Failed to convert the training manual to video.");
      setStep("error");
    }
  };

  const handleSaveToLibrary = async () => {
    try {
      if (!script || !videoUrl) return;
      let userName = "Unknown";
      try {
        const user = await base44.auth.me();
        userName = user?.full_name || "Unknown";
      } catch {}
      await base44.entities.VideoLibraryItem.create({
        title: script.title,
        description: script.intro,
        video_url: videoUrl,
        category: "Training",
        uploaded_by_name: userName,
      });
      await queryClient.invalidateQueries({ queryKey: ["video_library_items"] });
      setSavedToLibrary(true);
    } catch (err) {
      setError("Failed to save to library: " + (err?.message || "Unknown error"));
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `${(script?.title || "training-video").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const stepLabels = {
    uploading: "Uploading training manual…",
    analyzing: "AI is analyzing the document and writing a script…",
    generating_audio: "Generating voiceover narration…",
    rendering: `Recording video… ${progress}%`,
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-800">Convert Manual to Video</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* ── Select step ── */}
          {step === "select" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <p className="text-xs text-indigo-800">
                  Upload a training manual (PDF, Word, or text). The AI will analyze it, write a narration script, generate a voiceover, and produce a narrated slideshow video.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.rtf"
                className="hidden"
                onChange={handleFileSelect}
              />

              {selectedFile ? (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl py-10 flex flex-col items-center gap-3 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
                >
                  <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Click to select a training manual</p>
                    <p className="text-xs text-gray-500 mt-0.5">PDF, Word, or text file</p>
                  </div>
                </button>
              )}

              <Button
                onClick={handleConvert}
                disabled={!selectedFile}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Film className="w-4 h-4" />
                Convert to Video
              </Button>
            </div>
          )}

          {/* ── Processing steps ── */}
          {["uploading", "analyzing", "generating_audio", "rendering"].includes(step) && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <div>
                <p className="text-sm font-medium text-gray-700">{stepLabels[step]}</p>
                {step === "rendering" && (
                  <div className="max-w-xs mx-auto mt-3">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Preview step ── */}
          {step === "preview" && videoUrl && (
            <div className="space-y-4">
              {script && (
                <>
                  <h3 className="text-lg font-bold text-gray-800">{script.title}</h3>
                  {script.intro && <p className="text-sm text-gray-600 italic">{script.intro}</p>}
                </>
              )}

              <div className="rounded-lg overflow-hidden bg-black">
                <video src={videoUrl} controls className="w-full" />
              </div>

              {savedToLibrary && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-xs text-green-800">Saved to the Video Library.</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" /> Download
                </Button>
                {!savedToLibrary && (
                  <Button size="sm" onClick={handleSaveToLibrary} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Film className="w-3.5 h-3.5" /> Save to Library
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setStep("select"); setSelectedFile(null); setScript(null); setVideoUrl(null); setSavedToLibrary(false); }}>
                  <RotateCcw className="w-3.5 h-3.5" /> Start Over
                </Button>
              </div>
            </div>
          )}

          {/* ── Error step ── */}
          {step === "error" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Something went wrong</p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep("select")}>
                <RotateCcw className="w-3.5 h-3.5" /> Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}