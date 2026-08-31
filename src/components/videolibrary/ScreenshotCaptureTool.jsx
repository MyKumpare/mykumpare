import React, { useState } from "react";
import html2canvas from "html2canvas";
import { Camera, X, Trash2, Minimize2, Maximize2, Loader2, Images } from "lucide-react";
import {
  useCaptureToolOpen,
  useScreenshots,
  setCaptureToolOpen,
  addScreenshot,
  removeScreenshot,
  updateScreenshotLabel,
  clearScreenshots,
} from "./screenshotStore";

/**
 * ScreenshotCaptureTool — a floating panel that lets users capture
 * snapshots of the running app to use in training manuals.
 * Rendered at the app level so it persists across page navigation.
 */
export default function ScreenshotCaptureTool() {
  const open = useCaptureToolOpen();
  const screenshots = useScreenshots();
  const [minimized, setMinimized] = useState(false);
  const [capturing, setCapturing] = useState(false);

  if (!open) return null;

  const handleCapture = async () => {
    setCapturing(true);
    setMinimized(true);
    try {
      // Allow the minimize to render before capturing
      await new Promise((r) => setTimeout(r, 350));

      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 1.5,
        ignoreElements: (el) => el.id === "screenshot-capture-panel",
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      addScreenshot(dataUrl);
      setMinimized(false);
    } catch (err) {
      console.error("Capture failed:", err);
      setMinimized(false);
    }
    setCapturing(false);
  };

  // ── Minimized pill ──
  if (minimized) {
    return (
      <div
        id="screenshot-capture-panel"
        className="fixed bottom-4 right-4 z-[80] bg-white rounded-full shadow-lg border border-gray-200 flex items-center gap-2 pl-3 pr-2 py-2"
      >
        {capturing ? (
          <>
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            <span className="text-xs font-medium text-gray-600">Capturing…</span>
          </>
        ) : (
          <>
            <Camera className="w-5 h-5 text-indigo-600" />
            <span className="text-xs font-medium text-gray-600">{screenshots.length} captured</span>
            <button
              onClick={() => setMinimized(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Expand"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Expanded panel ──
  return (
    <div
      id="screenshot-capture-panel"
      className="fixed bottom-4 right-4 z-[80] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col max-h-[500px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-800">Screenshot Capture</h3>
          {screenshots.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">
              {screenshots.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 text-gray-400 hover:text-gray-600" title="Minimize">
            <Minimize2 className="w-4 h-4" />
          </button>
          <button onClick={() => setCaptureToolOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Capture button */}
      <div className="p-3 border-b border-gray-100">
        <button
          onClick={handleCapture}
          disabled={capturing}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {capturing ? "Capturing…" : "Capture Screen"}
        </button>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-y-auto p-3">
        {screenshots.length === 0 ? (
          <div className="text-center py-6">
            <Images className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No screenshots yet.</p>
            <p className="text-[10px] text-gray-400 mt-1">Navigate to a screen and click "Capture Screen".</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {screenshots.map((s) => (
              <div key={s.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                <img src={s.dataUrl} alt={s.label} className="w-full h-20 object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <button
                  onClick={() => removeScreenshot(s.id)}
                  className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                  <input
                    type="text"
                    value={s.label}
                    onChange={(e) => updateScreenshotLabel(s.id, e.target.value)}
                    className="w-full bg-transparent text-white text-[10px] outline-none placeholder-white/50"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {screenshots.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{screenshots.length} ready for training manual</span>
          <button
            onClick={() => {
              if (window.confirm("Clear all screenshots?")) clearScreenshots();
            }}
            className="text-[10px] text-red-500 hover:text-red-600 font-medium"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}