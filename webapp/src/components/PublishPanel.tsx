"use client";
import { useEffect, useState } from "react";

type Run = {
  id: number;
  slug: string;
  action: string;
  status: "running" | "ok" | "error";
  stdout: string | null;
  stderr: string | null;
  started_at: number;
  finished_at: number | null;
};

type Props = {
  slug: string;
  hasOwnHero: boolean;
  cookidooRecipeId: string | null;
  cookidooPublicUrl: string | null;
};

export function PublishPanel({ slug, hasOwnHero, cookidooRecipeId, cookidooPublicUrl }: Props) {
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function loadHistory() {
    try {
      const r = await fetch(`/api/recipes/${slug}/publish`);
      if (r.ok) {
        const d = await r.json();
        setHistory(d.runs || []);
      }
    } catch {}
  }
  useEffect(() => { loadHistory(); }, [slug]);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/recipes/${slug}/publish?runId=${runId}`);
        if (!r.ok) return;
        const d: Run = await r.json();
        if (cancelled) return;
        setRun(d);
        if (d.status === "running") setTimeout(tick, 3000);
        else { setBusy(false); loadHistory(); }
      } catch {}
    };
    tick();
    return () => { cancelled = true; };
  }, [runId, slug]);

  async function trigger(mode: "create" | "create_and_publish") {
    setErr(null); setBusy(true); setRun(null);
    try {
      const r = await fetch(`/api/recipes/${slug}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, recipe_id: cookidooRecipeId || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || `HTTP ${r.status}`); setBusy(false); return; }
      setRunId(d.runId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const statusColor = (s: Run["status"]) =>
    s === "ok" ? "text-green-700" : s === "error" ? "text-red-700" : "text-amber-700";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-card space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-charcoal-900">Cookidoo-Pipeline</h3>
          <p className="text-sm text-charcoal-600 mt-1">
            Schreibt das aktuelle Markdown via Playwright in Cookidoo. <strong>Erstellen</strong> legt das Rezept privat an, <strong>Erstellen + Public-Publish</strong> lädt zusätzlich dein Hero-Foto hoch und schaltet das Rezept öffentlich.
          </p>
        </div>
        {cookidooPublicUrl && (
          <a href={cookidooPublicUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-hero-700 hover:underline">
            Aktuelle öffentliche Version ↗
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => trigger("create")}
          disabled={busy}
          className="px-5 py-2 bg-charcoal-900 text-white font-semibold rounded-lg hover:bg-charcoal-800 disabled:opacity-50 transition"
        >
          {busy ? "Pipeline läuft …" : "Erstellen (privat, ohne Hero)"}
        </button>
        <button
          onClick={() => trigger("create_and_publish")}
          disabled={busy || !hasOwnHero}
          className="px-5 py-2 bg-hero-600 text-white font-semibold rounded-lg hover:bg-hero-700 disabled:opacity-50 transition"
          title={hasOwnHero ? "Pipeline läuft mit Hero-Upload und Public-Schaltung" : "Eigenes Hero-Foto bitte zuerst hochladen"}
        >
          {busy ? "Pipeline läuft …" : "Erstellen + Public-Publish (mit Hero)"}
        </button>
      </div>

      {!hasOwnHero && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          ⚠ Public-Publish erfordert ein eigenes Hero-Foto (urheberrechtlich) — bitte oben hochladen.
        </div>
      )}
      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>}

      {run && (
        <div className="border-t border-charcoal-100 pt-4 space-y-2">
          <div className="text-xs uppercase tracking-wide text-charcoal-500">
            Aktueller Lauf #{run.id} · <span className={statusColor(run.status)}>{run.status}</span>
          </div>
          {run.stderr && (
            <pre className="text-[11px] leading-snug bg-charcoal-50 rounded p-3 overflow-auto max-h-72 whitespace-pre-wrap">{run.stderr.slice(-4000)}</pre>
          )}
          {run.status === "ok" && run.stdout && (() => {
            try {
              const j = JSON.parse(run.stdout);
              return (
                <div className="text-sm text-charcoal-800">
                  <div>Recipe ID: <code className="bg-cream-100 px-1.5 py-0.5 rounded">{j.recipe_id}</code></div>
                  {j.public_url && <div className="mt-1"><a href={j.public_url} target="_blank" rel="noopener noreferrer" className="text-hero-700 hover:underline">→ {j.public_url}</a></div>}
                  <div className="mt-1 text-xs text-charcoal-500">Steps: {(j.actions || []).join(", ")}</div>
                </div>
              );
            } catch { return null; }
          })()}
        </div>
      )}

      {history.length > 0 && (
        <details className="border-t border-charcoal-100 pt-4">
          <summary className="text-xs uppercase tracking-wide text-charcoal-500 cursor-pointer">Historie ({history.length})</summary>
          <ul className="mt-2 text-xs space-y-1">
            {history.map(h => (
              <li key={h.id} className="flex justify-between gap-3">
                <span>#{h.id} · {h.action}</span>
                <span className={statusColor(h.status)}>{h.status}</span>
                <span className="text-charcoal-400">{new Date(h.started_at * 1000).toLocaleString("de-DE")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
