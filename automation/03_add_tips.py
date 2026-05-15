"""Add tips/notes to the current Cookidoo recipe.

The tips field has its own per-field 'Bestätigen' BUTTON that must be clicked first,
before the global 'Bestätigen' ANCHOR at the top.

Edit TIPS below, then run.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

# === EDIT THESE ===
TIPS = (
    "• Aubergine 10 Min. vor dem Marinieren leicht salzen — zieht Bitterstoffe & Wasser raus, "
    "die Glasur haftet besser und sie wird außen knuspriger.\n\n"
    "• Reis VOR dem Garen im Gareinsatz unter kaltem Wasser spülen, bis das Wasser klar ist — "
    "weniger Stärke = lockerer, nicht klebriger Reis.\n\n"
    "• Bohnen im Mixtopf unbedingt im Linkslauf dünsten, sonst werden sie zerhäckselt.\n\n"
    "• Sesamöl erst nach dem Garen unterheben (nicht miterhitzen) — sonst verfliegt das Röstaroma.\n\n"
    "• Schärfe getrennt servieren: Chili-Ringe und Sriracha-Mayo separat reichen, dann kann jeder "
    "selbst dosieren — vor allem für Kids/Empfindliche.\n\n"
    "• Mise en place lohnt sich: Gemüse vorab schnippeln, Dips anrühren — die Thermomix-Schritte "
    "(Reis dampfgaren + Aubergine im Ofen) laufen parallel, dann gibt's keine Pausen.\n\n"
    "• Variation: Tofu in Würfeln statt Aubergine glasieren (gleiche Marinade, 12 Min. bei 200 °C). "
    "Oder Edamame zusätzlich zu den Buschbohnen mit dampfgaren — mehr Protein.\n\n"
    "• Reste halten 2 Tage im Kühlschrank. Dips und Gurkensalat IMMER separat aufbewahren. "
    "Aubergine vorm Servieren kurz in der Pfanne aufwärmen, dann wird sie wieder knusprig."
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
                if b.is_visible():
                    b.click(); print("clicked per-field Bestätigen"); break
            except Exception:
                pass
        page.wait_for_timeout(2000)

        # Global save ANCHOR
        for a in page.locator("a:has-text('Bestätigen')").all():
            try:
                if a.is_visible():
                    a.click(); break
            except Exception:
                pass
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)
        print("Tips saved.")
        ctx.close()


if __name__ == "__main__":
    main()
