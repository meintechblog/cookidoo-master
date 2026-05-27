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
    "— Jasminreis IM GAREINSATZ statt Topf — die Knoblauch-Ingwer-Zitronengras-Paste obendrauf schmilzt mit dem Dampf in den Reis ein und gibt ihm seine Würze. Genau wie Vorwerks aromatisiertes-Reis-Pattern.\n"
    "— Frühlingszwiebel WEISS getrennt von GRÜN — Weiß wird angebraten (Zwiebelschärfe weg), Grün roh als Topping (frische Schärfe, knackige Textur). Niemals zusammenwerfen.\n"
    "— Stir-Fry Mix in HEISSE Pfanne — Wok-Hitze ist entscheidend. Wenn die Pfanne nicht raucht beim Einlegen, wird's Gemüse-Eintopf statt Stir-Fry. Lieber kürzer (4-5 Min.) und scharf als länger und lasch.\n"
    "— Filetstücke ERST GANZ ZUM SCHLUSS umrühren — die brauchen nur 3-4 Min. um goldbraun zu werden. Wenn man sie zu früh wendet, lösen sich die Maillard-Krusten an der Pfanne.\n"
    "— Orangen-Mischung erst NACH dem Anbraten dazu — sonst dämpft die Flüssigkeit das Gemüse statt zu glasieren. Das ist der sticky-Effekt im Original-Titel: die Zucker karamellisieren beim Reduzieren auf den Filetstücken.\n"
    "— Cashew + Sesam erst am Tisch dazu — beide ziehen schnell Feuchtigkeit aus der Soße und verlieren Knack. Im trockenen Schälchen separat zum Bestreuen reichen.\n"
    "— Thai-Basilikum hat einen ANISARTIGEN Geschmack (anders als italienischer Basilikum) — nicht ersetzen falls möglich. Wenn nicht aufzutreiben: Koriandergrün ist eine ähnlich-frische Alternative, mediterraner Basilikum NICHT (passt nicht zur Hoisin-Note).\n"
    "— Reste halten 2 Tage: Soße bindet stärker, dann mit 1-2 EL Wasser oder Orangensaft beim Aufwärmen wieder lockern. Reis trennen vom Stir-Fry — sonst wird er matschig.\n"
    "\n"
    "Warum dieses Rezept als Cookidoo-Version hier liegt:\n"
    "Die HelloFresh-Kreationen sind grandios — frisch, kreativ, jede Woche was Neues in der Box. Bei dieser Karte gibt es noch nicht mal eine offizielle Thermomix-Variante, obwohl der Thermomix hier zwei Hauptschritte parallel erledigen kann: Jasminreis dampft im Gareinsatz mit der Knoblauch-Ingwer-Zitronengras-Paste obendrauf, gleichzeitig wird die Orangen-Mischung im Mixtopf in 5 Sek. statt mit dem Schneebesen vermengt. Zwei interaktive Koch-Befehl-Chips (`18 Min./Varoma/Stufe 1`, `5 Sek./Stufe 4`) — antippen, Thermomix führt aus.\n"
    "\n"
    "Original-Karte (HelloFresh):\n"
    "https://www.hellofresh.at/recipes/orange-chicken-vegan-68ac617f7e1f6c64ca682316\n"
    "\n"
    "Toolkit (Open Source):\n"
    "Aus beliebigen Rezepten (HelloFresh-Karte, Kochbuch, Webseite) automatisch native-quality Cookidoo-Rezepte mit interaktiven Koch-Befehl-Chips machen:\n"
    "https://github.com/meintechblog/cookidoo-master"
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
