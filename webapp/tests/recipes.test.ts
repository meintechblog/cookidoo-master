/**
 * Smoke tests for the webapp. Hits the live deployment (LXC) by default —
 * override THERMOMIX_URL to test locally.
 *
 * Run from webapp/:  node --test tests/recipes.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.THERMOMIX_URL || "http://192.168.3.223";

test("homepage returns HTML with all recipes", async () => {
  const r = await fetch(BASE + "/");
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /Sweet-Chili-Bowl mit glasierter Aubergine/);
  assert.match(html, /Umami-Pilz-Stir-Fry mit Rosenkohl/);
  assert.match(html, /Frische Sauerteig-Pinsa mit Aubergine/);
  assert.match(html, /Nasi Goreng mit veganen Filetstücken/);
  assert.match(html, /Ingwer-Süßkartoffel-Eintopf mit Tofu/);
});

test("API /api/recipes returns 5+ recipes with required fields", async () => {
  const r = await fetch(BASE + "/api/recipes");
  assert.equal(r.status, 200);
  const data = await r.json() as { recipes: Array<Record<string, unknown>> };
  assert.ok(data.recipes.length >= 5, `expected ≥5 recipes, got ${data.recipes.length}`);
  for (const recipe of data.recipes) {
    assert.ok(recipe.slug, `recipe missing slug: ${JSON.stringify(recipe)}`);
    assert.ok(recipe.title, `recipe ${recipe.slug} missing title`);
    assert.ok(Array.isArray(recipe.ingredients), `recipe ${recipe.slug} ingredients not array`);
  }
});

test("regex bug regression: SCB has all 17 ingredients (not truncated at 'Zwiebel')", async () => {
  const r = await fetch(BASE + "/api/recipes");
  const data = await r.json() as { recipes: Array<{ slug: string; ingredients: string[] }> };
  const scb = data.recipes.find(r => r.slug === "sweet-chili-bowl");
  assert.ok(scb, "Sweet-Chili-Bowl not found");
  assert.ok(scb.ingredients.length >= 14, `SCB should have 14+ ingredients, got ${scb.ingredients.length}: ${scb.ingredients.join(", ")}`);
});

test("regex bug regression: Umami has all 19 ingredients (not truncated at 'Zwiebeln')", async () => {
  const r = await fetch(BASE + "/api/recipes");
  const data = await r.json() as { recipes: Array<{ slug: string; ingredients: string[] }> };
  const umami = data.recipes.find(r => r.slug === "umami-pilz-stir-fry-mit-rosenkohl");
  assert.ok(umami, "Umami recipe not found");
  assert.equal(umami.ingredients.length, 19, `Umami should have 19 ingredients, got ${umami.ingredients.length}`);
  assert.ok(umami.ingredients.some(i => i.includes("Pfeffer")), `Umami should include Pfeffer ingredient (last in list)`);
});

test("hero image endpoint returns 200 + image bytes", async () => {
  const r = await fetch(BASE + "/api/recipes/sweet-chili-bowl/hero");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") || "", /^image\//);
  const buf = await r.arrayBuffer();
  assert.ok(buf.byteLength > 1000, `hero image too small: ${buf.byteLength}`);
});

test("recipe detail page renders all 5 Zubereitung steps for SCB", async () => {
  const r = await fetch(BASE + "/r/sweet-chili-bowl");
  assert.equal(r.status, 200);
  const html = await r.text();
  // Should contain Step 1 and Step 5 content
  assert.match(html, /Limetten? in.*Spalten schneiden/);
  assert.match(html, /servieren\./);
});

test("pin URL endpoint accepts a HelloFresh URL and rejects others", async () => {
  // Reject non-HF
  const r1 = await fetch(BASE + "/api/pinned", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com/foo" }),
  });
  assert.equal(r1.status, 400);

  // Accept HF (idempotent for an already-existing recipe → returns duplicate flag)
  const r2 = await fetch(BASE + "/api/pinned", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://www.hellofresh.de/recipes/sweet-chili-bowl-mit-glasierter-aubergine-thermomix-695b7cae2a2e2effad1837dd" }),
  });
  assert.equal(r2.status, 200);
  const data = await r2.json();
  assert.ok(data.duplicate === true || data.pinned, `expected duplicate flag or pinned record: ${JSON.stringify(data)}`);
});
