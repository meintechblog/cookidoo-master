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
Vollautopilot von Input (HF-URL ODER Handy-Foto einer Rezeptkarte) zu
„Rezept live auf Cookidoo + sichtbar auf der Webapp + AI-Hero-Bild
generiert + alles committed". Jörg schickt eine Zeile, der Skill macht
den Rest — kein manuelles Foto-Schicken, kein Mid-Workflow-Approval.

**Input** (eines davon):
- HelloFresh-URL → image_url aus JSON-LD wird automatisch zum Restyle benutzt
- Pfad zu einem Handy-Foto der gedruckten HF-Karte (`--image`) → wird als Restyle-Source benutzt (Card-Mode-Prompt extrahiert das Gericht)
- Plain-Text-Paste (`--text`) → ohne Bild, Rezept landet PRIVATE auf Cookidoo

**Output** (automatisch, ohne weitere Eingaben):
- Recipe live auf Cookidoo (PUBLIC wenn Hero da, sonst PRIVATE)
- `recipes/<slug>/` im Repo mit hero.jpg + README + 3 Screenshots
- HF-Original + AI-Restyle-PNG + JPEG-Q92 in `.received/hf<NR>/` (gitignored)
- Commit + Push + LXC-Autoupdate getriggert → Webapp `http://192.168.3.223/r/<slug>` live

**Vorbedingungen** (Setup-Sache, einmal pro Maschine):
- Toolkit-Repo unter `~/codex/cookidoo-master/` (oder via SKILL_REPO env)
- `~/cookidoo-automation/profile/` mit eingeloggter Cookidoo-Session
- ChatGPT.app eingeloggt + Bedienungshilfen-Permission + `cliclick` (`brew install cliclick`) — nötig für den AI-Restyle in Pfad B
- SSH-Zugang zu `root@192.168.3.223` für LXC-Autoupdate-Trigger (optional, sonst Fallback auf 10-Min-Timer)
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
HF_URL="$1"
$SKILL_DIR/scripts/extract-hellofresh.py "$HF_URL" > /tmp/thermomix-raw.json
NAME=$(jq -r .name        /tmp/thermomix-raw.json)
IMAGE_URL=$(jq -r .image_url /tmp/thermomix-raw.json)
SERVINGS=$(jq -r .servings /tmp/thermomix-raw.json)
```
Liefert `name`, `servings`, `ingredients`, `instructions`, `image_url`, `totalTime_iso`, `nutrition`. Die Felder sind in der HelloFresh-Original-Portionsgröße (`servings`-Wert, meist 2P) — Phase 2 skaliert auf die Ziel-Portionen.

**Wichtig: `image_url` ist die direkte URL zum HF-Hauptbild** — alles was wir für den Restyle brauchen. Kein WA-Bridge nötig, kein Bild von Hand schicken. Der Skill zieht das Bild in Phase 2.5 automatisch via `curl -sL`.

**plain-text:**
User pastet das Rezept. Parse heuristisch (Zutaten in Bullet-Liste, Steps als nummerierte Liste oder Absätze). `IMAGE_URL=""` und `IMAGE_PATH=""` setzen — fällt in Pfad C (keine Hero-Bild-Generierung, Rezept bleibt PRIVATE).

**image-path** (Handy-Foto einer HF-Rezeptkarte):
`Read` das Bild. Transkribiere Zutaten + Schritte aus der Bildansicht (du kannst Bilder lesen). Schreibe das Ergebnis nach `/tmp/thermomix-raw.json` im selben Format wie der HelloFresh-Extractor. Setze `IMAGE_PATH="$INPUT_IMAGE"` und `IMAGE_URL=""` — das Handy-Foto wird in Phase 6 Step 2 als Restyle-Source benutzt (das Gericht ist auf dem Karten-Foto sichtbar; ChatGPT extrahiert + restylet es).

Wenn die Karte keine HF-Nummer auf der Vorderseite zeigt, nutze die Aufnahmezeit-Reihenfolge im Repo (`ls -t recipes/` als Heuristik für Karten-Position) oder lasse `HF_NR` leer.

## Phase 2 — Auf 4 Portionen skalieren (default)

Compute `multiplier = 4 / servings` (HelloFresh-Karten sind meist `servings: 2` → multiplier = 2). Multiplier-Brackets `[1,5 EL | 2 EL]` in den `instructions` zeigen 3P/4P-Varianten — bei 4P kann man die letzte Bracket-Variante direkt nutzen, sonst alle 2P-Mengen × multiplier rechnen.

Wenn der User eine andere Portionsgröße will: AskUserQuestion.

## Phase 2.5 — HF-Karten-Nr + Hero-Bild vorbereiten

**Karten-Nr extrahieren** (für README + Webapp-Sort) — direkt aus der `IMAGE_URL`, kein zusätzlicher HTTP-Hit:
```bash
HF_TOKEN=$(echo "$IMAGE_URL" | grep -oE 'HF_Y[0-9]+_R[0-9]+_W[0-9]+' | head -1)
HF_NR=$(echo "$HF_TOKEN" | grep -oE 'R[0-9]+' | head -1 | tr -d R)
# Beispiel: image_url enthält HF_Y26_R25_W19 → HF_NR=25, HF_TOKEN=HF_Y26_R25_W19
# Wenn IMAGE_URL leer (plain-text) oder Pattern nicht matched: HF_NR leer lassen.
```
Siehe `@$SKILL_DIR/references/hellofresh-card-numbers.md`.

**Hero-Pfad wählen** (siehe `@$SKILL_DIR/references/hero-image-pipeline.md`):

| Situation | Pfad | Was passiert in Phase 2.5 vs. Phase 6 Step 2 |
|---|---|---|
| HF-URL (Phase 1 image_url da) | B | jetzt: curl image_url → `.received/hf$HF_NR/original.jpg`; in Phase 6: Background-Restyle |
| Handy-Foto einer Karte (image-path) | B | jetzt: cp Karten-Foto → `.received/hf$HF_NR/original.jpg`; in Phase 6: Background-Restyle mit Card-Mode-Prompt |
| Eigenes Plattenfoto vom Gericht (Sonderfall) | A | jetzt: copy + verify; Phase 6 Step 2 entfällt |
| Kein Bild (plain-text ohne Foto) | C | gar nichts; Rezept bleibt PRIVATE, kein `06_publish.py --yes` |

```bash
mkdir -p $SKILL_REPO/.received/hf${HF_NR:-unknown}
if [[ -n "$IMAGE_URL" ]]; then
  curl -sL "$IMAGE_URL" -o $SKILL_REPO/.received/hf$HF_NR/original.jpg
