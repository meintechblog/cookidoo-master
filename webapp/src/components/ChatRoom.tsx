"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/db";

type Props = { initialBacklog: ChatMessage[] };

export function ChatRoom({ initialBacklog }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialBacklog);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cursor = useMemo(
    () => (messages.length ? Math.max(...messages.map(m => m.id)) : 0),
    [messages.length === 0 ? 0 : "stable"],
    // intentional: cursor only matters for initial subscribe; live updates come via SSE.
  );

  // auto-scroll on new message
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource(`/api/chat/stream?since=${cursor}`);
    es.addEventListener("hello", () => setConnected(true));
    es.addEventListener("message", (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as ChatMessage;
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      } catch {}
    });
    es.addEventListener("error", () => setConnected(false));
    es.onerror = () => setConnected(false);
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    const body = draft.trim();
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
        setMessages(prev => (prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]));
      }
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4 bg-cream-50">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-charcoal-400 text-sm">
            Noch keine Nachrichten — schreib unten was rein.
          </div>
        ) : (
          <ul className="space-y-3 max-w-3xl mx-auto">
            {messages.map(m => (
              <li
                key={m.id}
                className={
                  m.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  className={
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words " +
                    (m.role === "user"
                      ? "bg-hero-500 text-white rounded-br-md"
                      : "bg-white text-charcoal-900 rounded-bl-md border border-charcoal-100 shadow-sm")
                  }
                >
                  {m.body}
                  <div
                    className={
                      "text-[10px] mt-1 " +
                      (m.role === "user" ? "text-hero-100" : "text-charcoal-400")
                    }
                  >
                    {new Date(m.created_at * 1000).toLocaleTimeString("de-DE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form
        onSubmit={e => {
          e.preventDefault();
          send();
        }}
        className="border-t border-charcoal-100 bg-white px-4 py-3 flex items-end gap-3"
      >
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
          placeholder="Nachricht an cookidoo-master schreiben…"
          className="flex-1 resize-none px-4 py-2.5 rounded-2xl border border-charcoal-200 bg-cream-50 text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-hero-500 focus:border-transparent text-sm"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="px-5 py-2.5 rounded-full bg-hero-500 text-white font-medium text-sm hover:bg-hero-600 disabled:bg-charcoal-200 disabled:text-charcoal-400 transition"
        >
          {sending ? "…" : "Senden"}
        </button>
        <div
          className={
            "absolute mt-[-24px] ml-[-12px] text-[10px] " +
            (connected ? "text-green-600" : "text-charcoal-400")
          }
          aria-live="polite"
        >
          {connected ? "● live" : "○ getrennt"}
        </div>
      </form>
    </>
  );
}
