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

async function postTranscribe(blob: Blob): Promise<string> {
  if (!SPEECH_URL) throw new Error("NEXT_PUBLIC_SPEECH_URL not set");
  const fd = new FormData();
  fd.append("audio", blob, "recording.webm");
  fd.append("language", STT_LANG);
  const res = await fetch(`${SPEECH_URL}/transcribe`, {
    method: "POST",
    body: fd,
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  // iOS Safari blocks audio.play() unless it's been "unlocked" inside a user-gesture handler.
  // We call this from the mic-button click, which IS a user gesture — that's enough to bless
  // subsequent (server-driven, SSE-triggered) audio playback for the rest of the session.
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const audio = new Audio(
        // 1-frame silent WAV (RIFF, mono, 8kHz, 0 samples)
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
      );
      audio.muted = true;
      audio
        .play()
        .then(() => {
          audio.pause();
          audioUnlockedRef.current = true;
        })
        .catch(() => {
          // best-effort: even a failed play() within the gesture still primes the context
          audioUnlockedRef.current = true;
        });
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
          try {
            const blob = new Blob(chunksRef.current, { type: "audio/webm" });
            const text = await postTranscribe(blob);
            resolve(text);
          } catch (e: unknown) {
            setError(`STT-Fehler: ${(e as Error).message}`);
            resolve(null);
          } finally {
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

  const speakText = useCallback(async (rawText: string) => {
    if (!SPEECH_URL) return;
    const filtered = filterForTTS(rawText);
    if (!filtered) return;
    try {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setSpeaking(true);
      const blob = await postSynthesize(filtered);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      await audio.play();
    } catch (e: unknown) {
      setError(`TTS-Fehler: ${(e as Error).message}`);
      setSpeaking(false);
    }
  }, [mode]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
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
    voice.unlockAudio(); // prime iOS Safari for later TTS playback (no-op after first call)
    if (voice.recording) {
      const text = await voice.stopRecording();
      if (text) onTranscript(text, true); // walkie = always auto-send
    } else {
      voice.startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {voice.speaking && (
        <button
          type="button"
          onClick={voice.stopSpeaking}
          className="px-3 py-1.5 text-xs rounded-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition"
          title="TTS-Wiedergabe stoppen"
        >
          ⏹ stop
        </button>
      )}
      <button
        type="button"
        onClick={handleMicClick}
        disabled={voice.transcribing}
        aria-label={voice.recording ? "Aufnahme stoppen" : "Walkie-Aufnahme starten"}
        className={
          "w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition shadow-sm " +
          (voice.recording
            ? "bg-red-500 hover:bg-red-600 animate-pulse ring-4 ring-red-200"
            : voice.transcribing
            ? "bg-purple-400 cursor-wait"
            : "bg-purple-600 hover:bg-purple-700 text-white")
        }
        title={
          voice.recording
            ? "Reden, nochmal tippen → geht sofort raus"
            : voice.transcribing
            ? "Wird transkribiert…"
            : "Walkie: tippen, reden, nochmal tippen"
        }
      >
        {voice.transcribing ? (
          // Rotating spinner shown while STT processes the recording
          <svg className="animate-spin text-white" width={26} height={26} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : voice.recording ? (
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
