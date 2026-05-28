"""Add tips/notes to the current Cookidoo recipe.

The tips field has its own per-field 'Bestätigen' BUTTON that must be clicked first,
before the global 'Bestätigen' ANCHOR at the top.

Format: plain text, ONE TIP PER LINE. Prefix each line with '— ' (em-dash + space)
for visual bullet effect — Cookidoo's view doesn't auto-bullet user tips, so
without the prefix the tips run together as a single paragraph block.

Edit TIPS below, then run.
"""
import pathlib, sys
import os
from playwright.sync_api import sync_playwright

# === EDIT THESE — one tip per line, prefix with '— ' for bullet effect ===
TIPS = (
    "— Kräuter VOR der Pasta im Mixtopf hacken — `5 Sek./Stufe 7` reicht für eine grobe, aromatische Würze. Wenn man die Reihenfolge umdreht (erst Pasta, dann Kräuter), klebt feuchte Pasta-Stärke in den Messern und das Kräuter-Hacken wird matschig.\n"
    "— Pasta IM MIXTOPF mit `13 Min./100 °C/Linkslauf/Stufe 1` — der Linkslauf rührt vorsichtig ohne die Fusilli zu zerschneiden. 1,5 l Wasser auf 540 g Pasta ist konservativ unter der Mixtopf-Max-Linie, damit's beim Aufkochen nicht überläuft.\n"
    "— 300 ml Kochwasser AUFFANGEN beim Abgießen — das stärkehaltige Wasser bindet die Sauce später cremig (Pasta-Wasser-Trick aus der italienischen Küche). Ein Glas unters Sieb stellen, fertig.\n"
    "— Kürbiskerne + Chili-Mix OHNE FETT trocken rösten — sonst werden die Kerne fettig statt knackig. Die Hitze allein bringt das ätherische Öl der Chili-Mischung heraus, dann ist das Topping schärfer.\n"
    "— Pilze in HEISSE, FETTE Pfanne — sonst geben sie Wasser ab und kochen statt zu bräunen. Margarine + Öl mischen: Öl verhindert das Verbrennen der Margarine, Margarine bringt Nuss-Note. Auch nicht zu viel auf einmal — die Pilze brauchen Platz.\n"
    "— Knoblauch + Kräuter ERST NACH 5 Min. Pilzbraten — sonst verbrennt der Knoblauch und schmeckt bitter. Kurz mitschwenken, 1 Min. genügt damit die Aromen sich verbinden.\n"
    "— Worcester Sauce ist Umami-Booster — 16 g klingt wenig, aber genau das ist gewollt. Mehr maskiert die Pilz-Eigennote. Vegane Worcester gibt's mittlerweile fast in jedem Supermarkt (Sanchon, Naturata, Edward & Sons).\n"
    "— Reste halten 2 Tage: Pasta und Sauce TRENNEN aufbewahren, sonst saugt die Pasta die Sauce auf und wird matschig. Beim Aufwärmen Sauce mit 2-3 EL Wasser oder Cuisine wieder lockern.\n"
    "\n"
    "Warum dieses Rezept als Cookidoo-Version hier liegt:\n"
    "Die HelloFresh-Karte sagt explizit „Thermomix kocht\" — also gibt's einen offiziellen Plan, das Gericht durch den TM zu jagen. In unserer Cookidoo-Version sitzen zwei interaktive Chips an genau den richtigen Stellen: `5 Sek./Stufe 7` für das Kräuterhacken (statt Wiegemesser), `13 Min./100 °C/Linkslauf/Stufe 1` für die Pasta (statt zweitem Topf auf dem Herd). Beide werden im Cookidoo-Render zu antippbaren Koch-Befehl-Chips, der Thermomix führt sie direkt aus.\n"
    "\n"
    "Original-Karte (HelloFresh):\n"
    "https://www.hellofresh.de/recipes/veganes-portobello-champignon-stroganoff-67dd36a6aaa74aa3f95880bf\n"
    "\n"
    "Toolkit (Open Source):\n"
    "Aus beliebigen Rezepten (HelloFresh-Karte, Kochbuch, Webseite) automatisch native-quality Cookidoo-Rezepte mit interaktiven Koch-Befehl-Chips machen:\n"
    "https://github.com/meintechblog/thermomix-master"
)
# === END EDIT ===

USER_DATA = str(pathlib.Path.home() / "cookidoo-automation/profile")
STATE_FILE = pathlib.Path.home() / "cookidoo-automation/current_recipe.txt"


def main():
    if not STATE_FILE.exists():
        sys.exit("Run 01_create_recipe.py first")
    recipe_id = STATE_FILE.read_text().strip()

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            USER_DATA, headless=os.environ.get('THERMOMIX_HEADLESS', '0') == '1',
            viewport={"width": 1500, "height": 950}, locale="de-DE",
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}/edit",
                  wait_until="domcontentloaded", timeout=60000)
        try: page.locator("#onetrust-accept-btn-handler").first.click(timeout=2000)
        except Exception: pass
        page.wait_for_timeout(2500)

        field = page.locator("textarea[name='hints']").first
        field.wait_for(state="visible", timeout=10000)
        field.scroll_into_view_if_needed()
        field.click()
        page.wait_for_timeout(300)
        field.fill(TIPS)
        page.wait_for_timeout(500)

        # Per-field save BUTTON (not anchor!)
        for b in page.locator("button:has-text('Bestätigen')").all():
            try:
                if b.is_visible(): b.click(); print("clicked per-field Bestätigen"); break
            except Exception: pass
        page.wait_for_timeout(2000)

        # Global save ANCHOR (visible one — not the mobile-only)
        for a in page.locator("a:has-text('Bestätigen')").all():
            try:
                if a.is_visible(): a.click(); break
            except Exception: pass
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)
        print("Tips saved.")
        ctx.close()


if __name__ == "__main__":
    main()
