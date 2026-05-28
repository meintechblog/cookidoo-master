"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SPEECH_CONFIG } from "@/lib/speech-config";

const SPEECH_URL = (SPEECH_CONFIG.url || process.env.NEXT_PUBLIC_SPEECH_URL || "").replace(/\/$/, "");
const STT_LANG = SPEECH_CONFIG.lang || process.env.NEXT_PUBLIC_SPEECH_LANG || "de";
const TTS_VOICE = SPEECH_CONFIG.ttsVoice || process.env.NEXT_PUBLIC_TTS_VOICE || "de_DE-thorsten-medium";

export type VoiceMode = "off" | "tts" | "walkie";

// ── Smart-Filter: strip noise that doesn't belong in audio ──────────────────
//
// • Code blocks → "Code-Block. Anzeigen im Browser."
// • URLs → "Link"
// • Long > 500 chars → truncate after first paragraph
//
// Goal: keep prose / answers, drop visual-only content.
export function filterForTTS(raw: string): string {
  let text = raw.trim();

  // strip fenced code blocks
  text = text.replace(/```[\s\S]*?```/g, " Code-Block, im Browser anschauen. ");

  // inline code → just keep content without backticks
  text = text.replace(/`([^`]+)`/g, "$1");

  // markdown links: [label](url) → label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // bare URLs → "Link"
  text = text.replace(/https?:\/\/\S+/g, "Link");

  // markdown emphasis: **bold** / *italic* / __bold__
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");

  // headings: # foo → foo
  text = text.replace(/^#{1,6}\s+/gm, "");

  // bullets: -, *, + → just text
  text = text.replace(/^[\s]*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");

  // tables → drop entirely (pipes are visual)
  text = text
    .split("\n")
    .filter(line => !/^\s*\|.*\|\s*$/.test(line))
    .join("\n");

  // collapse whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  // hard cap: first 500 chars + first paragraph
  if (text.length > 500) {
    const firstPara = text.split(/\n\n/)[0];
    if (firstPara.length < text.length) {
      text = firstPara + " Volltext im Browser anschauen.";
    } else {
      text = text.slice(0, 500) + "… Volltext im Browser anschauen.";
    }
  }
  return text;
}

// ── STT / TTS HTTP calls ────────────────────────────────────────────────────

async function postTranscribe(blob: Blob, signal?: AbortSignal): Promise<string> {
  if (!SPEECH_URL) throw new Error("NEXT_PUBLIC_SPEECH_URL not set");
  const fd = new FormData();
  fd.append("audio", blob, "recording.webm");
  fd.append("language", STT_LANG);
  const res = await fetch(`${SPEECH_URL}/transcribe`, {
    method: "POST",
    body: fd,
    signal,
  });
  if (!res.ok) throw new Error(`transcribe failed: ${res.status}`);
  const data = await res.json();
  return (data.text || "").trim();
}

async function postSynthesize(text: string): Promise<Blob> {
  if (!SPEECH_URL) throw new Error("NEXT_PUBLIC_SPEECH_URL not set");
  const res = await fetch(`${SPEECH_URL}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: TTS_VOICE }),
  });
  if (!res.ok) throw new Error(`synthesize failed: ${res.status}`);
  return res.blob();
}

// ── useVoice hook: returns recording state + handlers ──────────────────────

