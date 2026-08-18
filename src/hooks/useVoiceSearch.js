import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useVoiceSearch — thin wrapper around the browser Web Speech API
 * (SpeechRecognition / webkitSpeechRecognition). Returns a `listening`
 * flag plus `start`/`stop` controls and a `supported` flag. The latest
 * `onResult` callback is invoked with the final transcript; `onError`
 * is invoked with the error code when recognition fails.
 */
export function useVoiceSearch({ onResult, onError, lang = "en-US" } = {}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef(null);
  const cbRef = useRef(onResult);
  const errRef = useRef(onError);

  useEffect(() => { cbRef.current = onResult; });
  useEffect(() => { errRef.current = onError; });

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = (e.results?.[0]?.[0]?.transcript || "").trim();
      if (transcript && cbRef.current) cbRef.current(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (ev) => {
      setListening(false);
      if (errRef.current) errRef.current(ev?.error || "unknown");
    };
    recRef.current = rec;
    return () => { try { recRef.current?.abort(); } catch {} recRef.current = null; };
  }, [lang]);

  const start = useCallback(() => {
    if (!recRef.current) return false;
    try {
      recRef.current.start();
      setListening(true);
      return true;
    } catch {
      // Recognition was already started/starting — restart cleanly.
      try { recRef.current.abort(); } catch {}
      try { recRef.current.start(); setListening(true); return true; } catch { return false; }
    }
  }, []);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}