"""🪄 The MAGIC step: auto-detect cooking commands + ingredients in your plain-text
steps and convert them to interactive Thermomix chips.

Uses Cookidoo's undocumented AI-annotate endpoint:
    POST /created-recipes/de-DE/annotate/steps
    body: {recipe: {recipeId, instructions, ingredients}, options: {stepIndexes: [0,1,...]}}

Response tokens (TEXT / INGREDIENT / TTS / MODE / MISSED_INGREDIENT) are converted to
the corresponding custom HTML elements (cr-tts, cr-ingredient, cr-mode) and written
back into each step's contenteditable. Then cr-manage-steps.save() persists the
annotations server-side.

After this script, your recipe behaves like a native Vorwerk recipe — the Thermomix
auto-executes cooking commands and links each ingredient mention to its quantity.

Edit nothing — uses the recipe ID from ~/cookidoo-automation/current_recipe.txt.
"""
import pathlib, sys, json
from playwright.sync_api import sync_playwright

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

        page.goto(
            f"https://cookidoo.de/created-recipes/de-DE/{recipe_id}/edit/ingredients-and-preparation-steps?active=steps",
            wait_until="domcontentloaded", timeout=60000,
        )
        try: page.locator("#onetrust-accept-btn-handler").first.click(timeout=2000)
        except Exception: pass
        page.wait_for_timeout(3500)

        result = page.evaluate("""async (recipeId) => {
            const manageSteps = document.querySelector('cr-manage-steps');
            const manageIngs = document.querySelector('cr-manage-ingredients');
            const instructions = manageSteps.getInstructions();
            const ingredients = manageIngs.getIngredients();

            // POST to AI annotate
            const annotateUrl = '/created-recipes/de-DE/annotate/steps';
            const payload = {
                recipe: {recipeId, instructions, ingredients},
                options: {stepIndexes: [...Array(instructions.length).keys()]}
            };
            const r = await fetch(annotateUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
                body: JSON.stringify(payload)
            });
            if (!r.ok) return {err: 'annotate failed', status: r.status, body: await r.text()};
            const annotated = (await r.json()).recipeContent.instructions;

            // Mirror customer-recipes bundle's convertInstructionToHtml()
            const tokenToHtml = (t) => {
                const settings = t.settings
                    ? Object.keys(t.settings).map(k => `${k}="${t.settings[k]}"`).join(' ')
                    : '';
                if (t.type === 'TEXT') return t.text;
                if (t.type === 'MISSED_INGREDIENT') return ` <cr-ingredient missing ${settings}>\\uE007</cr-ingredient>`;
                return `<cr-${t.type.toLowerCase()} ${settings}>${t.text}</cr-${t.type.toLowerCase()}>`;
            };

            // Apply to each cr-text-field
            const fields = document.querySelectorAll('cr-manage-steps cr-text-field');
            const summary = [];
            for (let i = 0; i < annotated.length && i < fields.length; i++) {
                const html = annotated[i].map(tokenToHtml).join('');
                fields[i].innerHTML = html;
                fields[i].dispatchEvent(new CustomEvent('step-text-change', {bubbles: true}));
                fields[i].dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertHTML'}));
                const chipCount = annotated[i].filter(t => t.type !== 'TEXT').length;
                summary.push({step: i+1, chips: chipCount});
            }

            // Persist via the manage-steps' save()
            manageSteps.save();
            await new Promise(r => setTimeout(r, 2500));
            return {ok: true, summary};
        }""", recipe_id)

        if result.get("err"):
            print("ANNOTATE ERROR:", result)
            sys.exit(1)

        print("Annotate summary:")
        for s in result["summary"]:
            print(f"  step {s['step']}: {s['chips']} chip(s)")

        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)
        print(f"\nDone. Recipe URL: https://cookidoo.de/created-recipes/de-DE/{recipe_id}")
        ctx.close()


if __name__ == "__main__":
    main()
