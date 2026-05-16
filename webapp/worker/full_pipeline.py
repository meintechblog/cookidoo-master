#!/usr/bin/env python3
"""Full end-to-end pipeline driven from JSON input — used by the worker.

Reads recipe JSON from stdin:
{
  "recipe_name": "Foo Bar (HelloFresh)",
  "ingredients": ["300 g Reis", ...],
  "steps": ["Limetten in 6 Spalten ...", ...],
  "tips_text": "— Tipp 1\n— Tipp 2\n\nWarum dieses Rezept ...\n",
  "prep_min": 30,
  "total_min": 40,
  "image_path": "/opt/cookidoo-master/recipes/<slug>/hero.jpg",  // optional
  "publish": false  // set true to also run 02_upload_image + 06_publish
}

Writes result JSON to stdout:
{ "recipe_id": "01...", "public_url": "...", "actions": ["created", "tipped", "timed", "annotated", "image-uploaded", "published"] }

Pipeline phases:
  01 — create recipe (name + ingredients + plain-text steps)
  03 — add tips
  04 — set times
  05 — annotate chips
  02 — upload image  (only if image_path + publish)
  06 — publish       (only if publish)

Headless always (env var THERMOMIX_HEADLESS=1 set by caller — required on LXC).
"""
import os, sys, json, pathlib, time
from playwright.sync_api import sync_playwright

USER_DATA = str(pathlib.Path.home() / "cookidoo-automation/profile")
STATE_FILE = pathlib.Path.home() / "cookidoo-automation/current_recipe.txt"
HEADLESS = os.environ.get("THERMOMIX_HEADLESS", "1") == "1"


def log(msg):
    print(f"[pipeline] {msg}", file=sys.stderr, flush=True)


def click_first_visible(page, selector, timeout=5000):
    for el in page.locator(selector).all():
        try:
            if el.is_visible():
                el.click(); return True
        except Exception: pass
    return False


def dismiss_cookies(page):
    try: page.locator("#onetrust-accept-btn-handler").first.click(timeout=2000)
    except Exception: pass


# ─── 01 — create recipe ──────────────────────────────────────────────
def create_recipe(page, name, ingredients, steps):
    log(f"01_create: {name}")
    page.goto("https://cookidoo.de/created-recipes/de-DE", wait_until="domcontentloaded", timeout=60000)
    dismiss_cookies(page); page.wait_for_timeout(2500)

    page.locator("cr-floating-button#floating-button").click()
    page.wait_for_timeout(800)
    page.locator("button#create-button").click()
    page.wait_for_timeout(1200)

    page.fill("#recipe-title", name)
    page.wait_for_timeout(400)
    for b in page.locator("button:has-text('Erstellen')").all():
        try:
            if b.is_visible() and b.inner_text().strip() == "Erstellen":
                b.click(); break
        except Exception: pass

    page.wait_for_load_state("networkidle", timeout=30000)
    page.wait_for_timeout(2000)
    recipe_id = page.url.rstrip("/").split("/")[-2]
    log(f"  recipe id: {recipe_id}")
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(recipe_id)

    page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}/edit/ingredients-and-preparation-steps?active=steps",
              wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(2000)

    for sel in ["#add-ingredients", "button:has-text('Erste Zutat hinzufügen')"]:
        if click_first_visible(page, sel): break
    page.wait_for_timeout(500)

    for i, ing in enumerate(ingredients):
        page.wait_for_selector("cr-manage-ingredients cr-text-field[contenteditable='true']", timeout=10000)
        fields = page.locator("cr-manage-ingredients cr-text-field[contenteditable='true']")
        target = None
        for j in range(fields.count()-1, -1, -1):
            try:
                if fields.nth(j).is_visible(): target = fields.nth(j); break
            except Exception: pass
        if not target: continue
        target.click(); page.wait_for_timeout(150)
        page.keyboard.type(ing, delay=2); page.wait_for_timeout(80)
        page.keyboard.press("Enter"); page.wait_for_timeout(200)

    for sel in ["#add-steps", "button:has-text('Ersten Rezeptschritt hinzufügen')"]:
        if click_first_visible(page, sel): break
    page.wait_for_timeout(500)

    for i, step in enumerate(steps):
        page.wait_for_selector("cr-manage-steps cr-text-field[contenteditable='true']", timeout=10000)
        fields = page.locator("cr-manage-steps cr-text-field[contenteditable='true']")
        target = None
        for j in range(fields.count()-1, -1, -1):
            try:
                if fields.nth(j).is_visible(): target = fields.nth(j); break
            except Exception: pass
        if not target: continue
        target.click(); page.wait_for_timeout(150)
        page.keyboard.type(step, delay=1); page.wait_for_timeout(120)
        page.keyboard.press("Enter"); page.wait_for_timeout(250)

    page.wait_for_timeout(800)
    for a in page.locator("a:has-text('Bestätigen')").all():
        try:
            if a.is_visible(): a.click(); break
        except Exception: pass
    page.wait_for_load_state("networkidle", timeout=20000)
    page.wait_for_timeout(2000)
    return recipe_id


