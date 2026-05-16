"""Optional: switch the current recipe to PUBLIC so anyone can open it.

⚠️ WARNING: Cookidoo will ask you to confirm that you own the recipe image rights.
   Do NOT publish if you used a third-party photo (e.g. HelloFresh, recipe book scan).

After publishing, the recipe is reachable at:
   https://cookidoo.de/created-recipes/public/recipes/de-DE/{recipeId}
"""
import pathlib, sys
import os
from playwright.sync_api import sync_playwright

USER_DATA = str(pathlib.Path.home() / "cookidoo-automation/profile")
STATE_FILE = pathlib.Path.home() / "cookidoo-automation/current_recipe.txt"


def main():
    if not STATE_FILE.exists():
        sys.exit("Run 01_create_recipe.py first")
    recipe_id = STATE_FILE.read_text().strip()

    # Non-interactive bypass for the thermomix-master skill (only flag we accept).
    if "--yes" in sys.argv:
        print(f"Publishing {recipe_id} to PUBLIC (--yes: image ownership confirmed by caller).")
    else:
        confirm = input(f"Publishing {recipe_id} to PUBLIC. Do you OWN the hero image? [yes/no] ").strip().lower()
        if confirm != "yes":
            sys.exit("Aborted. Re-upload your own image first (02_upload_image.py), then retry.")

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            USER_DATA, headless=os.environ.get('THERMOMIX_HEADLESS', '0') == '1',
            viewport={"width": 1500, "height": 950}, locale="de-DE",
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}",
                  wait_until="domcontentloaded", timeout=60000)
        try: page.locator("#onetrust-accept-btn-handler").first.click(timeout=2000)
        except Exception: pass
        page.wait_for_timeout(2500)

        resp = page.evaluate(f"""async () => {{
            const r = await fetch('/created-recipes/de-DE/{recipe_id}', {{
                method: 'PATCH',
                headers: {{'Content-Type': 'application/json', 'Accept': 'application/json'}},
                body: JSON.stringify({{workStatus: 'PUBLIC', isImageOwnedByUser: true}})
            }});
            return {{status: r.status, body: (await r.text()).slice(0, 1500)}};
        }}""")
        print(f"PATCH status: {resp['status']}")
        if resp['status'] == 200:
            print(f"\nPublic URL: https://cookidoo.de/created-recipes/public/recipes/de-DE/{recipe_id}")
        else:
            print("Response body:", resp['body'])

        page.wait_for_timeout(2000)
        ctx.close()


if __name__ == "__main__":
    main()
