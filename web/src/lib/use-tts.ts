"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Thin React wrapper over the browser's `window.speechSynthesis`. We use it
 * for in-place reading of saved memos and buddy memos — fully on-device, no
 * server cost. Falls back gracefully when the API isn't available (older
 * browsers, some PWA contexts).
 *
 * Voice preference is sticky in `localStorage` ("wn:ttsVoiceURI") and
 * speed in "wn:ttsRate" so a user's tweaks survive page reloads.
 */

const VOICE_KEY = "wn:ttsVoiceURI";
const RATE_KEY = "wn:ttsRate";

const PREFERRED_LANG = ["ko-KR", "ko"];

export interface TtsHandle {
  /** True when the SpeechSynthesis API is available. */
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  voices: SpeechSynthesisVoice[];
  voice: SpeechSynthesisVoice | null;
  rate: number;
  setVoiceURI: (uri: string | null) => void;
  setRate: (rate: number) => void;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useTts(): TtsHandle {
  const supported =
    typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState<string | null>(null);
  const [rate, setRateState] = useState<number>(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  // Track the live utterance so we never overlap speeches.
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Voices load asynchronously on Chrome; subscribe to `voiceschanged`.
  useEffect(() => {
    if (!supported) return;
    const syn = window.speechSynthesis;
    const load = () => setVoices(syn.getVoices());
    load();
    syn.addEventListener?.("voiceschanged", load);
    return () => syn.removeEventListener?.("voiceschanged", load);
  }, [supported]);

  // Restore persisted preferences.
  useEffect(() => {
    if (!supported) return;
    try {
      const v = window.localStorage.getItem(VOICE_KEY);
      if (v) setVoiceURIState(v);
      const r = window.localStorage.getItem(RATE_KEY);
      if (r) {
        const n = Number(r);
        if (Number.isFinite(n) && n >= 0.5 && n <= 2) setRateState(n);
      }
    } catch {
      /* ignore */
    }
  }, [supported]);

  // Pick the active voice: stored URI if it still exists, else the first
  // Korean voice, else the first available.
  const voice = useMemo<SpeechSynthesisVoice | null>(() => {
    if (voices.length === 0) return null;
    if (voiceURI) {
      const v = voices.find((x) => x.voiceURI === voiceURI);
      if (v) return v;
    }
    for (const lang of PREFERRED_LANG) {
      const v = voices.find((x) => x.lang === lang);
      if (v) return v;
    }
    return voices[0];
  }, [voices, voiceURI]);

  const setVoiceURI = useCallback((uri: string | null) => {
    setVoiceURIState(uri);
    try {
      if (uri === null) window.localStorage.removeItem(VOICE_KEY);
      else window.localStorage.setItem(VOICE_KEY, uri);
    } catch {
      /* ignore */
    }
  }, []);

  const setRate = useCallback((next: number) => {
    const clamped = Math.max(0.5, Math.min(2, next));
    setRateState(clamped);
    try {
      window.localStorage.setItem(RATE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    utterRef.current = null;
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      const syn = window.speechSynthesis;
      // Cancel any in-flight utterance so we never overlap.
      syn.cancel();
      const u = new SpeechSynthesisUtterance(trimmed);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = "ko-KR";
      }
      u.rate = rate;
      u.pitch = 1;
      u.onstart = () => {
        setSpeaking(true);
        setPaused(false);
      };
      u.onend = () => {
        if (utterRef.current === u) {
          utterRef.current = null;
          setSpeaking(false);
          setPaused(false);
        }
      };
      u.onerror = () => {
        if (utterRef.current === u) {
          utterRef.current = null;
          setSpeaking(false);
          setPaused(false);
        }
      };
      u.onpause = () => setPaused(true);
      u.onresume = () => setPaused(false);
      utterRef.current = u;
      syn.speak(u);
    },
    [supported, voice, rate],
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported]);

  // Stop speech on unmount so navigating away never strands a TTS session.
  useEffect(() => {
    return () => {
      if (!supported) return;
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [supported]);

  return {
    supported,
    speaking,
    paused,
    voices,
    voice,
    rate,
    setVoiceURI,
    setRate,
    speak,
    pause,
    resume,
    stop,
  };
}