elif [[ -n "$IMAGE_PATH" ]]; then
  cp "$IMAGE_PATH" $SKILL_REPO/.received/hf$HF_NR/original.jpg
fi
```

Bei Pfad A (User hat explizit ein Plattenfoto übergeben — separat von $IMAGE_PATH der Karte) *zusätzlich*:
```bash
mkdir -p $SKILL_REPO/recipes/$SLUG
cp <user-platefoto> $SKILL_REPO/recipes/$SLUG/hero.jpg
$SKILL_DIR/scripts/verify-image-match.py \
  --user-image $SKILL_REPO/recipes/$SLUG/hero.jpg \
  --hf-url "$HF_URL"
```

Bei Pfad B: nichts weiter in Phase 2.5 — AI-Restyle läuft in Phase 6 Step 2 im Hintergrund.

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

## Phase 6 — Pipeline durchlaufen (PARALLELISIERT)

Slug aus Recipe-Name ableiten (kebab-case, UTF-8-safe — sed über Umlaute zerstört die Bytes!):
`SLUG=$($SKILL_DIR/scripts/_slugify.py "$NAME")`

### Pipeline-Reihenfolge mit Parallelisierung

```
┌──────────────────────────────────────────────────────────────────┐
│  Step 1  01_create_recipe.py  (sequentiell, schreibt STATE_FILE) │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
            ┌─────────────────────┴─────────────────────┐
            │                                           │
   ┌────────▼─────────┐                      ┌──────────▼──────────┐
   │ Step 2 (BG)      │                      │ Step 3-5 (FG)       │
   │ AI-Restyle in    │  PARALLEL  ────────► │ 03 add_tips →       │
   │ Hintergrund      │                      │ 04 set_times →      │
   │ (~45-60s)        │                      │ 05 annotate_chips → │
   │                  │                      │ verify chip count   │
   └────────┬─────────┘                      └──────────┬──────────┘
            │                                           │
            └─────────────────────┬─────────────────────┘
                                  │  beide Lanes fertig
                ┌─────────────────▼─────────────────┐
                │  Step 6  02_upload_image.py       │
                │  Step 7  06_publish.py --yes      │
                └───────────────────────────────────┘
