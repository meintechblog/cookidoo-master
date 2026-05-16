#!/usr/bin/env node
/**
 * thermomix-master pipeline worker.
 *
 * Polls the `pinned_urls` table every 60s. For each `queued` URL:
 *   1. Extract HelloFresh JSON via skill/scripts/extract-hellofresh.py
 *   2. Slugify the recipe name (UTF-8-safe via _slugify.py)
 *   3. Scaffold recipes/<slug>/:
 *        .extracted.json     — raw HF JSON (for the skill to consume)
 *        hf-original.jpg     — HF og:image (in-app reference, NOT for Cookidoo)
 *        README.md           — skeleton with HF ingredients (scaled to 4P) +
 *                              instructions. Status `SKELETON` flag in the
 *                              Kennzahlen table marks it as needing curation.
 *   4. Mark status='ready_for_review' so the webapp shows it as draft.
 *
 * Triggering the actual Cookidoo pipeline (full_pipeline.py) happens via the
 *   /api/recipes/<slug>/publish endpoint AFTER the user has uploaded their
 *   own hero photo (the HF image is © HelloFresh — never push it to
 *   Cookidoo). This keeps the human-in-the-loop step for image licensing.
 */
const path = require("node:path");
const fs = require("node:fs");
const https = require("node:https");
const http = require("node:http");
const { URL } = require("node:url");
const { spawnSync } = require("node:child_process");
const Database = require("better-sqlite3");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const STATE_DIR = process.env.THERMOMIX_STATE_DIR || path.join(REPO_ROOT, ".state");
const PY = process.env.THERMOMIX_PYTHON || path.join(REPO_ROOT, ".venv/bin/python");
const SKILL_DIR = path.join(REPO_ROOT, "skill", "thermomix-master");
const RECIPES_DIR = path.join(REPO_ROOT, "recipes");

if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
if (!fs.existsSync(RECIPES_DIR)) fs.mkdirSync(RECIPES_DIR, { recursive: true });
const db = new Database(path.join(STATE_DIR, "thermomix.sqlite"));
db.pragma("journal_mode = WAL");
// Migrate. Both webapp/src/lib/db.ts and this worker can boot first, so each
// owns the same `CREATE TABLE IF NOT EXISTS` truth. Keep these schemas in sync.
db.exec(`
  CREATE TABLE IF NOT EXISTS pinned_urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued',
    slug TEXT,
    error TEXT,
    pinned_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    processed_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    stdout TEXT,
    stderr TEXT,
    started_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    finished_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
`);

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function slugify(name) {
  const r = spawnSync(PY, [path.join(SKILL_DIR, "scripts", "_slugify.py"), name], { encoding: "utf8" });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function extractHellofresh(url) {
  const r = spawnSync(PY, [path.join(SKILL_DIR, "scripts", "extract-hellofresh.py"), url], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`extract failed: ${(r.stderr || r.stdout || "").slice(0, 400)}`);
  return JSON.parse(r.stdout);
}

function downloadImage(url, dest, maxRedirects = 4) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error("too many redirects"));
    let u;
    try { u = new URL(url); } catch (e) { return reject(e); }
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.get(url, { headers: { "User-Agent": "thermomix-master-worker/1" } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
        res.resume();
        return downloadImage(new URL(res.headers.location, url).toString(), dest, maxRedirects - 1).then(resolve, reject);
      }
      if ((res.statusCode || 0) >= 400) {
        res.resume();
        return reject(new Error(`http ${res.statusCode} for ${url}`));
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve(dest)));
      out.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("download timeout")));
  });
}

// HelloFresh recipes are typically 2P, our Thermomix target is 4P. Scale the
// leading integer/decimal amount when present. Leaves "nach Bedarf", "1 Prise"
// etc. untouched if no leading number; halves "0.5" to "1", "1.5" to "3".
function scaleTo4P(ingredient, sourceServings) {
  if (!sourceServings || sourceServings === 4) return ingredient;
  const factor = 4 / sourceServings;
  return ingredient.replace(/^(\s*)(\d+(?:[.,]\d+)?)/, (m, ws, num) => {
    const v = parseFloat(num.replace(",", ".")) * factor;
    const rounded = Math.abs(v - Math.round(v)) < 0.01 ? String(Math.round(v)) : v.toFixed(1).replace(".", ",");
    return `${ws}${rounded}`;
  });
}

