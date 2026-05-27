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
    "— Drillinge HALBIEREN oder VIERTELN je nach Größe — gleichmäßige Stückgröße ist wichtiger als Form. Zu große Stücke brauchen 35-40 Min., kleine sind in 22 Min. fertig. Wenn unsicher: nach 22 Min. eine probieren, dann nachsteuern.\n"
    "— Gurke ENTKERNEN nicht überspringen — die wässrigen Kerne machen Zaziki + Salat dünn und matschig. Mit einem Teelöffel die Kerne von der Schnittfläche her ausschaben, geht in 20 Sek.\n"
    "— Geraspelte Gurke vor dem Mixen LEICHT AUSDRÜCKEN — sonst wird das Zaziki zu wässrig. Sieb + Hand reicht, nicht mit Salz schummeln (zieht zuviel Wasser).\n"
    "— Räuchertofu IN SCHEIBEN (nicht Würfel) — die größere Oberfläche bringt mehr Maillard-Bräunung in 4-5 Min., genau das was Gyros-Style braucht. Wenn er beim Hobeln auseinanderfällt: kein Drama, geht in die Pfanne wie er ist.\n"
    "— Sojasoße als Gyros-Trick: zum Schluss in die heiße Pfanne — das ablöschende Verdampfen umhüllt die Tofuscheiben mit einer glänzenden Souflaki-Marinade. Genau so macht es das HelloFresh-Original.\n"
    "— „Hello Souflaki\" DRITTELN: ein Drittel an die Kartoffeln (vor dem Backen), zwei Drittel zum Tofu (gegen Ende der Pfannenphase). So bekommen beide Komponenten ihre eigene Würz-Note.\n"
    "— Statt Räuchertofu funktioniert auch Seitan-Gyros oder Halloumi (nicht vegan dann) — gleich anbraten, gleich ablöschen.\n"
    "— Reste halten 2 Tage: Zaziki getrennt vom Kartoffelsalat aufbewahren (Mayo-basierter Dip verträgt das Mariniertsein vom Dressing schlecht). Tofu am nächsten Tag kurz in der Pfanne aufknuspern.\n"
    "\n"
    "Warum dieses Rezept als Cookidoo-Version hier liegt:\n"
    "Die HelloFresh-Kreationen sind grandios — frisch, kreativ, jede Woche was Neues in der Box. Bei dieser Karte gibt es noch nicht mal eine offizielle Thermomix-Variante, obwohl das Gerät hier zwei Schritte massiv beschleunigen kann: das Zaziki entsteht im Mixtopf in 30 Sek. statt mit Schneebesen + Handarbeit, und die Kräuter-Oliven-Mischung fürs Dressing wird in 5 Sek. statt mit dem Messer gehackt. Drei interaktive Koch-Befehl-Chips (`30 Sek./Stufe 3`, `3 Sek./Stufe 7`, `2 Sek./Stufe 5`) — antippen, Thermomix führt aus.\n"
    "\n"
    "Original-Karte (HelloFresh):\n"
    "https://www.hellofresh.de/recipes/souflaki-rauchertofu-mit-kartoffelsalat-and-zaziki-64e860a94e40d5c6cb1a53fe\n"
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
