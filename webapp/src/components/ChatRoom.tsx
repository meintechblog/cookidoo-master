"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat-db";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { useVoice, VoiceControls } from "./VoiceControls";

type Props = { initialBacklog: ChatMessage[] };

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    // @ts-expect-error — react-markdown gives us untyped children
    return extractText(node.props.children);
  }
  return "";
}

function BlockCode({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = extractText(children).replace(/\n$/, "");
  const langMatch = /language-(\w+)/.exec(className || "");
  const lang = langMatch?.[1] || "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden bg-gray-900">
      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 text-[10px] text-gray-400">
        <span>{lang || "code"}</span>
        <button
          onClick={copy}
          className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 transition"
          type="button"
        >
          {copied ? "✓ kopiert" : "kopieren"}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs leading-relaxed">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

function AssistantMarkdown({ body }: { body: string }) {
  return (
    <div className="text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
               className="text-blue-600 underline hover:text-blue-700">
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-5 mb-2 last:mb-0 space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-5 mb-2 last:mb-0 space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1.5">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-2 italic text-gray-700 my-2">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border px-2 py-1 bg-gray-100 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
          hr: () => <hr className="my-3 border-gray-200" />,
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) return <BlockCode className={className}>{children}</BlockCode>;
            return (
              <code className="px-1 py-0.5 rounded bg-gray-100 text-[0.85em] font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

export function ChatRoom({ initialBacklog }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialBacklog);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const voice = useVoice();
  const lastSpokenIdRef = useRef<number>(
    initialBacklog.length ? Math.max(...initialBacklog.map(m => m.id)) : 0,
  );

  const cursorRef = useRef<number>(
    initialBacklog.length ? Math.max(...initialBacklog.map(m => m.id)) : 0,
  );

  const lastMsg = messages[messages.length - 1];
  const awaitingReply = sending || (lastMsg?.role === "user");

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, awaitingReply]);

  // Auto-speak assistant replies (walkie-mode always reads them out)
  useEffect(() => {
    if (!voice.available) return;
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    if (last.id <= lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = last.id;
    voice.speakText(last.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, voice.available]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(`/api/chat/stream?since=${cursorRef.current}`);
      es.addEventListener("hello", () => {
        setConnected(true);
        attempt = 0;
      });
      es.addEventListener("message", (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(ev.data) as ChatMessage;
          if (msg.id > cursorRef.current) cursorRef.current = msg.id;
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
        } catch {}
      });
      const onFailure = () => {
        setConnected(false);
        if (es) {
          try { es.close(); } catch {}
          es = null;
        }
        if (stopped) return;
        attempt = Math.min(attempt + 1, 5);
        const backoff = [1000, 2000, 5000, 10000, 20000, 30000][attempt];
        reconnectTimer = setTimeout(connect, backoff);
      };
      es.addEventListener("error", onFailure);
      es.onerror = onFailure;
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) {
        try { es.close(); } catch {}
      }
    };
  }, []);

  const sendBody = async (body: string) => {
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (data.message) {
        const msg = data.message as ChatMessage;
        if (msg.id > cursorRef.current) cursorRef.current = msg.id;
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      }
    } catch {
      // user can retry
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await sendBody(body);
  };

  const onVoiceTranscript = (text: string, autoSend: boolean) => {
    if (!text) return;
    if (autoSend) {
      sendBody(text);
    } else {
      setDraft(text);
    }
  };

  return (
    <>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Noch keine Nachrichten — schreib unten was rein.
          </div>
        ) : (
          <ul className="space-y-3 max-w-3xl mx-auto">
            {messages.map(m => (
              <li key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    "max-w-[80%] rounded-2xl px-4 py-2.5 " +
                    (m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md text-sm leading-relaxed whitespace-pre-wrap break-words"
                      : "bg-white text-gray-900 rounded-bl-md border border-gray-200 shadow-sm")
                  }
                >
                  {m.role === "assistant" ? <AssistantMarkdown body={m.body} /> : m.body}
                  <div
                    className={
                      "text-[10px] mt-1 flex items-center gap-2 " +
                      (m.role === "user" ? "text-blue-100" : "text-gray-400")
                    }
                  >
                    <span>
                      {new Date(m.created_at * 1000).toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {m.role === "assistant" && voice.available && (
                      <button
                        type="button"
                        // The tap is a genuine user gesture → unlocks iOS Safari audio,
                        // then plays. This is the reliable path on iPhone where SSE-driven
                        // auto-speak is blocked by the autoplay policy.
                        onClick={() => {
                          voice.unlockAudio();
                          voice.speakText(m.body);
                        }}
                        aria-label="Vorlesen"
                        title="Vorlesen"
                        className="inline-flex items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z" />
                        </svg>
                        Vorlesen
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {awaitingReply && (
              <li className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: "0ms", animationDuration: "1s" }} />
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: "150ms", animationDuration: "1s" }} />
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: "300ms", animationDuration: "1s" }} />
                    <span className="ml-2 text-[10px] text-gray-400">schreibt…</span>
                  </div>
                </div>
              </li>
            )}
          </ul>
        )}
      </div>

      {voice.error && (
        <div className="px-4 py-1 text-[11px] bg-red-50 text-red-700 border-t border-red-200">
          {voice.error}
        </div>
      )}
      {voice.speaking && (
        <div className="px-4 py-1 text-[11px] bg-blue-50 text-blue-700 border-t border-blue-200 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          spricht…
          <button
            type="button"
            onClick={() => voice.stopSpeaking()}
            className="ml-auto underline hover:no-underline"
          >
            Stop
          </button>
        </div>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          send();
        }}
        className="border-t border-gray-200 bg-white px-3 py-3 flex items-end gap-2"
      >
        <VoiceControls voice={voice} onTranscript={onVoiceTranscript} show={connected} />
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Nachricht an thermomix schreiben…"
          enterKeyHint="send"
          className="flex-1 resize-none px-4 py-2.5 rounded-2xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="px-5 py-2.5 rounded-full bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition"
        >
          {sending ? "…" : "Senden"}
        </button>
      </form>
    </>
  );
}
