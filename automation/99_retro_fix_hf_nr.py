"""Retro-fix: prepend the HelloFresh card number to the title + tips of existing recipes.

Reads RECIPES below, opens each recipe's edit page, prefixes the title with
`[#NN] ` and prepends `Karte #NN — <short-name>` as the first line of the
hints/tips block. Idempotent — re-runs are no-ops if the prefix is already there.

Run after closing every browser window that might use the same cookidoo profile.
"""
import os
import pathlib
import sys
from playwright.sync_api import sync_playwright

# === EDIT THESE — one entry per recipe to retro-fix ===
RECIPES = [
    {
        "slug": "veganes-portobello-champignon-stroganoff",
        "hf_nr": 33,
        "name_short": "Veganes Portobello-Champignon-Stroganoff",
        "cookidoo_id": "01KSMWEF8YNKG04Z4TTE9E72EA",
    },
    {
        "slug": "frische-sauerteig-pinsa-mit-aubergine",
        "hf_nr": 25,
        "name_short": "Frische Sauerteig-Pinsa mit Aubergine",
        "cookidoo_id": "01KRQ44JTZ8ETRE7N6PBB4Q0Q8",
    },
    {
        "slug": "raeuchertofu-gyros-art-mit-kartoffelsalat-und-zaziki",
        "hf_nr": 25,
        "name_short": "Räuchertofu-Gyros-Art mit Kartoffelsalat & Zaziki",
        "cookidoo_id": "01KSMJK60SXV36SCX77T7N5ZV6",
    },
]
# === END EDIT ===

USER_DATA = str(pathlib.Path.home() / "cookidoo-automation/profile")


def click_visible(page, sel: str) -> bool:
    for el in page.locator(sel).all():
        try:
            if el.is_visible():
                el.click()
                return True
        except Exception:
            pass
    return False


def get_input_value(page, selector: str) -> str:
    """Read the current value/content of an editable field."""
    el = page.locator(selector).first
    try:
        return el.input_value()
    except Exception:
        try:
            return el.inner_text()
        except Exception:
            return ""


def fix_one(page, r: dict) -> None:
    rid = r["cookidoo_id"]
    nr = r["hf_nr"]
    name_short = r["name_short"]
    title_prefix = f"[#{nr}] "
    tips_header = f"Karte #{nr} — {name_short}"

    print(f"\n=== {r['slug']} (#{nr}) ===")
    page.goto(
        f"https://cookidoo.de/created-recipes/de-DE/{rid}/edit",
        wait_until="domcontentloaded",
        timeout=60000,
    )
    try:
        page.locator("#onetrust-accept-btn-handler").first.click(timeout=2000)
    except Exception:
        pass
    page.wait_for_timeout(2500)

    # ── Title: inline edit (textarea.core-inline-input__input — the FIRST one on the page) ──
    title_el = page.locator("textarea.core-inline-input__input").first
    try:
        title_el.wait_for(state="attached", timeout=8000)
        title_el.scroll_into_view_if_needed()
        current_title = title_el.input_value()
        print(f"  current title: {current_title!r}")
        if current_title.startswith(title_prefix):
            print("  title already prefixed — skip")
        else:
            new_title = f"{title_prefix}{current_title}"
            title_el.click()
            page.wait_for_timeout(200)
            # Select all + clear (Meta+A on mac for Playwright Chromium, Ctrl+A fallback)
            page.keyboard.press("Meta+A")
            page.keyboard.press("Delete")
            page.wait_for_timeout(100)
            page.keyboard.type(new_title, delay=2)
            page.wait_for_timeout(400)
            print(f"  new title: {new_title!r}")
            # Inline edit usually saves on blur. Tab away.
            page.keyboard.press("Tab")
            page.wait_for_timeout(800)
            # If a confirm button is present, click it too
            click_visible(page, "button:has-text('Bestätigen')")
            page.wait_for_timeout(1200)
    except Exception as e:
        print(f"  !! title edit failed: {e}")

    # ── Tips: prepend "Karte #NN — name\n\n" if not already there ─────────
    hints = page.locator("textarea[name='hints']").first
    try:
        hints.wait_for(state="visible", timeout=8000)
    except Exception:
        print("  !! hints textarea not visible — skipping tips")
        return
    hints.scroll_into_view_if_needed()
    current_tips = ""
    try:
        current_tips = hints.input_value()
    except Exception:
        pass

    if current_tips.startswith(tips_header):
        print(f"  tips already prefixed — skip")
    else:
        new_tips = f"{tips_header}\n\n{current_tips}"
        hints.click()
        page.wait_for_timeout(300)
        hints.fill(new_tips)
        page.wait_for_timeout(400)
        click_visible(page, "button:has-text('Bestätigen')")
        page.wait_for_timeout(1500)
        print(f"  prepended tips header")

    # Global save at the bottom (anchor variant)
    for a in page.locator("a:has-text('Bestätigen')").all():
        try:
            if a.is_visible():
                a.click()
                break
        except Exception:
            pass
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass
    page.wait_for_timeout(2000)
    print("  ✓ saved")


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    targets = [r for r in RECIPES if (only is None or r["slug"] == only)]
    if not targets:
        sys.exit(f"no recipe matched '{only}'. Known slugs: {[r['slug'] for r in RECIPES]}")

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            USER_DATA,
            headless=os.environ.get("THERMOMIX_HEADLESS", "0") == "1",
            viewport={"width": 1500, "height": 950},
            locale="de-DE",
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        for r in targets:
            try:
                fix_one(page, r)
            except Exception as e:
                print(f"  ERROR on {r['slug']}: {e}")
        ctx.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
