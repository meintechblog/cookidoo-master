import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { RECIPES_DIR, REPO_ROOT, STATE_DIR } from "@/lib/repo-paths";
import { readRecipe } from "@/lib/recipes";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PY = process.env.THERMOMIX_PYTHON || path.join(REPO_ROOT, ".venv/bin/python");
const PIPELINE_SCRIPT = path.resolve(process.cwd(), "worker", "full_pipeline.py");

type PublishRequest = {
  mode?: "create" | "create_and_publish";
  recipe_id?: string;
};

function extractTipsSection(md: string): string {
  const m = md.match(/##\s+Tipps[^\n]*\n([\s\S]*?)(?=\n##\s+|$(?![\s\S]))/);
  return m ? m[1].trim() : "";
}

function extractWarumSection(md: string): string {
  const m = md.match(/##\s+Warum[^\n]*\n([\s\S]*?)(?=\n##\s+|$(?![\s\S]))/);
  return m ? m[1].trim() : "";
}

function extractStepLines(md: string): string[] {
  const m = md.match(/##\s+Zubereitung[^\n]*\n([\s\S]*?)(?=\n##\s+|$(?![\s\S]))/);
  if (!m) return [];
  const body = m[1];
  // Handles BOTH styles seen in our recipes:
  //  - one-step-per-line (SCB, Nasi) — no blank line between steps
  //  - blank-line-separated paragraphs (Hackbraten) — newlines between steps
  // A new step starts on any line beginning with `\d+. `; continuation
  // lines accumulate until the next step. Blockquotes are skipped.
  const steps: string[] = [];
  let current: string[] = [];
  for (const rawLine of body.split("\n")) {
    if (rawLine.trim().startsWith(">")) {
      if (current.length) { steps.push(current.join(" ").trim()); current = []; }
      continue;
    }
    const sm = rawLine.match(/^(\d+)\.\s+(.*)$/);
    if (sm) {
      if (current.length) steps.push(current.join(" ").trim());
      current = [sm[2]];
    } else if (current.length && rawLine.trim()) {
      current.push(rawLine.trim());
    }
  }
  if (current.length) steps.push(current.join(" ").trim());
  return steps.map(s => s.replace(/\*\*/g, ""));
}

function buildTipsBlock(tipsMd: string, warumMd: string, hfUrl: string | null): string {
  const stripBulletPrefix = (line: string) => line.replace(/^\s*[-*]\s+/, "");
  const tipLines = tipsMd.split("\n").filter(l => l.trim().startsWith("-") || l.trim().startsWith("*"));
  const formattedTips = tipLines.map(l => `— ${stripBulletPrefix(l).replace(/\*\*/g, "").trim()}`).join("\n");

  const sections: string[] = [];
  if (formattedTips) sections.push(formattedTips);
  if (warumMd) {
    const cleaned = warumMd
      .replace(/\*\*/g, "")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `${t} (${u})`)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    sections.push(`Warum diese Cookidoo-Adaption:\n${cleaned}`);
  }
  if (hfUrl) sections.push(`Original-Karte (HelloFresh):\n${hfUrl}`);
  sections.push(`Toolkit (Open Source):\nhttps://github.com/meintechblog/thermomix-master`);
  return sections.join("\n\n");
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });

  const body: PublishRequest = await req.json().catch(() => ({}));
  const mode = body.mode || "create";

  const recipe = readRecipe(slug);
  if (!recipe) return NextResponse.json({ error: "recipe not found" }, { status: 404 });

  if (!recipe.ingredients.length) return NextResponse.json({ error: "no ingredients parsed from README" }, { status: 400 });

  const steps = extractStepLines(recipe.rawMarkdown);
  if (!steps.length) return NextResponse.json({ error: "no Zubereitung steps parsed" }, { status: 400 });

  const heroPath = path.join(RECIPES_DIR, slug, "hero.jpg");
  if (mode === "create_and_publish" && !fs.existsSync(heroPath)) {
    return NextResponse.json({ error: "hero.jpg fehlt — bitte eigenes Foto hochladen bevor Public-Publish" }, { status: 400 });
  }
  if (mode === "create_and_publish" && fs.existsSync(path.join(RECIPES_DIR, slug, "hf-original.jpg"))) {
    // Hash-compare to make sure user didn't just rename the HF reference.
    const a = fs.readFileSync(heroPath);
    const b = fs.readFileSync(path.join(RECIPES_DIR, slug, "hf-original.jpg"));
    if (a.equals(b)) return NextResponse.json({ error: "hero.jpg ist identisch zum HF-Original — bitte eigenes Foto hochladen" }, { status: 400 });
  }

  const tips = extractTipsSection(recipe.rawMarkdown);
  const warum = extractWarumSection(recipe.rawMarkdown);

  const spec: Record<string, unknown> = {
    recipe_name: recipe.title,
    ingredients: recipe.ingredients,
    steps,
    tips_text: buildTipsBlock(tips, warum, recipe.hfUrl),
    prep_min: recipe.prepMin || 25,
    total_min: recipe.totalMin || 40,
    publish: mode === "create_and_publish",
  };
  if (mode === "create_and_publish") spec.image_path = heroPath;
  if (body.recipe_id) spec.recipe_id = body.recipe_id;

  const runId = db().prepare(
    "INSERT INTO pipeline_runs (slug, action, status) VALUES (?, ?, 'running')"
  ).run(slug, mode).lastInsertRowid;

  // Fire-and-forget child process. The server captures stdout/stderr and
  // persists them in pipeline_runs, then the UI polls /api/recipes/<slug>/publish/status.
  const child = spawn(PY, [PIPELINE_SCRIPT], {
    env: {
      ...process.env,
      THERMOMIX_HEADLESS: "1",
      HOME: process.env.HOME || `/root`,
      THERMOMIX_STATE_DIR: STATE_DIR,
    },
    stdio: ["pipe", "pipe", "pipe"],
    detached: false,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", d => { stdout += d.toString(); });
  child.stderr.on("data", d => { stderr += d.toString(); });

  child.on("error", err => {
    db().prepare(
      "UPDATE pipeline_runs SET status = 'error', stderr = ?, finished_at = strftime('%s','now') WHERE id = ?"
    ).run(String(err.message || err), runId);
  });

  child.on("close", code => {
    const status = code === 0 ? "ok" : "error";
    db().prepare(
      "UPDATE pipeline_runs SET status = ?, stdout = ?, stderr = ?, finished_at = strftime('%s','now') WHERE id = ?"
    ).run(status, stdout.slice(0, 50000), stderr.slice(0, 50000), runId);
  });

  child.stdin.write(JSON.stringify(spec));
  child.stdin.end();

  return NextResponse.json({ ok: true, runId, mode, message: "Pipeline gestartet — Status pollen via GET ?runId=..." });
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });

  const url = new URL(req.url);
  const runIdParam = url.searchParams.get("runId");

  if (runIdParam) {
    const row = db().prepare("SELECT * FROM pipeline_runs WHERE id = ? AND slug = ?").get(parseInt(runIdParam, 10), slug);
    if (!row) return NextResponse.json({ error: "run not found" }, { status: 404 });
    return NextResponse.json(row);
  }

  const rows = db().prepare("SELECT * FROM pipeline_runs WHERE slug = ? ORDER BY started_at DESC LIMIT 20").all(slug);
  return NextResponse.json({ runs: rows });
}
