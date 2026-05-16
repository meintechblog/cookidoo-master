import path from "node:path";

// The repo root is one directory above webapp/. In production the webapp lives
// at /opt/cookidoo-master/webapp/, so the repo root is /opt/cookidoo-master/.
// In dev (npm run dev from webapp/), the same logic resolves correctly.
export const REPO_ROOT = path.resolve(process.cwd(), "..");
export const RECIPES_DIR = path.join(REPO_ROOT, "recipes");
export const SKILL_DIR = path.join(REPO_ROOT, "skill", "thermomix-master");
export const AUTOMATION_DIR = path.join(REPO_ROOT, "automation");
export const DOCS_ASSETS_DIR = path.join(REPO_ROOT, "docs", "assets");

// State directory — DB, pinned-URL queue, cookidoo profile. NOT in repo.
// Override via THERMOMIX_STATE_DIR env var (production = /var/lib/thermomix-master).
export const STATE_DIR = process.env.THERMOMIX_STATE_DIR || path.join(REPO_ROOT, ".state");
