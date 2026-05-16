"use client";
import { useState } from "react";

export function PinForm() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const r = await fetch("/api/pinned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        setFeedback({ kind: "ok", msg: data.message || "Gepinnt — wird verarbeitet." });
        setUrl("");
        setTimeout(() => window.location.href = "/pinned", 1200);
      } else {
        setFeedback({ kind: "err", msg: data.error || `HTTP ${r.status}` });
      }
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="pin-form space-y-3">
      <div className="flex gap-3">
        <input
          type="url"
          required
          placeholder="https://www.hellofresh.de/recipes/..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy}
          className="px-6 py-3 bg-white text-hero-700 font-semibold rounded-lg hover:bg-cream-100 disabled:opacity-50 transition whitespace-nowrap"
        >
          {busy ? "Pinne …" : "Pinnen"}
        </button>
      </div>
      {feedback && (
        <div className={`text-sm font-medium px-1 ${feedback.kind === "ok" ? "text-hero-100" : "text-yellow-200"}`}>
          {feedback.msg}
        </div>
      )}
    </form>
  );
}
