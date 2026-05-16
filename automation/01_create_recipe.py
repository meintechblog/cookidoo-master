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
from playwright.sync_api import sync_playwright

# === EDIT THESE ===
RECIPE_NAME = "Nasi Goreng mit veganen Filetstücken (HelloFresh)"

INGREDIENTS = [
    "300 g Basmatireis",
    "2 Karotten",
    "4 Schalotten",
    "2 rote Spitzpaprikas",
    "2 rote Chilischoten, frisch",
    "2 Limetten, gewachst",
    "4 g Gewürzmischung „Hello Curry\"",
    "320 g Planted vegane Filetstücke Hähnchen-Art, Kräuter-Zitrone",
    "140 g Tomatenmark",
    "36 g Ketjap Manis",
    "50 g Sojasoße",
    "40 g Erdnüsse, geröstet und gesalzen",
    "1200 g Wasser",
    "100 g Öl",
    "20 g Mehl",
    "2 TL Salz",
    "1-2 Prisen Pfeffer",
]

# 6 native-style steps (within native range 4-7 for 17-ingredient recipes).
# 6 statt 5 weil die Pfannen-Phase Öl 2x braucht — Per-Step-Uniqueness sauber via Split.
# Cooking commands embedded as plain text in the format the AI annotator recognizes:
#   "18 Min./Varoma/Stufe 1"  or  "10 Sek./Stufe 6"
# Script 05_annotate_chips.py converts them to interactive chips.
#
# Per-step uniqueness + cross-step adjacent endings validated.
STEPS = [
    # 1 — Vorbereitung (alles schneiden)
    "Limetten in 8 Spalten schneiden. Schalotten halbieren und in feine Streifen schneiden. Karotten schälen, längs vierteln und fein würfeln. Spitzpaprikas halbieren, entkernen und in feine Streifen schneiden. Chilischoten (Achtung: scharf!) halbieren, nach Belieben entkernen und fein hacken.",
    # 2 — Reis dampfgaren (Thermomix)
    "Gareinsatz einhängen, Basmatireis einwiegen und kurz abspülen. 4 g „Hello Curry\"-Gewürzmischung darüberstreuen und vermengen. Gareinsatz einsetzen. 900 g Wasser, 1 TL Salz und 5 g Öl in den Mixtopf geben und 18 Min./Varoma/Stufe 1 dampfgaren. Gareinsatz mithilfe des Spatels herausnehmen und abgedeckt 5 Min. ruhen lassen.",
    # 3 — Würzpaste pürieren (Thermomix)
    "Mixtopf leeren. Die Hälfte der Schalottenstreifen, 140 g Tomatenmark, Chilischoten, Saft von 4 Limettenspalten, 60 g Öl, 1 TL Salz und 1 Prise Pfeffer in den Mixtopf geben und 10 Sek./Stufe 6 zu einer stückigen Masse pürieren. In eine Schüssel umfüllen.",
    # 4 — Filetstücke braten (Pfanne)
    "In einer großen Pfanne 20 g Öl erhitzen. Vegane Filetstücke mit 20 g Mehl bestäuben, in die Pfanne geben und 5-6 Min. rundherum goldbraun braten. Herausnehmen und beiseitestellen.",
    # 5 — Gemüse + Sauce (Pfanne)
    "Erneut 20 g Öl in der Pfanne erhitzen. Würzpaste aus Schritt 3 dazugeben und 1 Min. anbraten. Restliche Schalottenstreifen, Karotten und Paprika dazugeben und 4-5 Min. mitbraten. Filetstücke, 36 g Ketjap Manis und 50 g Sojasoße dazugeben und 1 Min. mitbraten. Mit 300 g Wasser ablöschen und 3-4 Min. köcheln lassen, bis die Soße eindickt. Mit Pfeffer abschmecken.",
    # 6 — Anrichten
    "Reis mit einer Gabel auflockern und auf 4 tiefe Teller verteilen. Nasi-Pfanne daneben anrichten, mit 40 g Erdnüssen toppen und mit den restlichen Limettenspalten servieren.",
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
            USER_DATA, headless=False,
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
