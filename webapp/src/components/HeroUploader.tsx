"use client";
import { useState } from "react";

export function HeroUploader({ slug, hasOwnHero, hfUrl }: { slug: string; hasOwnHero: boolean; hfUrl: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewBust, setPreviewBust] = useState(0);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("hero", file);
      const r = await fetch(`/api/recipes/${slug}/hero/upload`, { method: "POST", body: fd });
      const data = await r.json();
      if (r.ok) {
        setMsg(`✓ Lokales Hero ersetzt (${Math.round(file.size / 1024)} KB). Push zu Cookidoo unten via "Erstellen + Public-Publish".`);
        setPreviewBust(Date.now());
        setFile(null);
      } else {
        setMsg(`Fehler: ${data.error || r.status}`);
      }
    } catch (e) {
      setMsg(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-card space-y-5">
      <h3 className="font-display text-xl font-bold text-charcoal-900">Hero-Bild</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-charcoal-500 mb-2">Aktuell (lokal, auf Cookidoo)</div>
          <div className="aspect-[4/3] bg-charcoal-100 rounded-xl overflow-hidden">
            {hasOwnHero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/recipes/${slug}/hero?t=${previewBust}`} alt="aktuelles Hero" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-charcoal-300 text-5xl">🍳</div>
            )}
          </div>
        </div>

        {hfUrl && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-charcoal-500 mb-2">HelloFresh-Original (Referenz)</div>
            <div className="aspect-[4/3] bg-charcoal-100 rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/recipes/${slug}/hf-image`} alt="HelloFresh original" className="w-full h-full object-cover" />
            </div>
            <a
              href={`/api/recipes/${slug}/hf-image?download=1`}
              className="mt-2 inline-block text-xs text-charcoal-500 hover:text-hero-700"
              download
            >
              ↓ Original herunterladen (nur In-App-Referenz, NICHT für Cookidoo-Publishing)
            </a>
          </div>
        )}
      </div>

      <div className="border-t border-charcoal-100 pt-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-charcoal-500 mb-2">Neues Hero hochladen</div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="text-sm file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-cream-100 file:text-charcoal-800 file:font-medium hover:file:bg-cream-200"
          />
          <button
            onClick={upload}
            disabled={!file || busy}
            className="px-5 py-2 bg-hero-600 text-white font-semibold rounded-lg hover:bg-hero-700 disabled:opacity-50 transition"
          >
            {busy ? "Lade hoch …" : "Hochladen"}
          </button>
        </div>
        {file && (
          <div className="mt-2 text-xs text-charcoal-500">{file.name} · {Math.round(file.size / 1024)} KB · {file.type}</div>
        )}
        {msg && <div className="mt-3 text-sm text-charcoal-700">{msg}</div>}
        <p className="mt-3 text-xs text-charcoal-500">
          Das Foto wird sofort lokal gespeichert. Push zu Cookidoo läuft unten über den <strong>„Erstellen + Public-Publish"</strong>-Button (Pipeline lädt das Hero hoch, setzt Tipps + Zeiten und schaltet das Rezept öffentlich).
        </p>
      </div>
    </div>
  );
}
