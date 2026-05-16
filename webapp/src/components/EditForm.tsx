"use client";
import { useState } from "react";

export function EditForm({ slug, initialMarkdown }: { slug: string; initialMarkdown: string }) {
  const [md, setMd] = useState(initialMarkdown);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/recipes/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: md }),
      });
      const data = await r.json();
      setMsg(r.ok ? "Gespeichert ✓" : `Fehler: ${data.error || r.status}`);
    } catch (e) {
      setMsg(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <textarea
        value={md}
        onChange={e => setMd(e.target.value)}
        className="w-full h-[70vh] font-mono text-sm p-4 bg-white border-2 border-charcoal-200 rounded-xl focus:outline-none focus:border-hero-500"
        spellCheck={false}
      />
      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={busy}
          className="px-6 py-3 bg-hero-600 text-white font-semibold rounded-lg hover:bg-hero-700 disabled:opacity-50 transition"
        >
          {busy ? "Speichere …" : "Speichern"}
        </button>
        {msg && <span className="text-sm text-charcoal-700">{msg}</span>}
      </div>
    </div>
  );
}
