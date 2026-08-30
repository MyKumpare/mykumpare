import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, BookOpen, Loader2, Download, AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateTrainingManualPdf } from "./trainingManualPdf";

function isYouTubeUrl(url) {
  return /youtube\.com|youtu\.be/.test(url || "");
}

function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Extracts evenly-spaced frames from a video file using a hidden <video> element
 * and canvas capture. Returns array of { dataUrl, timestamp, index }.
 */
async function extractFrames(videoUrl, frameCount, onProgress) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;

    const frames = [];

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!duration || !isFinite(duration)) {
        reject(new Error("Could not determine video duration. The video may be invalid or inaccessible."));
        return;
      }

      try {
        for (let i = 0; i < frameCount; i++) {
          const timestamp = (duration / (frameCount + 1)) * (i + 1);

          // Seek to timestamp and wait for the frame to be ready
          await new Promise((resolveSeek) => {
            const handler = () => {
              video.removeEventListener("seeked", handler);
              resolveSeek();
            };
            video.addEventListener("seeked", handler);
            video.currentTime = timestamp;
          });

          // Allow the browser to paint the frame
          await new Promise((r) => requestAnimationFrame(() => r()));
          await new Promise((r) => setTimeout(r, 80));

          if (!video.videoWidth || !video.videoHeight) {
            reject(new Error("Video frame was not ready for capture."));
            return;
          }

          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");

          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            frames.push({ dataUrl, timestamp, index: i });
            if (onProgress) onProgress(i + 1, frameCount);
          } catch {
            reject(new Error("Could not capture video frames — the video may have cross-origin restrictions. Please use a directly uploaded video file."));
            return;
          }
        }

        resolve(frames);
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () => {
      reject(new Error("Could not load the video for frame extraction. If this is a YouTube link, only directly uploaded video files are supported."));
    };

    video.src = videoUrl;
  });
}

export default function TrainingManualDialog({ video, onClose }) {
  const [step, setStep] = useState("config"); // config | extracting | analyzing | preview | error
  const [frameCount, setFrameCount] = useState(8);
  const [progress, setProgress] = useState(0);
  const [frames, setFrames] = useState([]);
  const [manual, setManual] = useState(null);
  const [error, setError] = useState(null);

  if (!video) return null;

  const youTube = isYouTubeUrl(video.video_url);

  const handleGenerate = async () => {
    try {
      setError(null);
      setStep("extracting");
      setProgress(0);

      // 1. Extract frames from the video
      const extracted = await extractFrames(video.video_url, frameCount, (done, total) => {
        setProgress(Math.round((done / total) * 100));
      });
      setFrames(extracted);

      // 2. Upload frames so the LLM can see them
      setStep("analyzing");
      const frameUrls = [];
      for (const frame of extracted) {
        const blob = dataUrlToBlob(frame.dataUrl);
        const file = new File([blob], `frame-${frame.index}.jpg`, { type: "image/jpeg" });
        const result = await base44.integrations.Core.UploadFile({ file });
        frameUrls.push(result.file_url);
      }

      // 3. Ask the LLM to build a structured training manual
      const timestampList = extracted
        .map((f, i) => `Screenshot ${i}: ${formatTimestamp(f.timestamp)}`)
        .join("\n");

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are creating a step-by-step training manual from ${extracted.length} screenshots of a software application training video titled "${video.title}".
${video.description ? `Video description: ${video.description}` : ""}

The screenshots were captured at these timestamps in the video:
${timestampList}

Analyze each screenshot and create a clear, numbered training manual with:
- A concise, descriptive title for the manual
- A brief 1-2 sentence introduction
- Numbered steps, each with a short step title, the screenshot index (0-based) that best illustrates this step, and detailed, actionable instructions describing what the user should do

You may combine or skip screenshots if the same action spans multiple frames. Make instructions specific enough that someone could follow them without watching the video. Reference UI elements you can see (buttons, menus, fields) by their visible labels.`,
        file_urls: frameUrls,
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

      setManual(response);
      setStep("preview");
    } catch (err) {
      console.error("Training manual generation failed:", err);
      setError(err?.message || "Failed to generate the training manual. Please try again.");
      setStep("error");
    }
  };

  const handleDownload = () => {
    if (!manual) return;
    generateTrainingManualPdf(manual, frames.map((f) => f.dataUrl), video.title);
  };

  const handleReset = () => {
    setStep("config");
    setFrames([]);
    setManual(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-gray-800">Convert to Training Manual</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Video info */}
          <div className="flex items-start gap-3 mb-5 p-3 bg-gray-50 rounded-lg">
            {video.thumbnail_url ? (
              <img src={video.thumbnail_url} alt="" className="w-20 h-14 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-20 h-14 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-emerald-400" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{video.title}</p>
              {video.description && <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{video.description}</p>}
            </div>
          </div>

          {/* ── Config step ── */}
          {step === "config" && (
            <div className="space-y-4">
              {youTube && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    This is a YouTube video. Frame extraction requires a directly uploaded video file. Please re-upload the video as a file to generate a training manual.
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Number of screenshots to capture
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  The video will be sampled at even intervals. More screenshots capture more detail but take longer to process.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[4, 6, 8, 10, 12, 15].map((n) => (
                    <button
                      key={n}
                      onClick={() => setFrameCount(n)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        frameCount === n
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <BookOpen className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <p className="text-xs text-emerald-800">
                  The AI will analyze each screenshot and write step-by-step instructions, then generate a downloadable PDF with the screenshots and text.
                </p>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={youTube}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <BookOpen className="w-4 h-4" />
                Generate Training Manual
              </Button>
            </div>
          )}

          {/* ── Extracting step ── */}
          {step === "extracting" && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <div>
                <p className="text-sm font-medium text-gray-700">Extracting screenshots from video…</p>
                <p className="text-xs text-gray-500 mt-1">Capturing {frameCount} frames at even intervals</p>
              </div>
              <div className="max-w-xs mx-auto">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">{progress}%</p>
              </div>
            </div>
          )}

          {/* ── Analyzing step ── */}
          {step === "analyzing" && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <div>
                <p className="text-sm font-medium text-gray-700">AI is analyzing screenshots…</p>
                <p className="text-xs text-gray-500 mt-1">
                  Writing step-by-step instructions from {frames.length} captured frames
                </p>
              </div>
              {/* Show frame thumbnails */}
              <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
                {frames.map((f) => (
                  <img
                    key={f.index}
                    src={f.dataUrl}
                    alt={`Frame ${f.index}`}
                    className="w-14 h-10 rounded object-cover border border-gray-200"
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Preview step ── */}
          {step === "preview" && manual && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-gray-800">{manual.title}</h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="w-3.5 h-3.5" /> Start Over
                  </Button>
                  <Button size="sm" onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </Button>
                </div>
              </div>

              {manual.intro && (
                <p className="text-sm text-gray-600 italic">{manual.intro}</p>
              )}

              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {(manual.steps || []).map((s, i) => {
                  const idx = Math.max(0, Math.min(frames.length - 1, s.screenshot_index ?? 0));
                  const frame = frames[idx];
                  return (
                    <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {s.step_number}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-800">{s.title}</h4>
                      </div>
                      {frame && (
                        <img src={frame.dataUrl} alt={`Step ${s.step_number}`} className="w-full max-h-64 object-contain bg-gray-50" />
                      )}
                      <p className="text-sm text-gray-600 px-4 py-3 leading-relaxed">{s.instructions}</p>
                    </div>
                  );
                })}
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
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
                </Button>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}