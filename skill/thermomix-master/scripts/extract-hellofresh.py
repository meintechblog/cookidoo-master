#!/usr/bin/env python3
"""Extract HelloFresh recipe data from a URL.

HelloFresh embeds the Recipe JSON-LD inside the page body (not a script tag),
so we use a tolerant regex + balanced-brace walker to lift the object out.

Usage: ./extract-hellofresh.py <hellofresh-url>
Prints JSON to stdout with:
  { "name", "url", "yield_2p", "prepTime_iso", "totalTime_iso",
    "image_url", "ingredients_2p": [...], "instructions_2p": [...],
    "nutrition": {...} }

Exit codes:
  0 = success
  1 = network error
  2 = parse error (no Recipe found)
"""
import sys, re, json, urllib.request, urllib.error


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (thermomix-master skill)"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        print(f"network error: {e}", file=sys.stderr)
        sys.exit(1)


def find_recipe_obj(html: str) -> dict:
    """Find the {... "@type":"Recipe" ...} object via balanced-brace walking."""
    m = re.search(r'"@type":"Recipe"', html)
    if not m:
        print("no Recipe @type found in page", file=sys.stderr)
        sys.exit(2)
    # Walk backward to find the opening brace
    start = html.rfind("{", 0, m.start())
    if start < 0:
        print("could not find opening brace", file=sys.stderr); sys.exit(2)
    # Walk forward balancing braces, respecting string literals + escapes
    depth = 0; in_str = False; esc = False
    for i, ch in enumerate(html[start:], start):
        if esc: esc = False; continue
        if ch == "\\": esc = True; continue
        if ch == '"': in_str = not in_str; continue
        if in_str: continue
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(html[start:i+1])
                except json.JSONDecodeError as e:
                    print(f"json parse err at offset {start}: {e}", file=sys.stderr)
                    sys.exit(2)
    print("brace walking ran off the end", file=sys.stderr); sys.exit(2)


def strip_html(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # Decode common JSON-escaped characters
    return s


def extract(url: str) -> dict:
    html = fetch(url)
    r = find_recipe_obj(html)

    img = r.get("image")
    if isinstance(img, list) and img:
        img = img[0]
    if isinstance(img, dict):
        img = img.get("url")

    nutr = {k: v for k, v in (r.get("nutrition") or {}).items() if k != "@type"}

    instructions = []
    for s in r.get("recipeInstructions", []):
        if isinstance(s, dict):
            instructions.append(strip_html(s.get("text", "")))
        else:
            instructions.append(strip_html(str(s)))

    return {
        "name": r.get("name"),
        "url": url,
        "description": r.get("description"),
        "yield_2p": r.get("recipeYield"),
        "prepTime_iso": r.get("prepTime"),
        "cookTime_iso": r.get("cookTime"),
        "totalTime_iso": r.get("totalTime"),
        "image_url": img,
        "category": r.get("recipeCategory"),
        "cuisine": r.get("recipeCuisine"),
        "keywords": r.get("keywords"),
        "ingredients_2p": r.get("recipeIngredient", []),
        "instructions_2p": instructions,
        "nutrition_2p": nutr,
    }


def main():
    if len(sys.argv) != 2:
        print("usage: extract-hellofresh.py <hellofresh-url>", file=sys.stderr)
        sys.exit(64)
    print(json.dumps(extract(sys.argv[1]), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
