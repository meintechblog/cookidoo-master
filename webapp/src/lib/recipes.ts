import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { RECIPES_DIR } from "./repo-paths";

export type Recipe = {
  slug: string;
  title: string;
  subtitle: string | null;
  servings: number | null;
  prepMin: number | null;
  totalMin: number | null;
  difficulty: string | null;
  diet: string | null;
  hfCardNumber: string | null;
  hfUrl: string | null;
  cookidooPublicUrl: string | null;
  cookidooPrivateUrl: string | null;
  cookidooRecipeId: string | null;
  ingredients: string[];
  stepCount: number;
  hasOwnHero: boolean;
  rawMarkdown: string;
  addedAt: string | null;
};

/**
 * Read all recipes from the filesystem. Each recipes/<slug>/README.md is the
 * source of truth. We extract structured metadata heuristically from the
 * "Kennzahlen" table + ingredient list + Zubereitung section.
 */
export function listRecipes(): Recipe[] {
  if (!fs.existsSync(RECIPES_DIR)) return [];
  const slugs = fs.readdirSync(RECIPES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  return slugs.map(slug => readRecipe(slug)).filter((r): r is Recipe => r !== null);
}

export function readRecipe(slug: string): Recipe | null {
  const dir = path.join(RECIPES_DIR, slug);
  const readme = path.join(dir, "README.md");
  if (!fs.existsSync(readme)) return null;
  const md = fs.readFileSync(readme, "utf8");
  const heroJpg = path.join(dir, "hero.jpg");
  const heroPng = path.join(dir, "hero.png");
  const hasOwnHero = fs.existsSync(heroJpg) || fs.existsSync(heroPng);

  // H1 title
  const title = (md.match(/^#\s+(.+?)$/m)?.[1] || slug).trim();
  // Subtitle = first line after H1 that's not blank or another heading
  const subtitleMatch = md.match(/^#\s+.+?\n+([^#\n][^\n]*)/m);
  const subtitle = subtitleMatch ? subtitleMatch[1].trim() : null;

  // Kennzahlen table — pull rows
  const kennzahlen = extractKennzahlen(md);

  // Ingredient list
  const ingredients = extractIngredients(md);

  // Step count
  const stepCount = extractStepCount(md);

  return {
    slug,
    title,
    subtitle,
    servings: kennzahlen.portionen ? parseInt(kennzahlen.portionen) : null,
    prepMin: kennzahlen.arbeitszeit ? parseMinutes(kennzahlen.arbeitszeit) : null,
    totalMin: kennzahlen.gesamtzeit ? parseMinutes(kennzahlen.gesamtzeit) : null,
    difficulty: kennzahlen.schwierigkeit || null,
    diet: kennzahlen.diaet || null,
    hfCardNumber: extractCardNumber(kennzahlen.quelle || ""),
    hfUrl: kennzahlen.hfUrl || null,
    cookidooPublicUrl: kennzahlen.cookidooPublic || null,
    cookidooPrivateUrl: kennzahlen.cookidooPrivate || null,
    cookidooRecipeId: extractCookidooRecipeId(kennzahlen.cookidooPublic || kennzahlen.cookidooPrivate || ""),
    ingredients,
    stepCount,
    hasOwnHero,
    rawMarkdown: md,
    addedAt: firstCommitISO(readme),
  };
}

/**
 * Date the README was first committed to the repo = when we onboarded the
 * recipe into our app. Falls back to file mtime when git is unavailable
 * (e.g. tarball deploy without .git).
 */
function firstCommitISO(filePath: string): string | null {
  try {
    const out = execFileSync(
      "git",
      ["log", "--diff-filter=A", "--format=%aI", "--", filePath],
      { cwd: RECIPES_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const lines = out.trim().split("\n").filter(Boolean);
    if (lines.length > 0) return lines[lines.length - 1];
  } catch {}
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return null;
  }
}

function extractKennzahlen(md: string): Record<string, string | null> {
  const sectionMatch = md.match(/##\s+Kennzahlen[\s\S]+?(?=\n##\s+|$)/);
  if (!sectionMatch) return {};
  const section = sectionMatch[0];
  const rows = section.matchAll(/^\|\s*\*\*([^|]+?)\*\*\s*\|\s*([^|]+?)\s*\|$/gm);
  const result: Record<string, string | null> = {};
  for (const m of rows) {
    const key = m[1].trim().toLowerCase();
    const val = m[2].trim();
    if (key.includes("portion")) result.portionen = val;
    else if (key.includes("arbeitszeit")) result.arbeitszeit = val;
    else if (key.includes("gesamtzeit")) result.gesamtzeit = val;
    else if (key.includes("schwierigkeit")) result.schwierigkeit = val;
    else if (key.includes("diät") || key.includes("diaet")) result.diaet = val;
    else if (key.includes("quelle")) result.quelle = val;
    else if (key.includes("öffentlich") || key.includes("oeffentlich")) result.cookidooPublic = val;
    else if (key.includes("privat") || key.includes("eingeloggt")) result.cookidooPrivate = val;
    else if (key.includes("original hellofresh") || key.includes("hellofresh-rezept")) result.hfUrl = val;
  }
  return result;
}

function parseMinutes(s: string): number | null {
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

function extractCardNumber(quelle: string): string | null {
  const m = quelle.match(/#(\d+)/);
  return m ? m[1] : null;
}

function extractCookidooRecipeId(url: string): string | null {
  const m = url.match(/\/recipes\/de-DE\/([A-Z0-9]+)/);
  return m ? m[1] : null;
}

function extractIngredients(md: string): string[] {
  // BUG-FIX: `\Z` in JS regex falls back to literal `Z` and matched the first
  // ingredient starting with Z (e.g. "Zwiebeln") — cutting the list short.
  // Use `$` with no `m` flag = end-of-string, OR explicit `\n##\s+` lookahead.
  const m = md.match(/##\s+Zutaten[^\n]*\n([\s\S]*?)(?=\n##\s+|$(?![\s\S]))/);
  if (!m) return [];
  return m[1].split("\n")
    .filter(l => l.trim().startsWith("- "))
    .map(l => l.replace(/^-\s+/, "").trim());
}

function extractStepCount(md: string): number {
  const m = md.match(/##\s+Zubereitung[^\n]*\n([\s\S]*?)(?=\n##\s+|$(?![\s\S]))/);
  if (!m) return 0;
  return m[1].split("\n").filter(l => /^\d+\.\s/.test(l.trim())).length;
}
