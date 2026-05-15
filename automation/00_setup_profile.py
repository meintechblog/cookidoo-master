"""Open Cookidoo, let user log in manually, persist the profile for later runs.

Run ONCE before the rest of the pipeline. The persistent profile keeps your session
across all subsequent scripts so you don't have to re-login.
"""
import pathlib
from playwright.sync_api import sync_playwright

USER_DATA = str(pathlib.Path.home() / "cookidoo-automation/profile")
pathlib.Path(USER_DATA).mkdir(parents=True, exist_ok=True)


def main():
    print(f"Browser profile will be stored at: {USER_DATA}")
    print("Open the browser, log in to cookidoo.de, accept the OneTrust cookie banner.")
    print("Then close the window when done.\n")
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            USER_DATA, headless=False,
            viewport={"width": 1400, "height": 900}, locale="de-DE",
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://cookidoo.de/created-recipes/de-DE", wait_until="domcontentloaded")
        # Wait until user closes the window
        try:
            page.wait_for_event("close", timeout=600_000)  # 10 min
        except Exception:
            pass
        try:
            ctx.close()
        except Exception:
            pass
    print("Done. You can now run 01_create_recipe.py etc.")


if __name__ == "__main__":
    main()