function parseIsoMinutes(iso) {
  if (!iso) return null;
  // ISO 8601 duration: PT15M, PT1H30M
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!m) return null;
  return (parseInt(m[1] || "0", 10) * 60) + parseInt(m[2] || "0", 10);
}

function escapeMarkdownCell(s) {
  return String(s || "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function buildSkeletonReadme(data, slug) {
  const title = data.name || slug;
  const subtitle = (data.description || "").split(/\s+/).slice(0, 22).join(" ");
  const servings = parseInt(String(data.servings || "2"), 10) || 2;
  const prepMin = parseIsoMinutes(data.prepTime_iso);
  const totalMin = parseIsoMinutes(data.totalTime_iso);
  const ingr = (data.ingredients || []).map(i => `- ${scaleTo4P(String(i), servings)}`).join("\n");
  const steps = (data.instructions || []).map((s, i) => `${i + 1}. ${s}`).join("\n\n");
  const nutr = data.nutrition || {};

  const lines = [];
  lines.push(`# ${title}`, "");
  if (subtitle) lines.push(subtitle, "");
  lines.push("![Hero](hero.jpg)", "");
  lines.push("## Kennzahlen", "");
  lines.push("| | |");
  lines.push("|---|---|");
  lines.push(`| **Status** | SKELETON — automatisch aus HelloFresh extrahiert, wartet auf Thermomix-Curation (eigenes Hero hochladen → Steps auf native Verben überarbeiten → Tipps + Quellen-Narrativ schreiben → \"Push zu Cookidoo\" klicken) |`);
  lines.push(`| **Portionen** | 4 _(skaliert aus HF-Original mit ${servings} P)_ |`);
  if (prepMin) lines.push(`| **Arbeitszeit** | ca. ${prepMin} Min. _(HF-Quelle, ggf. anpassen)_ |`);
  if (totalMin) lines.push(`| **Gesamtzeit** | ca. ${totalMin} Min. _(HF-Quelle, ggf. anpassen)_ |`);
  if (data.category) lines.push(`| **Kategorie** | ${escapeMarkdownCell(data.category)} |`);
  if (data.cuisine) lines.push(`| **Küche** | ${escapeMarkdownCell(data.cuisine)} |`);
  lines.push(`| **Original HelloFresh-Rezept** | ${data.url} |`);
  lines.push(`| **Foto** | _(noch nicht hochgeladen — HF-Original liegt als hf-original.jpg lokal vor, NUR als Referenz)_ |`);
  lines.push("");
  lines.push("## Zutaten (4P)", "");
  lines.push(ingr || "_(keine Zutaten gefunden)_");
  lines.push("");
  lines.push("## Zubereitung", "");
  lines.push("> ⚠ Roh aus HelloFresh übernommen. Vor dem Push zu Cookidoo bitte ins native Thermomix-Wording übersetzen (siehe skill/thermomix-master/REFERENCES/native-style.md):");
  lines.push("> - Verben: `einwiegen`, `einhängen`, `aufsetzen`, `dampfgaren`, `mithilfe des Spatels herausnehmen`, `unterheben`");
  lines.push("> - Steps auf 5–6 reduzieren (Vorwerk-Bowls/Currys-Standard bei 14–17 Zutaten)");
  lines.push("> - Koch-Befehl-Chips als Inline-Code formatieren: `` `18 Min./Varoma/Stufe 1` ``");
  lines.push("");
  lines.push(steps || "_(keine Schritte gefunden)_");
  lines.push("");
  lines.push("## Tipps", "");
  lines.push("_(noch zu schreiben — 5–8 Tipps mit fett gesetzten Stichworten, Schwerpunkt auf Thermomix-spezifischen Tricks und Variationen)_");
  lines.push("");
  lines.push("## Warum diese Cookidoo-Adaption", "");
  lines.push("_(noch zu schreiben — Narrativ zu HelloFresh-Wertschätzung + warum native Thermomix-Adaption, Boilerplate aus skill/thermomix-master/REFERENCES/narrative-template.md)_");
  lines.push("");

  if (Object.keys(nutr).length) {
    lines.push("## Nährwerte pro Portion (HF-Quelle)", "");
    lines.push("| | |");
    lines.push("|---|---|");
    for (const [k, v] of Object.entries(nutr)) {
      lines.push(`| ${escapeMarkdownCell(k)} | ${escapeMarkdownCell(v)} |`);
    }
    lines.push("");
  }

  lines.push("## Quelle & Lizenz", "");
  lines.push(`Original-Rezept stammt von HelloFresh: ${data.url}`);
  lines.push("");
  lines.push("Diese Cookidoo-Adaption (Schritt-Reorganisation, Thermomix-native Verben, Mengen-Skalierung auf 4P, Tipps, Quellen-Narrativ) ist als Eigenarbeit für die private Cookidoo-Version gedacht. Vor Public-Sharing auf Cookidoo: **eigenes Hero-Foto hochladen** (HF-Foto ist urheberrechtlich geschützt).");
  lines.push("");
  return lines.join("\n");
}

async function processOne(row) {
  log(`processing #${row.id}: ${row.url}`);
  db.prepare("UPDATE pinned_urls SET status = 'processing' WHERE id = ?").run(row.id);
  try {
    const data = extractHellofresh(row.url);
    const slug = slugify(data.name || "untitled");
    log(`  → name=${(data.name || "").slice(0, 60)} · slug=${slug} · servings=${data.servings} · ${data.ingredients?.length || 0} ingredients`);

    const recipeDir = path.join(RECIPES_DIR, slug);
    if (fs.existsSync(recipeDir)) {
      log(`  → recipe dir already exists, marking duplicate (skipped)`);
      db.prepare("UPDATE pinned_urls SET status = 'skipped', slug = ?, processed_at = strftime('%s','now'), error = 'recipe directory already exists' WHERE id = ?")
        .run(slug, row.id);
      return;
    }

    fs.mkdirSync(recipeDir, { recursive: true });
    fs.writeFileSync(path.join(recipeDir, ".extracted.json"), JSON.stringify(data, null, 2));

    if (data.image_url) {
      try {
        await downloadImage(data.image_url, path.join(recipeDir, "hf-original.jpg"));
        log(`  → downloaded hf-original.jpg`);
      } catch (e) {
        log(`  → hero download failed (non-fatal): ${e.message}`);
      }
    }

    const readme = buildSkeletonReadme(data, slug);
    fs.writeFileSync(path.join(recipeDir, "README.md"), readme);
    log(`  → wrote skeleton README.md (${readme.length} bytes)`);

    db.prepare("UPDATE pinned_urls SET status = 'ready_for_review', slug = ?, processed_at = strftime('%s','now') WHERE id = ?")
      .run(slug, row.id);
    log(`  → ready_for_review: ${slug}`);
  } catch (e) {
    log(`  → ERROR: ${e.message}`);
    db.prepare("UPDATE pinned_urls SET status = 'error', error = ?, processed_at = strftime('%s','now') WHERE id = ?")
      .run(String(e.message || e).slice(0, 1000), row.id);
  }
}

async function tick() {
  const rows = db.prepare("SELECT * FROM pinned_urls WHERE status = 'queued' ORDER BY pinned_at ASC LIMIT 1").all();
  for (const row of rows) await processOne(row);
}

log("worker started");
(async function loop() {
  while (true) {
    try { await tick(); } catch (e) { log(`tick error: ${e.message}`); }
    await new Promise(r => setTimeout(r, 60000));
  }
})();
