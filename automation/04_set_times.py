"""Set Arbeitszeit (prep time) and Gesamtzeit (total time) on the current recipe.

These are the two icons (knife + clock) next to '4 Portionen' on the recipe header.
The modal has 3 tabs: Zubereitungszeit / Gesamtzeit / Portionsgröße.

Edit PREP_MIN / TOTAL_MIN below, then run.
"""
import pathlib, sys
import os
from playwright.sync_api import sync_playwright

# === EDIT THESE ===
PREP_MIN = 30     # Arbeitszeit in minutes (Räuchertofu Gyros-Art, 4P — HelloFresh PT30M)
TOTAL_MIN = 40    # Gesamtzeit in minutes (Räuchertofu Gyros-Art, 4P — 30 Min. Arbeit + ~10 Min. Ofen-Overlap)
# === END EDIT ===

USER_DATA = str(pathlib.Path.home() / "cookidoo-automation/profile")
STATE_FILE = pathlib.Path.home() / "cookidoo-automation/current_recipe.txt"


def click_visible(page, sel):
    for el in page.locator(sel).all():
        try:
            if el.is_visible():
                el.click(); return True
        except Exception: pass
    return False


def fill_time(page, minutes):
    inputs = page.locator("input[type='number']")
    visible_inputs = []
    for i in range(inputs.count()):
        try:
            if inputs.nth(i).is_visible():
                visible_inputs.append(inputs.nth(i))
        except Exception: pass
    if len(visible_inputs) < 2:
        print(f"  !! expected 2 visible number inputs, got {len(visible_inputs)}")
        return
    # Hours = 0
    visible_inputs[0].click(); page.keyboard.press("Control+A"); page.keyboard.press("Delete")
    visible_inputs[0].type("0", delay=30)
    # Minutes
    visible_inputs[1].click(); page.keyboard.press("Control+A"); page.keyboard.press("Delete")
    visible_inputs[1].type(str(minutes), delay=30)


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

        # Click the Arbeitszeit tile (it's a div, click via JS)
        page.evaluate("""() => {
            for (const el of document.querySelectorAll('.cr-recipe-settings-tiles__item')) {
                if ((el.textContent || '').includes('Arbeitszeit')) { el.click(); return; }
            }
        }""")
        page.wait_for_timeout(1500)

        # Tab 1: Zubereitungszeit (prep)
        print(f"Setting Zubereitungszeit = {PREP_MIN} min...")
        fill_time(page, PREP_MIN)
        page.wait_for_timeout(400)

        # Tab 2: Gesamtzeit (total)
        click_visible(page, "button:has-text('Gesamtzeit')")
        page.wait_for_timeout(700)
        print(f"Setting Gesamtzeit = {TOTAL_MIN} min...")
        fill_time(page, TOTAL_MIN)
        page.wait_for_timeout(400)

        # Save modal
        for b in page.locator("button:has-text('Bestätigen')").all():
            try:
                if b.is_visible(): b.click(); break
            except Exception: pass
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)
        print(f"Times set on recipe {recipe_id}.")
        ctx.close()


if __name__ == "__main__":
    main()
