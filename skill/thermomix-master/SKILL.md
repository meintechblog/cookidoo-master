---
name: thermomix-master
description: "Beliebige Rezepte (HelloFresh-URL, Plain-Text, Foto einer Rezeptkarte) in ~3-5 Min. in ein native-quality Cookidoo „Eigenes Rezept\" mit interaktiven Thermomix-Koch-Befehl-Chips verwandeln. End-to-End: scrapen → adaptieren → publishen → dokumentieren."
argument-hint: "<hellofresh-url> | --text \"<rezept-text>\" | --image <pfad/zum/foto.jpg>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
  - AskUserQuestion
---


<objective>
Take a recipe from any source (HelloFresh-Karte als URL, Plain-Text, Foto)
and ship it as a publicly shared, native-quality Cookidoo „Eigenes Rezept"
with interactive Thermomix cooking-command chips.

**Vorbedingungen:**
- Toolkit-Repo unter `~/codex/cookidoo-master/` (oder anderswo — siehe SKILL_REPO env)
- `~/cookidoo-automation/profile/` mit eingeloggter Cookidoo-Session
- Eigenes Foto vom fertigen Gericht (für PUBLIC-Sharing — sonst nur PRIVATE)

**Ergebnis:**
- Recipe live auf Cookidoo (privat + öffentlich teilbar)
- `recipes/<slug>/` im Repo mit hero.jpg + README + Live-Screenshots
- Repo-README Status-Tabelle ergänzt
- Commit + Push gemacht
</objective>


<execution_context>
SKILL_REPO=${SKILL_REPO:-$HOME/codex/cookidoo-master}
SKILL_DIR=${SKILL_DIR:-$HOME/.claude/skills/thermomix-master}
</execution_context>


<input_detection>
Parse `$ARGUMENTS`:

| Pattern | INPUT_TYPE |
|---|---|
| starts with `https://www.hellofresh.de/recipes/` | `hellofresh-url` |
| starts with `--text` | `plain-text` (use AskUserQuestion to collect the recipe body if not in $ARGUMENTS) |
| starts with `--image` | `image-path` (path follows the flag — use Read tool to view, transcribe to ingredients/steps) |
| starts with `--help` or empty | print usage + exit |
| sonstige URL | try WebFetch + parse JSON-LD, fallback: ask user to paste as `--text` |

Wenn unklar → AskUserQuestion mit den 3 Input-Typen.
</input_detection>


<process>

## Phase 1 — Raw-Recipe extrahieren

**hellofresh-url:**
```bash
$SKILL_DIR/scripts/extract-hellofresh.py "$URL" > /tmp/thermomix-raw.json
```
Liefert `name`, `servings`, `ingredients`, `instructions`, `image_url`, `totalTime_iso`, `nutrition`. Die Felder sind in der HelloFresh-Original-Portionsgröße (`servings`-Wert, meist 2P) — Phase 2 skaliert auf die Ziel-Portionen.

**plain-text:**
User pastet das Rezept. Parse heuristisch (Zutaten in Bullet-Liste, Steps als nummerierte Liste oder Absätze).

**image-path:**
`Read` das Bild. Transkribiere Zutaten + Schritte aus der Bildansicht (du kannst Bilder lesen). Schreibe das Ergebnis nach `/tmp/thermomix-raw.json` im selben Format wie der HelloFresh-Extractor.

## Phase 2 — Auf 4 Portionen skalieren (default)

Compute `multiplier = 4 / servings` (HelloFresh-Karten sind meist `servings: 2` → multiplier = 2). Multiplier-Brackets `[1,5 EL | 2 EL]` in den `instructions` zeigen 3P/4P-Varianten — bei 4P kann man die letzte Bracket-Variante direkt nutzen, sonst alle 2P-Mengen × multiplier rechnen.

Wenn der User eine andere Portionsgröße will: AskUserQuestion.

## Phase 3 — Auf native Thermomix-Style adaptieren

@$SKILL_DIR/references/native-style-rules.md

Konkret für jedes Rezept:

1. **Step-Anzahl bestimmen**: 14-17 Zutaten → 5 Steps median (4-7 OK). Wenn Pfannen-Phase zwei sequentielle Brate-Schritte braucht (Filetstücke raus + Öl neu) → 6 Steps statt 5.

2. **Aktionen gruppieren**: Vorbereitung-Schritte zusammenfassen. Parallel laufende Tasks mit `In der Zwischenzeit ...` einleiten.