```

Bei Pfad A (eigenes Foto) oder Pfad C (kein Foto): Step 2 entfällt — alles seriell wie zuvor.

### Steps

**1. `01_create_recipe.py` editieren + ausführen:**
   - Edit `$SKILL_REPO/automation/01_create_recipe.py`:
     - `RECIPE_NAME = "<name>"` (mit „(HelloFresh)" wenn Quelle HF)
     - `INGREDIENTS = [...]`
     - `STEPS = [...]`
   - `cd $SKILL_REPO && python3 automation/01_create_recipe.py`
   - Recipe-ID wird ins STATE_FILE geschrieben
   - **Wichtig:** dieser Step MUSS vor Step 2-5 fertig sein (Step 2 braucht den Slug für `.received/`-Pfad, Steps 3-5 brauchen die Recipe-ID aus STATE_FILE).

**2. AI-Restyle im Hintergrund (NUR bei Pfad B — HF-Hauptbild oder Karten-Foto restylen):**
   ```bash
   # Bei Handy-Foto einer Karte: zusätzlich --card-mode
   CARD_MODE_FLAG=""
   [[ -n "$IMAGE_PATH" ]] && CARD_MODE_FLAG="--card-mode"

   $SKILL_DIR/scripts/chatgpt-restyle.sh \
     --target "$SKILL_REPO/.received/hf$HF_NR/original.jpg" \
     --slug "$SLUG" \
     --nr "$HF_NR" \
     --repo "$SKILL_REPO" \
     ${HF_URL:+--hf-url "$HF_URL"} \
     $CARD_MODE_FLAG \
     --background
   ```
   Returnt sofort, schreibt PID nach `.received/hf$HF_NR/.pid`, Log nach `restyle.log`, sentinel `.done` wenn fertig.

   Hinter den Kulissen läuft im BG: paste 3 style-references → paste target → send prompt (Standard ODER Card-Mode-Prompt) → poll auf done (max 120s) → right-click image → copy → PNG extrahieren → JPEG q92 → verify-image-match → bei niedrigem Score 1× Retry mit verschärftem Prompt → hub-push (best-effort).

**3. Tipps schreiben + 03_add_tips.py editieren + ausführen:** (parallel zu Step 2)
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

**4. `04_set_times.py` editieren + ausführen:** (parallel zu Step 2)
   - PREP_MIN, TOTAL_MIN aus dem HelloFresh-Original (oder Schätzung)
   - `python3 automation/04_set_times.py`

**5. `05_annotate_chips.py` ausführen + verifizieren:** (parallel zu Step 2)
   - `python3 automation/05_annotate_chips.py`
   - Output enthält Chip-Counts pro Step
   - Verifizieren — die 2 (oder mehr) TTS-Chips sind persistent: quick-check via Playwright-Snippet das `nobr.recipe-content__accent` zählt. Bei < 2 Chips: zurück zu Phase 3, Chip-Syntax prüfen.

**6. Wait-Point: Restyle muss fertig sein (nur Pfad B):**
   ```bash
   # polling until done sentinel exists OR timeout 180s
   for i in $(seq 1 60); do
     [[ -f "$SKILL_REPO/.received/hf$HF_NR/.done" ]] && break
     sleep 3
   done
   [[ -f "$SKILL_REPO/.received/hf$HF_NR/.done" ]] || {
     echo "Restyle timed out — check $SKILL_REPO/.received/hf$HF_NR/restyle.log"
     exit 1
   }
   ```

**7. Hero-Bild hochladen:**
   - `recipes/$SLUG/hero.jpg` ist da (Pfad A direkt nach Phase 2.5 oder Pfad B nach Step 6)
   - `python3 automation/02_upload_image.py recipes/$SLUG/hero.jpg`

**8. Publish (wenn Hero vorhanden):**
   ```bash
   cd $SKILL_REPO && python3 automation/06_publish.py --yes
   ```
   Das `--yes`-Flag ist die explizite "ich bestätige Image-Ownership"-Variante.

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
       - **Quelle-Zeile**: `HelloFresh Wochenbox, Karte #<HF_NR> (<HF_TOKEN>, <diät>)` — die `#<NR>` braucht die Webapp für den HF-Badge + Sort-Feature
       - **Foto-Zeile** je nach Pfad aus Phase 2.5:
         - Pfad A: `© Jörg Hofmann (eigene Aufnahme)`
         - Pfad B: `AI-Vorab-Bild (eigene Generierung mit ChatGPT image-1, Style-Referenzen aus eigener Rezeptesammlung, Copyright Jörg Hofmann) — wird beim ersten Kochen durch eigenes Plattenfoto ersetzt`
     - Zutaten
     - Zubereitung (mit Bold-Markup für Zutaten + Chips)
     - Tipps
     - „Warum diese Cookidoo-Adaption"-Sektion
     - „So sieht's live auf Cookidoo aus" mit 3 Screenshots
     - Quelle & Lizenz (bei AI-Bild: Hinweis dass es ersetzt wird beim ersten Kochen)

