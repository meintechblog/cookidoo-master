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
    "— „Hello Curry\" direkt mit dem Reis vermengen (nicht ins Wasser) — die Aromen haften am Reis und färben ihn schön gelb, statt im Wasser verloren zu gehen.\n"
    "— Reis VOR dem Garen im Gareinsatz unter dem Hahn klar abspülen — weniger Stärke = lockerer, nicht klebriger Reis.\n"
    "— Tomatenmark mit Öl anbraten, BEVOR Gemüse dazukommt — entfaltet erst dadurch das volle Umami-Aroma. 60-90 Sek. bei mittlerer Hitze reichen.\n"
    "— Filetstücke mit Mehl bestäuben vor dem Braten — die Stärke karamellisiert in der Pfanne und gibt eine schöne goldbraune Kruste plus etwas mehr „Biss\".\n"
    "— Pürieren NUR 10 Sek./Stufe 6 — die Würzpaste soll stückig bleiben, nicht zu Soße werden. Lieber kürzer und nachschauen.\n"
    "— Schärfe-Kontrolle: Wenn die Chili-Pürée im Mixtopf landet, verteilt sich die Schärfe gleichmäßig — schwer zu dosieren. Bei Kids/Empfindlichen: nur die halbe Chilischote in die Paste, den Rest separat reichen.\n"
    "— Variation: Tofu in Würfeln (180 g) statt Planted-Filetstücke — gleiche Mehl-Methode, 6-7 Min. braten. Oder Tempeh für noch mehr Protein.\n"
    "— Reste: max. 1 Tag im Kühlschrank. Reis und Pfanne getrennt aufbewahren, in der Pfanne mit 1 Schuss Wasser aufwärmen, damit die Soße nicht eindickt.\n"
    "\n"
    "Warum dieses Rezept als Cookidoo-Version hier liegt:\n"
    "Die HelloFresh-Kreationen sind grandios — frisch, kreativ, jede Woche was Neues in der Box. Schade nur, dass die als \"Thermomix-Variante\" gelabelten Karten das Gerät bisher kaum nutzen: keine geführte Bedienung, keine Chips für Zeit/Temperatur/Stufe, kein Start aus Cookidoo. Also habe ich die Karte in echtes Thermomix-Wording übersetzt (einwiegen, einhängen, aufsetzen, dampfgaren, pürieren statt generischem \"Wasser dazu & kochen\") und die Koch-Befehle als interaktive Chips eingebaut — damit das Rezept auf dem Thermomix läuft wie ein originales Vorwerk-Rezept: einmal antippen, und die Maschine führt durch jeden Schritt.\n"
    "\n"
    "Original-Karte (HelloFresh):\n"
    "https://www.hellofresh.de/recipes/nasi-goreng-mit-veganen-filetstucken-64e461d2e1f123211ed56789\n"
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
