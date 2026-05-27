"""Create a new Cookidoo Eigenes Rezept and fill in ingredients + plain-text steps.

EDIT THE THREE CONSTANTS at the top, then run.

After completion, the new recipe ID is stored in ~/cookidoo-automation/current_recipe.txt
for the rest of the pipeline (02_upload_image.py, 03_add_tips.py, 04_set_times.py,
05_annotate_chips.py).

CRITICAL CONSISTENCY RULES (learned from the first recipe iteration):
1. Each ingredient must appear at most 1x per step. The AI annotator marks the second
   occurrence as 'overuse' and the rendered chips look duplicated/messy.
   Bad:  '...unter kaltem Wasser spülen. 1200 g Wasser ...'   → 2x Wasser in same step
   Good: '...kurz abspülen. 1200 g Wasser ...'                → 1x Wasser
2. Avoid compound names that contain another ingredient as substring within the same step.
   Bad:  '50 g Sriracha-Sauce zu Sriracha-Mayo verrühren'     → 'Sriracha' matched twice
   Good: '50 g Sriracha-Sauce mit Mayo verrühren'             → 1x Sriracha-Sauce
3. Don't list a generic Salz amount AND a catch-all 'Salz, Pfeffer, Zucker, Öl nach Bedarf'
   in the ingredient list — pick one.

NATIVE-STYLE INSIGHTS (learned from deep-research of 12 Vorwerk recipes for Bowls/Currys):
- Native recipes for 14-17 ingredients have a MEDIAN of 5 steps (range 4-7), not 8.
- Group preparation + parallel tasks into a single 'In der Zwischenzeit ...' step.
- Use native verbs: 'einwiegen', 'mithilfe des Spatels herausnehmen', 'aufsetzen',
  'absetzen', 'einhängen', 'auf 4 Bowls verteilen', '... servieren'.
- Ingredient lines: shorter is better. '1 Limette, gewachst' (not '1 Limette, gewachst,
  in 6 Spalten geschnitten' — the verb belongs in the step text).
- Specify exact amounts ('2 TL Salz', '25 g Öl', '1-2 Prisen Pfeffer', '1 Prise Zucker')
  instead of a catch-all 'nach Bedarf' line — native recipes always do the former.
"""
import pathlib
import os
from playwright.sync_api import sync_playwright

# === EDIT THESE ===
RECIPE_NAME = "Vegane Filetstücke in thailändischer Orangensoße (HelloFresh)"

INGREDIENTS = [
    "320 g vegane Filetstücke, Hähnchen-Art",
    "2 Orangen",
    "50 g Frühlingszwiebel",
    "44 g Knoblauch-Ingwer-Zitronengras-Paste",
    "50 g Sweet-Chili-Soße",
    "36 g Hoisinsoße",
    "40 g Cashewkerne, geröstet",
    "20 g Sesamsamen",
    "20 g Thai-Basilikum, frisch",
    "600 g Stir-Fry Mix",
    "300 g Jasminreis",
    "700 g Wasser",
    "30 g Öl",
    "1 TL Salz",
    "1-2 Prisen Pfeffer",
]

# 5 native-style steps for 15 ingredients (within native range 4-7, median 5).
STEPS = [
    # 1 — Reis im Gareinsatz mit Paste-Topping (TTS-Chip 1: 18 Min./Varoma/Stufe 1)
    "700 g Wasser und 1 TL Salz in den Mixtopf einwiegen. 300 g Jasminreis in den Gareinsatz geben, 44 g Knoblauch-Ingwer-Zitronengras-Paste darauf verteilen und einhängen. 18 Min./Varoma/Stufe 1 garen.",
    # 2 — Vorbereitung Frühlingszwiebel + Thai-Basilikum (parallel zum Reis)
    "In der Zwischenzeit 50 g Frühlingszwiebel waschen und weißen sowie grünen Teil getrennt in feine Ringe schneiden. 20 g Thai-Basilikum von den Stielen zupfen und in feine Streifen schneiden.",
    # 3 — Orangen-Soße im Mixtopf (TTS-Chip 2: 5 Sek./Stufe 4)
    "2 Orangen halbieren, Saft auspressen und mit 36 g Hoisinsoße und 50 g Sweet-Chili-Soße im Mixtopf 5 Sek./Stufe 4 vermengen. Mit 1 Prise Pfeffer abschmecken und in eine kleine Schüssel umfüllen.",
    # 4 — Pfanne anbraten + ablöschen
    "In einer großen Pfanne 30 g Öl erhitzen. Weißen Teil der Frühlingszwiebel, 600 g Stir-Fry Mix und 320 g vegane Filetstücke darin 4-6 Min. goldbraun anbraten. Die Orangen-Mischung dazugießen und 2 Min. glänzend einköcheln lassen.",
    # 5 — Anrichten
    "Gareinsatz mithilfe des Spatels herausnehmen, Reis auflockern und auf 4 tiefe Teller verteilen. Stir-Fry-Mischung darauf anrichten und mit grünem Teil der Frühlingszwiebel, 40 g Cashewkerne, 20 g Sesamsamen und Thai-Basilikum bestreuen, sofort servieren.",
]
# === END EDIT ===

