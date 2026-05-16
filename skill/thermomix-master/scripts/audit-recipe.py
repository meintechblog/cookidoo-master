#!/usr/bin/env python3
"""Audit a proposed recipe for the 9 native-quality rules before pushing to Cookidoo.

Reads a JSON file:
  { "ingredients": ["300 g Basmatireis", ...],
    "steps": ["Limetten in 8 Spalten...", ...] }

Checks:
  1. Per-step ingredient uniqueness (every ingredient max 1x per step)
  2. Cross-step adjacent endings (no two consecutive steps end identically)
  3. Compound-name conflicts (Sriracha-Mayo + Sriracha-Sauce in same step)
  4. Chip-syntax sanity (cooking commands match `<N> <Min.|Sek.>/.../<Stufe ...>`)
  5. Step-count vs ingredient-count vs native-median table

Usage: ./audit-recipe.py recipe.json
Prints findings, exits 0 if clean / 1 if any blocker.
"""
import sys, re, json, pathlib
from collections import Counter

# Ingredient keywords that the AI annotator matches by substring. Add as needed.
INGREDIENT_KEYWORDS = [
    "Wasser", "Salz", "Pfeffer", "Zucker", "Öl", "Sesamöl", "Mehl",
    "Reis", "Basmatireis", "Aubergine", "Auberginen", "Buschbohnen", "Bohnen",
    "Limette", "Limetten", "Limettenspalten", "Limettenviertel",
    "Chili", "Chilischote", "Chilischoten",
    "Gurke", "Gurken", "Frühlingszwiebel", "Frühlingszwiebeln",
    "Karotte", "Karotten", "Schalotte", "Schalotten", "Spitzpaprika", "Spitzpaprikas",
    "Mayonnaise", "Sriracha", "Sweet-Chili", "Teriyaki", "Teriyakisoße",
    "Tomatenmark", "Ketjap", "Sojasoße", "Erdnüsse", "Erdnüssen",
    "Filetstück", "Filetstücke", "Tofu", "Edamame",
    "Hello Curry", "Curry",
]

ADJACENT_END_PATTERNS = [
    "abschmecken.", "verrühren.", "vermengen.", "marinieren.",
    "köcheln lassen.", "ziehen lassen.", "ruhen lassen.",
    "beiseitestellen.", "beiseite stellen.", "servieren.",
]

# Native step-median table: ingredient_count → (median, range)
NATIVE_STEP_TABLE = [
    (12, 4, (3, 5)),   # 8-12 ingredients → 4 steps median
    (17, 5, (4, 7)),   # 13-17 ingredients → 5 steps median
    (25, 6, (5, 8)),   # 18-25 ingredients → 6 steps median
]


def check_per_step_uniqueness(steps):
    findings = []
    for i, step in enumerate(steps, 1):
        counts = Counter()
        for kw in INGREDIENT_KEYWORDS:
            # word boundary search, case-sensitive (German has different inflections)
            n = len(re.findall(rf"\b{re.escape(kw)}\w*\b", step))
            if n > 1:
                counts[kw] = n
        if counts:
            for kw, n in counts.items():
                findings.append(("WARN", f"Step {i}: '{kw}' mentioned {n}x — will produce duplicate chips"))
    return findings


def check_adjacent_endings(steps):
    findings = []
    for i in range(1, len(steps)):
        for pat in ADJACENT_END_PATTERNS:
            if steps[i-1].rstrip().endswith(pat) and steps[i].rstrip().endswith(pat):
                findings.append(("BLOCK", f"Steps {i} and {i+1} both end with '...{pat}' — reads like copy-paste, merge or rephrase"))
    return findings