3. **Native Verben einsetzen**:
   - `füllen → einwiegen` (in Gareinsatz/Mixtopf)
   - `reinhängen → einhängen`
   - `aufstellen/abnehmen → aufsetzen/absetzen` (Varoma)
   - `Spatel benutzen → mithilfe des Spatels herausnehmen`
   - `dazugeben → unterheben` (am Ende)
   - `in Schüsseln verteilen → auf 4 Bowls verteilen`
   - Schluss: `... servieren` (NICHT „Guten Appetit!")

4. **Zutaten-Format**:
   - `1 frische Chilischote` → `1 Chilischote, frisch`
   - `1 Limette (gewachst), in Spalten geschnitten` → `1 Limette, gewachst` (Verb gehört in Step)
   - `Salz, Pfeffer, Öl nach Geschmack` → vier getrennte Zeilen mit spezifischen Mengen

5. **Thermomix-Steps einbauen wo möglich**:
   - Reis kochen → `18 Min./Varoma/Stufe 1` (im Gareinsatz)
   - Pürieren → `10 Sek./Stufe 6`
   - Linkslauf-Dünsten (für Bohnen/Empfindliches) → `6 Min./100 °C/Linkslauf/Stufe 1`
   - Pürierstab im Original → ersetzt durch Mixtopf-Stufe → `10 Sek./Stufe 6` oder `5 Sek./Stufe 5`

@$SKILL_DIR/references/chip-syntax.md (für exakte Chip-Format-Regeln)

## Phase 4 — Audit

Schreibe das Adapt-Ergebnis nach `/tmp/thermomix-proposed.json`:
```json
{ "name": "...", "ingredients": [...], "steps": [...],
  "prep_min": 30, "total_min": 40 }
```

Audit laufen lassen:
```bash
$SKILL_DIR/scripts/audit-recipe.py /tmp/thermomix-proposed.json
```

Bei BLOCK-Findings (exit 1): Steps anpassen, erneut auditieren.
Bei WARN-Findings: User informieren, ob OK oder noch anpassen.

@$SKILL_DIR/references/quality-checks.md (alle 9 Regeln im Detail)

## Phase 5 — User-Review

AskUserQuestion mit dem Proposed-Rezept (Name, Zutaten, Steps in kompakter Form). 
User kann:
- ✓ Übernehmen → Phase 6
- ⚙ Fine-tune (welche Steps/Zutaten ändern?) → Phase 3 zurück
- ✗ Abbrechen

## Phase 6 — Pipeline durchlaufen

Slug aus Recipe-Name ableiten (kebab-case, UTF-8-safe — sed über Umlaute zerstört die Bytes!):
`SLUG=$($SKILL_DIR/scripts/_slugify.py "$NAME")`

**1. `01_create_recipe.py` editieren + ausführen:**
   - Edit `$SKILL_REPO/automation/01_create_recipe.py`:
     - `RECIPE_NAME = "<name>"` (mit „(HelloFresh)" wenn Quelle HF)
     - `INGREDIENTS = [...]`
     - `STEPS = [...]`
   - `cd $SKILL_REPO && python3 automation/01_create_recipe.py`
   - Recipe-ID wird ins STATE_FILE geschrieben

**2. Hero-Bild kopieren (wenn User-Foto vorhanden):**
   - `mkdir -p recipes/<slug>/`
   - `cp <user-photo-path> recipes/<slug>/hero.jpg`
   - `python3 automation/02_upload_image.py recipes/<slug>/hero.jpg`

**3. Tipps schreiben + 03_add_tips.py editieren + ausführen:**
   - 5-8 rezept-spezifische Tipps generieren (kein Boilerplate!) basierend auf:
     - Was die HelloFresh-Karte als Hinweis hat
     - Welche Zubereitungs-Schritte rezeptspezifische Stolperfallen haben
     - Variations-Ideen (Tofu statt X, Edamame zusätzlich, etc.)
     - Reste/Haltbarkeit
   - Tipps mit `— ` Prefix, jede Zeile eigene Tipp
   - Narrativ-Block am Ende (siehe Sweet-Chili-Bowl + Nasi-Goreng als Template):
     ```
     Warum dieses Rezept als Cookidoo-Version hier liegt:
     [HelloFresh-Würdigung + Thermomix-Variante-Kritik + was wir geändert haben]
     
     Original-Karte (HelloFresh):
     <url>
     
     Toolkit (Open Source):
     https://github.com/meintechblog/cookidoo-master
     ```
   - Edit `$SKILL_REPO/automation/03_add_tips.py` (TIPS = ...)
   - `python3 automation/03_add_tips.py`

**4. `04_set_times.py` editieren + ausführen:**
   - PREP_MIN, TOTAL_MIN aus dem HelloFresh-Original (oder Schätzung)
   - `python3 automation/04_set_times.py`

**5. `05_annotate_chips.py` ausführen:**
   - `python3 automation/05_annotate_chips.py`
   - Output enthält Chip-Counts pro Step

**6. Verifizieren — die 2 (oder mehr) TTS-Chips sind persistent:**
   - Quick-Check via Headless-Screenshot (nutze `$SKILL_DIR/scripts/extract-hellofresh.py`-Pattern als Vorlage falls nötig)
   - Oder: kurzes Playwright-Snippet das `nobr.recipe-content__accent` zählt
   - Bei < 2 Chips: zurück zu Phase 3, Chip-Syntax prüfen

**7. Publish (wenn User-Foto eigenes):**
   ```bash
   cd $SKILL_REPO && python3 automation/06_publish.py --yes
   ```
   Das `--yes`-Flag ist die explizite "ich bestätige Image-Ownership"-Variante (statt `echo yes` zu pipen — so wird ein zukünftiger zweiter Confirmation-Prompt nicht versehentlich auto-bestätigt).

## Phase 7 — Dokumentieren

**Screenshots:**
   - `nasi-zubereitung.png` (Zubereitung-Block mit Chips)
   - `nasi-tips.png` (Tips + Narrativ)
   - `nasi-public-preview.png` (Public-View ohne Login)
   - In `$SKILL_REPO/docs/assets/<slug>-*.png` ablegen

**Recipe-README:**
   - `recipes/<slug>/README.md` schreiben — gleiche Struktur wie [Sweet-Chili-Bowl](../../../recipes/sweet-chili-bowl/README.md) oder [Nasi Goreng](../../../recipes/nasi-goreng/README.md):
     - Hero + Subtitle
     - Kennzahlen-Tabelle
     - Zutaten
     - Zubereitung (mit Bold-Markup für Zutaten + Chips)
     - Tipps
     - „Warum diese Cookidoo-Adaption"-Sektion
     - „So sieht's live auf Cookidoo aus" mit 3 Screenshots
     - Quelle & Lizenz

**Root-README Status-Tabelle:**
   - Neue Zeile in der Tabelle in `$SKILL_REPO/README.md` ergänzen

## Phase 8 — Commit + Push

```bash
cd $SKILL_REPO && git add -A
git commit -m "Add 3rd recipe: <name> (HelloFresh)

[Strukturierter Body mit:
- recipe-id + cookidoo-urls
- besondere Anpassungen (z.B. Thermomix-Pürieren statt Pürierstab)
- step-count + chip-count
- screenshots]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

</process>


<error_handling>
- **Cookidoo UI-Drift**: Wenn ein Pipeline-Script bricht (Element-Selektoren funktionieren nicht mehr), DOM-Audit-Snippet laufen lassen (`page.evaluate(...)`) um neue Selektoren zu finden, das Script patchen, in LEARNINGS.md unter „UI-Drift" dokumentieren.
- **Audit fails mit BLOCK**: Steps neu schreiben. Häufigster Fehler: zwei adjacent steps enden gleich → mergen oder umformulieren.
- **< 2 TTS-Chips erkannt**: Chip-Syntax in den Steps prüfen (siehe `references/chip-syntax.md`). Häufigste Probleme: fehlende `/` Trenner, fehlendes Leerzeichen vor `°C`, ungültige Stufe.
- **Publish 06 schlägt fehl mit `isImageOwnedByUser`-Error**: User hat kein eigenes Foto hochgeladen — bei 02_upload_image.py zurück.
- **AskUserQuestion not available**: Fallback auf direkten Output mit klarer „Bestätige bitte"-Aufforderung.
</error_handling>


<output_format>
Während des Laufs: kurze Status-Updates pro Phase. Am Ende:

```
✅ Rezept live: <name>
🔗 Cookidoo (öffentlich): <url>
📁 Repo: recipes/<slug>/
📊 Stats: <n> Zutaten · <m> Steps · <k> TTS-Chips
🚀 Commit: <hash>
```
</output_format>