**Root-README Status-Tabelle:**
   - Neue Zeile in der Tabelle in `$SKILL_REPO/README.md` ergänzen

## Phase 8 — Commit + Push

```bash
cd $SKILL_REPO && git add -A
git commit -m "Add <Nth> recipe: <name> (HelloFresh)

[Strukturierter Body mit:
- recipe-id + cookidoo-urls
- besondere Anpassungen (z.B. Thermomix-Pürieren statt Pürierstab)
- step-count + chip-count
- screenshots]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

**LXC-Webapp sofort updaten** (statt auf den 10-Min-Autoupdate-Timer zu warten):
```bash
ssh -o ConnectTimeout=5 root@192.168.3.223 'systemctl start thermomix-autoupdate.service' || \
  echo "LXC offline — fällt zurück auf den nächsten Timer-Tick"
```
Anschließend kurz pollen bis die neue Sort-Reihenfolge oder das neue Rezept sichtbar ist:
```bash
SLUG_HOST=192.168.3.223
until curl -sf "http://$SLUG_HOST/r/$SLUG" -o /dev/null; do sleep 3; done
echo "Webapp live mit Rezept $SLUG"
```

</process>


<error_handling>
- **Cookidoo UI-Drift**: Wenn ein Pipeline-Script bricht (Element-Selektoren funktionieren nicht mehr), DOM-Audit-Snippet laufen lassen (`page.evaluate(...)`) um neue Selektoren zu finden, das Script patchen, in LEARNINGS.md unter „UI-Drift" dokumentieren.
- **Audit fails mit BLOCK**: Steps neu schreiben. Häufigster Fehler: zwei adjacent steps enden gleich → mergen oder umformulieren.
- **< 2 TTS-Chips erkannt**: Chip-Syntax in den Steps prüfen (siehe `references/chip-syntax.md`). Häufigste Probleme: fehlende `/` Trenner, fehlendes Leerzeichen vor `°C`, ungültige Stufe.
- **Publish 06 schlägt fehl mit `isImageOwnedByUser`-Error**: User hat kein eigenes Foto hochgeladen — bei 02_upload_image.py zurück.
- **AskUserQuestion not available**: Fallback auf direkten Output mit klarer „Bestätige bitte"-Aufforderung.
- **ChatGPT-Restyle hängt > 90s**: vermutlich Auto-Routing-Issue. Im neuen Chat statt von einem bestehenden mit Voreinstellungen senden. Wenn Auto-Routing verweigert: Model explizit auf `image-1`/`GPT-4o` switchen über das Model-Selector-Button im Toolbar.
- **„Bild kopieren" im Right-Click-Menü ist nicht erstes Item**: per Down-Arrow durchnavigieren oder via osascript Menüitems auflisten (`menu items of menu 1`). Layout kann je nach ChatGPT-Version variieren.
- **Falscher Chat aktiv bei Bild-Generierung**: NIE aus einem bestehenden Chat senden — immer neuen Chat via Toolbar-Button („Neuer Chat", `button 2 of toolbar 1`) öffnen. Bestehende Chats können „Zusammenarbeit mit Terminal Tab"-Chip oder andere Kontamination haben.
- **AppleScript-Pfad-Fehler „Ungültiger Index"**: `UI element N` zählt typed (alle scroll areas zuerst, dann buttons) — kann verwirren. Lieber explizit `scroll area N` / `button N` / `group N` etc. verwenden.
</error_handling>


<output_format>
Während des Laufs: kurze Status-Updates pro Phase. Am Ende:

```
✅ Rezept live: <name>
🔗 Cookidoo (öffentlich): https://cookidoo.de/created-recipes/public/recipes/de-DE/<recipe-id>
🌐 Webapp:               http://192.168.3.223/r/<slug>
📁 Repo:                 recipes/<slug>/
📦 Originale:            .received/hf<NR>/ (gitignored)
🖼  Hero-Bild:           Pfad-A (eigenes Foto) / Pfad-B (AI-Restyle, <retries> Versuche) / Pfad-C (kein Bild)
📊 Stats:                <n> Zutaten · <m> Steps · <k> TTS-Chips
🚀 Commit:               <hash>
```
</output_format>