def check_compound_conflicts(steps, ingredients):
    """If a step mentions e.g. 'Sriracha-Mayo' while 'Sriracha-Sauce' is an ingredient,
    the AI will annotate both → two chips for 'Sriracha'."""
    findings = []
    ing_keywords = set()
    for ing in ingredients:
        # Pull substantive words (Sriracha-Sauce → Sriracha, Sauce)
        for w in re.findall(r"[A-ZÄÖÜ][a-zäöüß-]+", ing):
            if len(w) > 4 and w not in {"Stück", "Prise", "Teelöffel", "Esslöffel"}:
                ing_keywords.add(w)
    for i, step in enumerate(steps, 1):
        hits = Counter()
        for kw in ing_keywords:
            n = len(re.findall(rf"\b{kw}", step))
            if n > 1:
                hits[kw] = n
        for kw, n in hits.items():
            findings.append(("WARN", f"Step {i}: substring '{kw}' appears {n}x — check if compound names like '{kw}-X' cause double-annotation"))
    return findings


CHIP_PATTERN = re.compile(
    r"\b\d+(?:[-–]\d+)?\s+(?:Sek|Min)\."           # 10 Sek. / 18 Min. / 5-6 Min.
    r"(?:/(?:Stufe\s+[\d,.]+|soft|Teig|Varoma|\d+\s*°?\s*C))*"  # optional /Stufe / /100°C / /Varoma
    r"/(?:Stufe\s+[\d,.]+|soft|Teig|Linkslauf|Stufe\s+[\d,.]+)"  # mandatory final Stufe or modifier
)


def check_chip_syntax(steps):
    findings = []
    chips_found = 0
    for i, step in enumerate(steps, 1):
        # Loose pattern: anything like "N Min./..." or "N Sek./..."
        candidates = re.findall(r"\b\d+(?:[-–]\d+)?\s+(?:Sek|Min)\.\/[^.,;]{3,60}", step)
        for c in candidates:
            chips_found += 1
            # Tighter validation
            if not re.search(r"/Stufe\s+", c) and "/Varoma" not in c:
                findings.append(("WARN", f"Step {i}: '{c}' may not annotate as TTS chip (needs /Stufe N or /Varoma)"))
    if chips_found == 0:
        findings.append(("WARN", "No cooking-command chip patterns detected — this recipe will have no interactive Thermomix chips"))
    return findings, chips_found


def check_step_count(steps, ingredients):
    n_ing = len(ingredients)
    n_step = len(steps)
    expected_median, (lo, hi) = next(((m, r) for cap, m, r in NATIVE_STEP_TABLE if n_ing <= cap), (6, (5, 8)))
    findings = []
    if n_step < lo:
        findings.append(("WARN", f"{n_step} steps for {n_ing} ingredients is below native range {lo}-{hi} (median {expected_median}) — too coarse?"))
    elif n_step > hi:
        findings.append(("WARN", f"{n_step} steps for {n_ing} ingredients is above native range {lo}-{hi} (median {expected_median}) — too fine-grained?"))
    else:
        findings.append(("OK", f"{n_step} steps for {n_ing} ingredients matches native range {lo}-{hi} (median {expected_median})"))
    return findings


def main():
    if len(sys.argv) != 2:
        print("usage: audit-recipe.py recipe.json", file=sys.stderr); sys.exit(64)
    data = json.loads(pathlib.Path(sys.argv[1]).read_text())
    ingredients = data["ingredients"]
    steps = data["steps"]

    print(f"Auditing recipe: {len(ingredients)} ingredients, {len(steps)} steps")
    print()

    all_findings = []
    all_findings += check_step_count(steps, ingredients)
    all_findings += check_per_step_uniqueness(steps)
    all_findings += check_adjacent_endings(steps)
    all_findings += check_compound_conflicts(steps, ingredients)
    chip_findings, n_chips = check_chip_syntax(steps)
    all_findings += chip_findings

    blockers = [f for sev, f in all_findings if sev == "BLOCK"]
    warns = [f for sev, f in all_findings if sev == "WARN"]
    oks = [f for sev, f in all_findings if sev == "OK"]

    if oks:
        for f in oks: print(f"  ✓ {f}")
    if warns:
        print()
        for f in warns: print(f"  ⚠ {f}")
    if blockers:
        print()
        for f in blockers: print(f"  ✗ {f}")

    print()
    print(f"TTS chip candidates detected: {n_chips}")
    print(f"Blockers: {len(blockers)} · Warnings: {len(warns)}")
    sys.exit(1 if blockers else 0)


if __name__ == "__main__":
    main()
