"""Upload a hero image to the current Cookidoo recipe.

Usage: python3 02_upload_image.py <path-to-image.jpg>
       (path defaults to ./recipes/{slug}/hero.jpg if first arg looks like a slug dir)
"""
import pathlib, sys
import os
from playwright.sync_api import sync_playwright

USER_DATA = str(pathlib.Path.home() / "cookidoo-automation/profile")
STATE_FILE = pathlib.Path.home() / "cookidoo-automation/current_recipe.txt"


def main():
    if not STATE_FILE.exists():
        sys.exit("Run 01_create_recipe.py first (no current_recipe.txt)")
    recipe_id = STATE_FILE.read_text().strip()

    if len(sys.argv) < 2:
        sys.exit("Usage: python3 02_upload_image.py <path-to-image>")
    arg = pathlib.Path(sys.argv[1]).expanduser().resolve()
    if arg.is_dir():
        arg = arg / "hero.jpg"
    if not arg.exists():
        sys.exit(f"Image not found: {arg}")

    print(f"Uploading {arg} → recipe {recipe_id}")

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
        page.wait_for_load_state("networkidle", timeout=15000)

        # Click the image-tile trigger (NOT the dropdown-menu "Bild hochladen" item)
        page.locator("button.cr-manage-image__trigger").first.wait_for(state="visible", timeout=10000)
        page.locator("button.cr-manage-image__trigger").first.click()
        page.wait_for_timeout(2500)

        # Set file on the cloudinary widget's hidden input (inside iframe)
        frame = next((f for f in page.frames if "cloudinary" in f.url), None)
        if not frame:
            sys.exit("Cloudinary upload iframe not found")
        frame.locator("input[type='file']").first.set_input_files(str(arg))
        page.wait_for_timeout(5000)

        # Confirm crop
        crop_btn = frame.locator("button:has-text('Zuschneiden')")
        for i in range(crop_btn.count()):
            try:
                if crop_btn.nth(i).is_visible():
                    crop_btn.nth(i).click(); break
            except Exception:
                pass
        page.wait_for_timeout(4000)

        # Save via the visible Bestätigen anchor
        for a in page.locator("a:has-text('Bestätigen')").all():
            try:
                if a.is_visible():
                    a.click(); break
            except Exception:
                pass
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)
        print("Image uploaded successfully.")
        ctx.close()


if __name__ == "__main__":
    main()
