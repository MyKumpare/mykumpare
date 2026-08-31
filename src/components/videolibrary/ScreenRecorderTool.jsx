import React, { useState, useEffect, useRef } from "react";
import { Circle, Square, X, AlertCircle } from "lucide-react";
import { setIsRecording } from "./recorderStore";
import RecordingSaveDialog from "./RecordingSaveDialog";

/**
 * Global screen recording tool — a floating button visible on every page
 * that lets the user start/stop a screen recording from anywhere in the app.
 * When recording stops, a save dialog opens to name, tag, and optionally
 * generate an AI-narrated training video from the recording.
 */
export default function ScreenRecorderTool() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Sync recording state with the global store so the header button can
  // reflect whether a recording is in progress.
  useEffect(() => {
    setIsRecording(recording);
  }, [recording]);

  // Listen for trigger events from the header "Record" button.
  useEffect(() => {
    const handler = () => {
      if (!recording) startRecording();
    };
    window.addEventListener("mk-start-recording", handler);
    return () => window.removeEventListener("mk-start-recording", handler);
  }, [recording]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];

      // Pick the best supported mime type
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(
        (t) => MediaRecorder.isTypeSupported(t)
      ) || "video/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          setRecordedBlob(blob);
          setShowSaveDialog(true);
        }
        setRecording(false);
        setElapsed(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };

      // Handle the user stopping via the browser's native "Stop sharing" bar.
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      };

      mediaRecorder.start(1000);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        setError(err.message || "Failed to start recording.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* Floating record button / recording indicator — visible on every page */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2">
        {recording ? (
          <div className="flex items-center gap-2 bg-red-600 text-white pl-3 pr-1.5 py-1.5 rounded-full shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-mono font-semibold tabular-nums">{formatTime(elapsed)}</span>
            <button
              onClick={stopRecording}
              className="ml-1 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              title="Stop recording"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={startRecording}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg flex items-center justify-center transition-colors group"
            title="Start screen recording"
          >
            <Circle className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      {/* Save dialog */}
      {showSaveDialog && recordedBlob && (
        <RecordingSaveDialog
          blob={recordedBlob}
          onClose={() => {
            setShowSaveDialog(false);
            setRecordedBlob(null);
          }}
        />
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-24 right-4 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg shadow-lg text-sm flex items-center gap-2 max-w-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-1 text-red-400 hover:text-red-600 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}