USER_DATA = str(pathlib.Path.home() / "cookidoo-automation/profile")
STATE_FILE = pathlib.Path.home() / "cookidoo-automation/current_recipe.txt"


def click_first_visible(page, selector):
    for el in page.locator(selector).all():
        try:
            if el.is_visible():
                el.click(); return True
        except Exception:
            pass
    return False


def main():
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            USER_DATA, headless=os.environ.get('THERMOMIX_HEADLESS', '0') == '1',
            viewport={"width": 1500, "height": 950}, locale="de-DE",
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://cookidoo.de/created-recipes/de-DE", wait_until="domcontentloaded", timeout=60000)
        try: page.locator("#onetrust-accept-btn-handler").first.click(timeout=2000)
        except Exception: pass
        page.wait_for_timeout(2500)

        # New UI (post-2026): "Rezept erstellen" sits in a dropdown behind the
        # green floating "+" button bottom-right. Open it first.
        page.locator("cr-floating-button#floating-button").click()
        page.wait_for_timeout(800)
        page.locator("button#create-button").click()
        page.wait_for_timeout(1200)

        # Fill recipe name and confirm via the modal's "Erstellen" button (exact match)
        page.fill("#recipe-title", RECIPE_NAME)
        page.wait_for_timeout(400)
        for b in page.locator("button:has-text('Erstellen')").all():
            try:
                if b.is_visible() and b.inner_text().strip() == "Erstellen":
                    b.click(); break
            except Exception: pass

        page.wait_for_load_state("networkidle", timeout=30000)
        page.wait_for_timeout(2000)
        recipe_id = page.url.rstrip("/").split("/")[-2]
        print(f"Created recipe: {recipe_id}")
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(recipe_id)

        page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}/edit/ingredients-and-preparation-steps?active=steps",
                  wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(2000)

        for sel in ["#add-ingredients", "button:has-text('Erste Zutat hinzufügen')"]:
            if click_first_visible(page, sel): break
        page.wait_for_timeout(500)

        print(f"Adding {len(INGREDIENTS)} ingredients...")
        for i, ing in enumerate(INGREDIENTS):
            print(f"  [{i+1}/{len(INGREDIENTS)}] {ing}")
            page.wait_for_selector("cr-manage-ingredients cr-text-field[contenteditable='true']", timeout=10000)
            fields = page.locator("cr-manage-ingredients cr-text-field[contenteditable='true']")
            target = None
            for j in range(fields.count()-1, -1, -1):
                try:
                    if fields.nth(j).is_visible(): target = fields.nth(j); break
                except Exception: pass
            if not target: continue
            target.click(); page.wait_for_timeout(150)
            page.keyboard.type(ing, delay=2); page.wait_for_timeout(100)
            page.keyboard.press("Enter"); page.wait_for_timeout(250)

        for sel in ["#add-steps", "button:has-text('Ersten Rezeptschritt hinzufügen')"]:
            if click_first_visible(page, sel): break
        page.wait_for_timeout(500)

        print(f"\nAdding {len(STEPS)} steps...")
        for i, step in enumerate(STEPS):
            print(f"  [{i+1}/{len(STEPS)}] {step[:60]}...")
            page.wait_for_selector("cr-manage-steps cr-text-field[contenteditable='true']", timeout=10000)
            fields = page.locator("cr-manage-steps cr-text-field[contenteditable='true']")
            target = None
            for j in range(fields.count()-1, -1, -1):
                try:
                    if fields.nth(j).is_visible(): target = fields.nth(j); break
                except Exception: pass
            if not target: continue
            target.click(); page.wait_for_timeout(150)
            page.keyboard.type(step, delay=1); page.wait_for_timeout(150)
            page.keyboard.press("Enter"); page.wait_for_timeout(300)

        page.wait_for_timeout(800)
        for a in page.locator("a:has-text('Bestätigen')").all():
            try:
                if a.is_visible(): a.click(); break
            except Exception: pass
        page.wait_for_load_state("networkidle", timeout=20000)
        page.wait_for_timeout(2000)
        print(f"\nDone. Recipe URL: https://cookidoo.de/created-recipes/de-DE/{recipe_id}")
        ctx.close()


if __name__ == "__main__":
    main()
