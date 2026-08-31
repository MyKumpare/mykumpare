// Global state for the screen recorder tool. Keeps track of whether a
// recording is in progress so the header button can reflect state, and
// provides a trigger function the header button calls to start recording
// from anywhere in the app.

let isRecording = false;
const listeners = new Set();

export function getIsRecording() {
  return isRecording;
}

export function setIsRecording(val) {
  isRecording = val;
  listeners.forEach((l) => l(isRecording));
}

export function subscribeRecording(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The header button dispatches a custom event; the global ScreenRecorderTool
// listens for it and starts recording. This avoids prop-drilling through the
// router and works from any page.
export function triggerStartRecording() {
  window.dispatchEvent(new CustomEvent("mk-start-recording"));
}

import { useState, useEffect } from "react";

export function useIsRecording() {
  const [recording, setRecording] = useState(isRecording);
  useEffect(() => {
    const unsub = subscribeRecording(setRecording);
    return unsub;
  }, []);
  return recording;
}