# ─── 99 — replace steps on an existing recipe ────────────────────────
def replace_steps(page, recipe_id, steps):
    """Delete every existing step on a recipe and insert a fresh list.
    Used when the user wants to update the wording of a live recipe
    without re-creating it (preserves recipe_id + public URL + image).
    Logic ported from automation/99_replace_steps_helper.py.
    """
    log(f"99_replace_steps on {recipe_id}: {len(steps)} new steps")
    page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}/edit/ingredients-and-preparation-steps?active=steps",
              wait_until="domcontentloaded", timeout=60000)
    dismiss_cookies(page); page.wait_for_timeout(2500)

    # Delete every existing step via the per-row dropdown menu.
    deleted = 0
    while True:
        menu_btns = page.locator("cr-manage-steps button.cr-manage-list__menu-button")
        target = None
        for i in range(menu_btns.count()):
            try:
                if menu_btns.nth(i).is_visible():
                    target = menu_btns.nth(i); break
            except Exception: pass
        if not target: break
        target.click(); page.wait_for_timeout(350)
        if not click_first_visible(page, "button:has-text('Rezeptschritt löschen')"):
            break
        page.wait_for_timeout(500)
        deleted += 1
        if deleted > 50: break  # sanity cap

    log(f"  deleted {deleted} existing steps")
    page.wait_for_timeout(800)

    # Open the empty-state to start adding fresh steps.
    for sel in ["#add-steps", "button:has-text('Ersten Rezeptschritt hinzufügen')"]:
        if click_first_visible(page, sel): break
    page.wait_for_timeout(500)

    for i, step in enumerate(steps):
        page.wait_for_selector("cr-manage-steps cr-text-field[contenteditable='true']", timeout=10000)
        fields = page.locator("cr-manage-steps cr-text-field[contenteditable='true']")
        target = None
        for j in range(fields.count() - 1, -1, -1):
            try:
                if fields.nth(j).is_visible(): target = fields.nth(j); break
            except Exception: pass
        if not target: continue
        target.click(); page.wait_for_timeout(150)
        page.keyboard.type(step, delay=1); page.wait_for_timeout(120)
        page.keyboard.press("Enter"); page.wait_for_timeout(250)

    page.wait_for_timeout(800)
    for a in page.locator("a:has-text('Bestätigen')").all():
        try:
            if a.is_visible(): a.click(); break
        except Exception: pass
    page.wait_for_load_state("networkidle", timeout=20000)
    page.wait_for_timeout(2000)
    return deleted


# ─── 03 — tips ───────────────────────────────────────────────────────
def add_tips(page, recipe_id, tips_text):
    log(f"03_tips on {recipe_id}")
    page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}/edit",
              wait_until="domcontentloaded", timeout=60000)
    dismiss_cookies(page); page.wait_for_timeout(2500)

    field = page.locator("textarea[name='hints']").first
    field.wait_for(state="visible", timeout=10000)
    field.scroll_into_view_if_needed()
    field.click()
    page.wait_for_timeout(300)
    field.fill(tips_text)
    page.wait_for_timeout(500)

    for b in page.locator("button:has-text('Bestätigen')").all():
        try:
            if b.is_visible(): b.click(); break
        except Exception: pass
    page.wait_for_timeout(2000)
    for a in page.locator("a:has-text('Bestätigen')").all():
        try:
            if a.is_visible(): a.click(); break
        except Exception: pass
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2000)


# ─── 04 — times ──────────────────────────────────────────────────────
def fill_time(page, minutes):
    inputs = page.locator("input[type='number']")
    visible = []
    for i in range(inputs.count()):
        try:
            if inputs.nth(i).is_visible(): visible.append(inputs.nth(i))
        except Exception: pass
    if len(visible) < 2: return
    visible[0].fill("0")
    visible[1].fill(str(minutes))


