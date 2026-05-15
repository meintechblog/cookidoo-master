"""Delete ALL existing steps and replace with a fresh native-style list.

Use this if 01_create_recipe.py left chunky/wrong steps (e.g. titles got split
into separate steps due to embedded newlines).

Edit STEPS list below, then run.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

# === EDIT THESE ===
STEPS = [
    "Limette in 6 Spalten schneiden. Aubergine längs vierteln und in ca. 2 cm Stücke schneiden. Backofen auf 220 °C Ober-/Unterhitze (200 °C Umluft) vorheizen.",
    # ... siehe 01_create_recipe.py
]
# === END EDIT ===

USER_DATA = str(pathlib.Path.home() / "cookidoo-automation/profile")
STATE_FILE = pathlib.Path.home() / "cookidoo-automation/current_recipe.txt"


def click_visible(page, sel):
    loc = page.locator(sel)
    for i in range(loc.count()):
        try:
            if loc.nth(i).is_visible():
                loc.nth(i).click(); return True
        except Exception: pass
    return False


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
        page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}/edit/ingredients-and-preparation-steps?active=steps",
                  wait_until="domcontentloaded", timeout=60000)
        try: page.locator("#onetrust-accept-btn-handler").first.click(timeout=2000)
        except Exception: pass
        page.wait_for_timeout(2500)

        # Delete all existing steps
        print("Deleting existing steps...")
        while True:
            menu_btns = page.locator("cr-manage-steps button.cr-manage-list__menu-button")
            target = None
            for i in range(menu_btns.count()):
                try:
                    if menu_btns.nth(i).is_visible():
                        target = menu_btns.nth(i); break
                except Exception: pass
            if not target: break
            target.click()
            page.wait_for_timeout(350)
            if not click_visible(page, "button:has-text('Rezeptschritt löschen')"):
                break
            page.wait_for_timeout(500)

        page.wait_for_timeout(800)

        # Open empty state
        for sel in ["#add-steps", "button:has-text('Ersten Rezeptschritt hinzufügen')"]:
            if click_visible(page, sel): break
        page.wait_for_timeout(500)

        # Insert fresh steps
        print(f"Adding {len(STEPS)} steps...")
        for i, step in enumerate(STEPS):
            print(f"  [{i+1}/{len(STEPS)}] {step[:60]}...")
            page.wait_for_selector("cr-manage-steps cr-text-field[contenteditable='true']", timeout=10000)
            fields = page.locator("cr-manage-steps cr-text-field[contenteditable='true']")
            target = None
            for j in range(fields.count()-1, -1, -1):
                try:
                    if fields.nth(j).is_visible():
                        target = fields.nth(j); break
                except Exception: pass
            if not target: break
            target.click()
            page.wait_for_timeout(150)
            page.keyboard.type(step, delay=1)
            page.wait_for_timeout(150)
            page.keyboard.press("Enter")
            page.wait_for_timeout(300)

        page.wait_for_timeout(800)
        for a in page.locator("a:has-text('Bestätigen')").all():
            try:
                if a.is_visible(): a.click(); break
            except Exception: pass
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)
        print("Steps replaced.")
        ctx.close()


if __name__ == "__main__":
    main()
