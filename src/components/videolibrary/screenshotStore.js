import { useState, useEffect } from "react";

const STORAGE_KEY = "training-screenshots";
const UPDATE_EVENT = "training-screenshots-updated";

// ── Screenshot storage (localStorage) ──

export function loadScreenshots() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveScreenshots(screenshots) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(screenshots));
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  } catch (e) {
    console.error("Failed to save screenshots:", e);
  }
}

export function addScreenshot(dataUrl, label) {
  const screenshots = loadScreenshots();
  const newScreenshot = {
    id: crypto.randomUUID(),
    dataUrl,
    label: label || `Screenshot ${screenshots.length + 1}`,
    timestamp: new Date().toISOString(),
  };
  screenshots.push(newScreenshot);
  saveScreenshots(screenshots);
  return newScreenshot;
}

export function updateScreenshotLabel(id, label) {
  const screenshots = loadScreenshots().map((s) => (s.id === id ? { ...s, label } : s));
  saveScreenshots(screenshots);
}

export function removeScreenshot(id) {
  const screenshots = loadScreenshots().filter((s) => s.id !== id);
  saveScreenshots(screenshots);
}

export function clearScreenshots() {
  saveScreenshots([]);
}

export function subscribeToScreenshots(callback) {
  const handler = () => callback(loadScreenshots());
  window.addEventListener(UPDATE_EVENT, handler);
  return () => window.removeEventListener(UPDATE_EVENT, handler);
}

// ── Capture tool open state (global, in-memory) ──

let captureToolOpen = false;
const openListeners = new Set();

export function setCaptureToolOpen(open) {
  captureToolOpen = open;
  openListeners.forEach((l) => l(captureToolOpen));
}

export function getCaptureToolOpen() {
  return captureToolOpen;
}

export function subscribeCaptureToolOpen(callback) {
  openListeners.add(callback);
  return () => openListeners.delete(callback);
}

// ── Utility ──

export function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ── React hooks ──

export function useScreenshots() {
  const [screenshots, setScreenshots] = useState(loadScreenshots());
  useEffect(() => {
    return subscribeToScreenshots((updated) => setScreenshots(updated));
  }, []);
  return screenshots;
}

export function useCaptureToolOpen() {
  const [open, setOpen] = useState(getCaptureToolOpen());
  useEffect(() => {
    return subscribeCaptureToolOpen(setOpen);
  }, []);
  return open;
}