def set_times(page, recipe_id, prep_min, total_min):
    log(f"04_times on {recipe_id}: {prep_min}/{total_min}")
    page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}/edit",
              wait_until="domcontentloaded", timeout=60000)
    dismiss_cookies(page); page.wait_for_timeout(2500)

    for label, minutes in [("Zubereitungszeit", prep_min), ("Gesamtzeit", total_min)]:
        # Open the tile-modal
        opened = False
        for tile in page.locator(".cr-recipe-settings-tiles__item").all():
            try:
                txt = tile.inner_text()
                if "Arbeitszeit" in txt or "Gesamtzeit" in txt or "Portionen" in txt:
                    tile.evaluate("el => el.click()")
                    opened = True; break
            except Exception: pass
        if not opened: continue
        page.wait_for_timeout(800)

        # Click tab
        for b in page.locator(f"button:has-text('{label}')").all():
            try:
                if b.is_visible(): b.click(); break
            except Exception: pass
        page.wait_for_timeout(400)

        fill_time(page, minutes)
        page.wait_for_timeout(300)

        # Modal "Bestätigen" button
        for b in page.locator("button:has-text('Bestätigen')").all():
            try:
                if b.is_visible(): b.click(); break
            except Exception: pass
        page.wait_for_timeout(1500)

    # Global save anchor
    for a in page.locator("a:has-text('Bestätigen')").all():
        try:
            if a.is_visible(): a.click(); break
        except Exception: pass
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(1500)


# ─── 05 — annotate chips ─────────────────────────────────────────────
def annotate_chips(page, recipe_id, ingredients, steps):
    log(f"05_annotate on {recipe_id}")
    page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}/edit/ingredients-and-preparation-steps?active=steps",
              wait_until="domcontentloaded", timeout=60000)
    dismiss_cookies(page); page.wait_for_timeout(3500)

    # Find annotate-api-url from cr-edit-tabs
    annotate_url = page.evaluate("""
        () => {
          const el = document.querySelector('cr-edit-tabs');
          return el ? el.getAttribute('annotate-api-url') : null;
        }
    """)
    if not annotate_url:
        log("  no annotate-api-url attr — skipping")
        return 0

    payload = {
        "recipe": {
            "recipeId": recipe_id,
            "instructions": [{"type": "STEP", "text": s} for s in steps],
            "ingredients": [{"type": "INGREDIENT", "text": i} for i in ingredients],
        },
        "options": {"stepIndexes": list(range(len(steps)))},
    }

    resp = page.evaluate(f"""async () => {{
        const r = await fetch({json.dumps(annotate_url)}, {{
            method: 'POST',
            headers: {{'Content-Type': 'application/json', 'Accept': 'application/json'}},
            body: {json.dumps(json.dumps(payload))}
        }});
        return {{status: r.status, body: await r.text()}};
    }}""")
    if resp["status"] != 200:
        log(f"  annotate-api {resp['status']}: {resp['body'][:300]}")
        return 0

    data = json.loads(resp["body"])
    instructions = data.get("recipeContent", {}).get("instructions", [])

    # Convert each token list → HTML
    def tokens_to_html(tokens):
        html_parts = []
        for t in tokens:
            ttype = t.get("type")
            text = t.get("text", "")
            settings = t.get("settings") or {}
            if ttype == "TEXT":
                html_parts.append(text)
            elif ttype == "MISSED_INGREDIENT":
                attrs = " ".join(f'{k}="{v}"' for k, v in settings.items())
                html_parts.append(f' <cr-ingredient missing {attrs}></cr-ingredient>')
            else:
                attrs = " ".join(f'{k}="{v}"' for k, v in settings.items())
                tag = ttype.lower()
                html_parts.append(f'<cr-{tag} {attrs}>{text}</cr-{tag}>')
        return "".join(html_parts)

    chip_total = 0
    for i, tokens in enumerate(instructions):
        html = tokens_to_html(tokens)
        chip_total += sum(1 for t in tokens if t.get("type") in ("TTS", "INGREDIENT", "MODE"))
        # Set innerHTML of the i-th step's text field
        page.evaluate(f"""(html) => {{
            const fields = [...document.querySelectorAll('cr-manage-steps cr-text-field')];
            if (fields[{i}]) fields[{i}].innerHTML = html;
        }}""", html)

    page.wait_for_timeout(800)
    # Dispatch a save by clicking global "Bestätigen"
    for a in page.locator("a:has-text('Bestätigen')").all():
        try:
            if a.is_visible(): a.click(); break
        except Exception: pass
    page.wait_for_load_state("networkidle", timeout=20000)
    page.wait_for_timeout(2500)
    log(f"  {chip_total} chips persisted across {len(instructions)} steps")
    return chip_total


