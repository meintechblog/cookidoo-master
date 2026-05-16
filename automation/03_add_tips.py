"""Add tips/notes to the current Cookidoo recipe.

The tips field has its own per-field 'Bestätigen' BUTTON that must be clicked first,
before the global 'Bestätigen' ANCHOR at the top.

Format: plain text, ONE TIP PER LINE. Prefix each line with '— ' (em-dash + space)
for visual bullet effect — Cookidoo's view doesn't auto-bullet user tips, so
without the prefix the tips run together as a single paragraph block.

Edit TIPS below, then run.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

# === EDIT THESE — one tip per line, prefix with '— ' for bullet effect ===
TIPS = (
    "— Süßkartoffeln IM VAROMA dampfgaren (statt im Ofen rösten) — der Mixtopf darunter macht parallel die Soße. Spart Energie + Zeit + Backblech, und 20 Min. Dampf reicht für 1 cm Würfel.\n"
    "— Tofu vor dem Braten ABTUPFEN (Küchentuch) — überschüssiges Wasser verhindert die goldbraune Kruste. Drücken bis er nicht mehr nass glänzt.\n"
    "— Chili-Mix ERST in den letzten 2 Min. zum Tofu — Chili-Pulver verbrennt schnell, dann wird's bitter. So bekommt der Tofu die Schärfe ohne Verbitterung.\n"
    "— Knoblauch-Ingwer-Zitronengras-Paste FRESH ist Gold wert — die HF-Tube ist Convenience. Wer's frisch macht: 4 Knoblauchzehen + 2 cm Ingwer + 1 EL gehacktes Zitronengras in den Mixtopf, 5 Sek./Stufe 7 vorab pürieren.\n"
    "— Linkslauf für den Grünkohl — kein Häckseln, der bleibt schön blattig. Bei Rechtslauf würde der Mixtopf den Kohl zerstören.\n"
    "— Limetten-Schärfe-Balance: Saft erst zum Schluss dazu, NICHT mitkochen — Hitze zerstört die fruchtige Säure und lässt nur Bitterkeit übrig.\n"
    "— Variation: 100 g Erdnussmus in die Soße (vor dem 20-Min.-Garen) für eine Satay-Curry-Variante. Oder 1 EL Currypaste rot/grün für Thai-Richtung.\n"
    "— Reste halten 2 Tage im Kühlschrank. Soße bindet beim Aufwärmen mehr — vor dem Servieren 50 ml Wasser oder Kokosmilch unterrühren.\n"
    "\n"
    "Warum dieses Rezept als Cookidoo-Version hier liegt:\n"
    "Die HelloFresh-Kreationen sind grandios — frisch, kreativ, jede Woche was Neues in der Box. Schade nur, dass die als \"Thermomix-Variante\" gelabelten Karten das Gerät bisher kaum nutzen: keine geführte Bedienung, keine Chips für Zeit/Temperatur/Stufe, kein Start aus Cookidoo. Bei diesem Rezept besonders ärgerlich, weil der Thermomix HIER seine Stärke voll ausspielen kann: Süßkartoffeln im Varoma dampfgaren, gleichzeitig die Currysoße im Mixtopf reduzieren — zwei sequentielle Pfannenschritte werden zu einem parallelen Thermomix-Schritt.\n"
    "\n"
    "Original-Karte (HelloFresh):\n"
    "https://www.hellofresh.de/recipes/ingwer-susskartoffel-eintopf-mit-tofu-68fa30ecff3933d87e3fe9d9\n"
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
            USER_DATA, headless=False,
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