export function useVoice() {
  // Walkie-only: hardcoded, no mode-switching UI.
  const mode: VoiceMode = "walkie";
  const setMode = (_: VoiceMode) => {}; // no-op kept for API compat
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const sttAbortRef = useRef<AbortController | null>(null);

  // iOS Safari blocks audio.play() unless it's been "unlocked" inside a user-gesture.
  // Using the Web AudioContext API: once resume() runs inside a gesture, subsequent
  // buffer-source playbacks work for the rest of the session — even when triggered
  // by SSE events that have no direct user gesture behind them.
  const unlockAudio = useCallback(() => {
    if (audioCtxRef.current) {
      // already created — just make sure it's running
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      return;
    }
    try {
      type WindowWithWebkitAudio = Window & typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      };
      const w = window as WindowWithWebkitAudio;
      const AudioCtx = window.AudioContext || w.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      // resume + play one silent buffer to fully prime iOS
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const silent = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
  }, []);

  const startRecording = useCallback(async () => {
    if (recording) return;
    setError(null);
    if (!SPEECH_URL) {
      setError("Speech-Service nicht konfiguriert");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (e: unknown) {
      setError(`Mic-Zugriff verweigert: ${(e as Error).message}`);
    }
  }, [recording]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recording || !recorderRef.current) return null;
    return new Promise((resolve) => {
      const rec = recorderRef.current!;
      rec.addEventListener(
        "stop",
        async () => {
          setRecording(false);
          if (chunksRef.current.length === 0) {
            resolve(null);
            return;
          }
          setTranscribing(true);
          const ac = new AbortController();
          sttAbortRef.current = ac;
          try {
            const blob = new Blob(chunksRef.current, { type: "audio/webm" });
            const text = await postTranscribe(blob, ac.signal);
            resolve(text);
          } catch (e: unknown) {
            const err = e as Error;
            if (err.name === "AbortError") {
              // user cancelled — silent
              resolve(null);
            } else {
              setError(`STT-Fehler: ${err.message}`);
              resolve(null);
            }
          } finally {
            sttAbortRef.current = null;
            setTranscribing(false);
          }
        },
        { once: true },
      );
      rec.stop();
    });
  }, [recording]);

  const cancelRecording = useCallback(() => {
    if (!recording || !recorderRef.current) return;
    try {
      recorderRef.current.stop();
    } catch {}
    chunksRef.current = [];
    setRecording(false);
  }, [recording]);

  // Abort an in-flight STT request (the audio is recorded but not yet sent off / not yet returned).
  const cancelTranscribing = useCallback(() => {
    if (sttAbortRef.current) {
      sttAbortRef.current.abort();
      sttAbortRef.current = null;
    }
    setTranscribing(false);
  }, []);

  const speakText = useCallback(async (rawText: string) => {
    if (!SPEECH_URL) return;
    const filtered = filterForTTS(rawText);
    if (!filtered) return;
    // Stop any currently-playing source first
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch {}
      audioSourceRef.current = null;
    }
    let ctx = audioCtxRef.current;
    if (!ctx) {
      // No prior user gesture → can't play audio. Skip silently (the bubble is still visible).
      return;
    }
    try {
      const blob = await postSynthesize(filtered);
      const arrayBuf = await blob.arrayBuffer();
      // Decode + queue. iOS Safari needs decodeAudioData via callback form for old versions.
      const audioBuf = await new Promise<AudioBuffer>((resolve, reject) => {
        ctx!.decodeAudioData(arrayBuf.slice(0), resolve, reject);
      });
      const source = ctx.createBufferSource();
      source.buffer = audioBuf;
      source.connect(ctx.destination);
      source.onended = () => {
        if (audioSourceRef.current === source) {
          audioSourceRef.current = null;
          setSpeaking(false);
        }
      };
      audioSourceRef.current = source;
      setSpeaking(true);
      source.start(0);
    } catch (e: unknown) {
      // Suppress NotAllowedError / autoplay errors — these are expected on iOS before unlock.
      // The user still sees the message bubble; they just don't hear it.
      const msg = (e as Error).message || "";
      if (!/not allowed|NotAllowed|user gesture|autoplay/i.test(msg)) {
        setError(`TTS-Fehler: ${msg}`);
      }
      setSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch {}
      audioSourceRef.current = null;
    }
    setSpeaking(false);
  }, []);

  return {
    mode,
    setMode,
    recording,
    transcribing,
    speaking,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    cancelTranscribing,
    speakText,
    stopSpeaking,
    unlockAudio,
    available: !!SPEECH_URL,
  };
}

// ── UI Component: Mic-Button + Mode-Toggle ────────────────────────────────

type ControlsProps = {
  voice: ReturnType<typeof useVoice>;
  onTranscript: (text: string, autoSend: boolean) => void;
  show: boolean; // only render when SSE is connected (no point recording into a dead pipe)
};

export function VoiceControls({ voice, onTranscript, show }: ControlsProps) {
  if (!voice.available || !show) return null;

  const handleMicClick = async () => {
    voice.unlockAudio();
    if (voice.speaking) {
      voice.stopSpeaking();
      return;
    }
    if (voice.transcribing) {
      // Abort the in-flight STT call — used when the user mis-spoke and wants to bail.
      voice.cancelTranscribing();
      return;
    }
    if (voice.recording) {
      const text = await voice.stopRecording();
      if (text) onTranscript(text, true);
    } else {
      voice.startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleMicClick}
        aria-label={
          voice.recording ? "Aufnahme stoppen"
          : voice.transcribing ? "Transkription abbrechen"
          : voice.speaking ? "Wiedergabe stoppen"
          : "Walkie-Aufnahme starten"
        }
        className={
          "w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition shadow-sm " +
          (voice.recording
            ? "bg-red-500 hover:bg-red-600 animate-pulse ring-4 ring-red-200"
            : voice.transcribing
            ? "bg-purple-500 hover:bg-purple-600"
            : voice.speaking
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-purple-600 hover:bg-purple-700 text-white")
        }
        title={
          voice.recording ? "Reden, nochmal tippen → geht sofort raus"
          : voice.transcribing ? "Tippen zum Abbrechen"
          : voice.speaking ? "Wiedergabe stoppen"
          : "Walkie: tippen, reden, nochmal tippen"
        }
      >
        {voice.transcribing ? (
          // Spinner around a centered stop-square → tap to abort the in-flight STT
          <span className="relative inline-flex items-center justify-center w-11 h-11">
            <svg className="absolute inset-0 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
              <path d="M22.5 12a10.5 10.5 0 0 1-10.5 10.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <svg className="relative" width={16} height={16} viewBox="0 0 16 16" fill="white">
              <rect width="16" height="16" rx="2.5" />
            </svg>
          </span>
        ) : voice.recording ? (
          <svg width={18} height={18} viewBox="0 0 14 14" fill="white">
            <rect width="14" height="14" rx="2" />
          </svg>
        ) : voice.speaking ? (
          <svg width={18} height={18} viewBox="0 0 14 14" fill="white">
            <rect width="14" height="14" rx="2" />
          </svg>
        ) : (
          <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm5 10a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