# ─── 02 — upload image ───────────────────────────────────────────────
def upload_image(page, recipe_id, image_path):
    log(f"02_image on {recipe_id}: {image_path}")
    page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}/edit",
              wait_until="domcontentloaded", timeout=60000)
    dismiss_cookies(page); page.wait_for_timeout(3000)

    trigger = page.locator("button.cr-manage-image__trigger").first
    trigger.wait_for(state="visible", timeout=10000)
    trigger.click()
    page.wait_for_timeout(2000)

    # Cloudinary widget iframe
    frame = None
    for f in page.frames:
        if "cloudinary" in (f.url or ""):
            frame = f; break
    if not frame:
        log("  cloudinary iframe not found"); return False

    file_input = frame.locator("input[type='file']").first
    file_input.set_input_files(image_path)
    page.wait_for_timeout(3500)

    # Crop confirm
    for b in frame.locator("button:has-text('Zuschneiden')").all():
        try:
            if b.is_visible(): b.click(); break
        except Exception: pass
    page.wait_for_timeout(3000)

    # Global save
    for a in page.locator("a:has-text('Bestätigen')").all():
        try:
            if a.is_visible(): a.click(); break
        except Exception: pass
    page.wait_for_load_state("networkidle", timeout=20000)
    page.wait_for_timeout(2000)
    return True


# ─── 06 — publish ────────────────────────────────────────────────────
def publish(page, recipe_id):
    log(f"06_publish on {recipe_id}")
    page.goto(f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}",
              wait_until="domcontentloaded", timeout=60000)
    dismiss_cookies(page); page.wait_for_timeout(2500)

    resp = page.evaluate(f"""async () => {{
        const r = await fetch('/created-recipes/de-DE/{recipe_id}', {{
            method: 'PATCH',
            headers: {{'Content-Type': 'application/json', 'Accept': 'application/json'}},
            body: JSON.stringify({{workStatus: 'PUBLIC', isImageOwnedByUser: true}})
        }});
        return r.status;
    }}""")
    log(f"  PATCH status: {resp}")
    return resp == 200


# ─── orchestrator ────────────────────────────────────────────────────
def main():
    raw = sys.stdin.read()
    spec = json.loads(raw)
    actions = []
    result = {}

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            USER_DATA, headless=HEADLESS,
            viewport={"width": 1500, "height": 950}, locale="de-DE",
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        try:
            recipe_id = spec.get("recipe_id")  # update existing
            mode = spec.get("mode", "auto")     # auto | replace_steps_only
            if not recipe_id:
                recipe_id = create_recipe(page, spec["recipe_name"], spec["ingredients"], spec["steps"])
                actions.append("created")
            result["recipe_id"] = recipe_id

            if mode == "replace_steps_only":
                # Surgical update of an existing live recipe: drop all
                # steps, insert fresh wording, re-annotate chips. Skip
                # everything else so tips/times/image/publish-state
                # stay exactly as they were.
                deleted = replace_steps(page, recipe_id, spec["steps"])
                actions.append(f"replaced({deleted}→{len(spec['steps'])})")
                try:
                    n_chips = annotate_chips(page, recipe_id, spec["ingredients"], spec["steps"])
                    actions.append(f"annotated({n_chips}chips)")
                except Exception as e:
                    log(f"annotate failed (non-fatal): {e}")
                result["actions"] = actions
                print(json.dumps(result))
                return

            if spec.get("tips_text"):
                add_tips(page, recipe_id, spec["tips_text"]); actions.append("tipped")

            if spec.get("prep_min") and spec.get("total_min"):
                try:
                    set_times(page, recipe_id, spec["prep_min"], spec["total_min"])
                    actions.append("timed")
                except Exception as e:
                    log(f"set_times failed (non-fatal): {e}")

            try:
                n_chips = annotate_chips(page, recipe_id, spec["ingredients"], spec["steps"])
                actions.append(f"annotated({n_chips}chips)")
            except Exception as e:
                log(f"annotate failed (non-fatal): {e}")

            if spec.get("image_path") and os.path.exists(spec["image_path"]):
                try:
                    if upload_image(page, recipe_id, spec["image_path"]):
                        actions.append("image-uploaded")
                except Exception as e:
                    log(f"image upload failed: {e}")

            if spec.get("publish"):
                if publish(page, recipe_id):
                    actions.append("published")
                    result["public_url"] = f"https://cookidoo.de/created-recipes/public/recipes/de-DE/{recipe_id}"
        finally:
            ctx.close()

    result["actions"] = actions
    print(json.dumps(result))


if __name__ == "__main__":
    main()
