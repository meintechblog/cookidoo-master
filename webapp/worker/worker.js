#!/usr/bin/env node
/**
 * thermomix-master pipeline worker.
 *
 * Polls the pinned_urls table every 60s. For each `queued` URL:
 *   1. Run extract-hellofresh.py to fetch JSON
 *   2. Generate a slug, propose recipe data
 *   3. Mark status=processing — for v1, an actual pipeline-trigger that edits
 *      the canonical automation/01_create_recipe.py + runs the full chain is
 *      delegated to a future iteration (we'd need the Cookidoo login state
 *      copied into the LXC first). For now the worker just enriches the
 *      DB row with extracted metadata so the user can see what was pinned,
 *      and flags status=ready_for_manual so the LLM-orchestrator can take
 *      over via the skill.
 *
 *   The full auto-pipeline (extract → 01-06 → screenshot → commit) lights up
 *   once the Cookidoo profile is on the LXC (see deploy/setup-cookidoo-login.sh).
 */
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const Database = require("better-sqlite3");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const STATE_DIR = process.env.THERMOMIX_STATE_DIR || path.join(REPO_ROOT, ".state");
const PY = process.env.THERMOMIX_PYTHON || path.join(REPO_ROOT, ".venv/bin/python");
const SKILL_DIR = path.join(REPO_ROOT, "skill", "thermomix-master");

if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
const db = new Database(path.join(STATE_DIR, "thermomix.sqlite"));
db.pragma("journal_mode = WAL");

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function slugify(name) {
  const r = spawnSync(PY, [path.join(SKILL_DIR, "scripts", "_slugify.py"), name], { encoding: "utf8" });
  if (r.status === 0) return r.stdout.trim();
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function extractHellofresh(url) {
  const r = spawnSync(PY, [path.join(SKILL_DIR, "scripts", "extract-hellofresh.py"), url], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`extract failed: ${r.stderr || r.stdout}`);
  return JSON.parse(r.stdout);
}

async function processOne(row) {
  log(`processing #${row.id}: ${row.url}`);
  db.prepare("UPDATE pinned_urls SET status = 'processing' WHERE id = ?").run(row.id);
  try {
    const data = extractHellofresh(row.url);
    const slug = slugify(data.name || "untitled");
    log(`  → name=${(data.name || "").slice(0, 60)} · slug=${slug} · servings=${data.servings} · ${data.ingredients?.length || 0} ingredients`);

    const recipeDir = path.join(REPO_ROOT, "recipes", slug);
    if (fs.existsSync(recipeDir)) {
      log(`  → recipe dir already exists, marking duplicate (skipped)`);
      db.prepare("UPDATE pinned_urls SET status = 'skipped', slug = ?, processed_at = strftime('%s','now'), error = 'recipe directory already exists' WHERE id = ?")
        .run(slug, row.id);
      return;
    }

    // Stash extracted JSON for later LLM-driven adaptation
    fs.mkdirSync(recipeDir, { recursive: true });
    fs.writeFileSync(path.join(recipeDir, ".extracted.json"), JSON.stringify(data, null, 2));

    db.prepare("UPDATE pinned_urls SET status = 'ready_for_manual', slug = ?, processed_at = strftime('%s','now') WHERE id = ?")
      .run(slug, row.id);
    log(`  → ready_for_manual: ${slug} (LLM-orchestrator picks up via /thermomix-master skill)`);
  } catch (e) {
    log(`  → ERROR: ${e.message}`);
    db.prepare("UPDATE pinned_urls SET status = 'error', error = ?, processed_at = strftime('%s','now') WHERE id = ?")
      .run(e.message.slice(0, 1000), row.id);
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
