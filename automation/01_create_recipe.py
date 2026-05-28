"""Create a new Cookidoo Eigenes Rezept and fill in ingredients + plain-text steps.

EDIT THE THREE CONSTANTS at the top, then run.

After completion, the new recipe ID is stored in ~/thermomix-automation/current_recipe.txt
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

NATIVE-STYLE INSIGHTS (rewritten 2026-05-28 after analysing the real per-step
segmentation of ~12 Cookidoo recipes — see skill references/native-style-rules.md):
- ONE operation per step. Never two cooking chips in one step.
- Steps are SHORT: ~40-130 chars (native median ≈ 90). The old "median 5 steps /
  250-550 chars" rule was WRONG and produced mega-steps. Step count = number of
  operations (typically 6-10), NOT ingredient count.
- Add ingredients INCREMENTALLY — each ingredient with its amount in the step where
  it's used, in machine order. Don't dump 6 ingredients into one step.
- Let the MACHINE do the prep: chop onions/garlic/herbs/olives/mushrooms in the
  Mixtopf with a chip. Manual prep only when unavoidable, folded into a running
  machine step via 'Währenddessen ...'.
- Whole units, no fraction ambiguity: scaling a 'half/half' split → write whole units
  ('1 Gurke raspeln' / '1 Gurke würfeln'), never 'die eine Hälfte / die andere Hälfte'.
- Use native verbs: 'einwiegen', 'mit dem Spatel nach unten schieben', 'umfüllen',
  'aufsetzen', 'einhängen', 'auf 4 Bowls verteilen', '... servieren'.
- Specify exact amounts ('2 TL Salz', '25 g Öl', '1 Prise Pfeffer'), never 'nach Bedarf'.
"""
import pathlib
import os
from playwright.sync_api import sync_playwright

# === EDIT THESE ===
RECIPE_NAME = "Veganes Portobello-Champignon-Stroganoff auf Fusilli mit Kürbiskern-Chili-Topping (HelloFresh)"

INGREDIENTS = [
    "540 g Fusilli",
    "4 Portobello-Pilze",
    "400 g Champignons",
    "2 Zwiebeln",
    "4 Knoblauchzehen",
    "10 g Petersilie, glatt",
    "10 g Thymian, frisch",
    "2 g milder Chili-Mix",
    "2 Zitronen, gewachst",
    "500 ml Oatly Bio Cuisine",
    "50 g Pilzbrühepaste",
    "20 g Kürbiskerne, geröstet",
    "16 g Worcester Sauce",
    "30 g Öl",
    "50 g pflanzliche Margarine",
    "2 TL Salz",
    "1 Prise Pfeffer",
]

# 5 native-style steps for 17 ingredients (within native range 4-7, median 5).
STEPS = [
    # 1 — Vorbereitung
    "2 Zitronen heiß abwaschen und jeweils in 4 Spalten schneiden. 2 Zwiebeln grob würfeln. 4 Portobello-Pilze in 0,5 cm Scheiben schneiden. 400 g Champignons je nach Größe halbieren oder vierteln. 10 g Petersilie und 10 g Thymian von den Stielen zupfen.",
    # 2 — Kräuter hacken im Mixtopf (TTS-Chip 1: 5 Sek./Stufe 7)
    "Petersilien- und Thymianblätter in den Mixtopf einwiegen und 5 Sek./Stufe 7 hacken. In eine kleine Schüssel umfüllen, Mixtopf spülen.",
    # 3 — Pasta im Mixtopf (TTS-Chip 2: 13 Min./100 °C/Linkslauf/Stufe 1)
    "1,5 l Wasser und 2 TL Salz in den Mixtopf einwiegen. 540 g Fusilli hinzugeben und 13 Min./100 °C/Linkslauf/Stufe 1 garen. Anschließend Pasta in einem Sieb abgießen und dabei 300 ml Kochwasser auffangen.",
    # 4 — Topping rösten + Pilze anbraten in der Pfanne
    "In einer großen Pfanne ohne Fett 20 g Kürbiskerne und 2 g milden Chili-Mix 2-3 Min. rösten, herausnehmen und beiseite stellen. Pfanne auswischen, 30 g Öl und 50 g pflanzliche Margarine erhitzen. Zwiebelwürfel, Portobello und Champignons 5-6 Min. kräftig anbraten. 4 Knoblauchzehen hineinpressen, die Hälfte der gehackten Kräuter dazu, 1 Min. mitbraten.",
    # 5 — Sauce + Anrichten
    "Mit 300 ml Pastakochwasser, 500 ml Oatly Bio Cuisine, 50 g Pilzbrühepaste, 16 g Worcester Sauce und dem Saft von 2 Zitronenspalten ablöschen, 2-3 Min. cremig einköcheln lassen. Mit 1 Prise Pfeffer abschmecken. Fusilli auf 4 tiefe Teller verteilen, Pilz-Stroganoff daneben anrichten und mit Kürbis-Chili-Topping, restlichen Kräutern und Zitronenspalten servieren.",
]
# === END EDIT ===

USER_DATA = str(pathlib.Path.home() / "thermomix-automation/profile")
STATE_FILE = pathlib.Path.home() / "thermomix-automation/current_recipe.txt"


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
