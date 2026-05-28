# Playbook — Rezept in 2 Minuten als native-quality Cookidoo Eigenes Rezept

End-to-End-Anleitung: vom Foto/Karte zum interaktiv-startbaren Cookidoo-Rezept mit Guided-Cooking-Chips. Stand 2026-05-15 nach Abschluss des ersten produktiv durchgepipten Rezepts (Sweet-Chili-Bowl).

## Voraussetzungen (einmalig)

```bash
pip3 install playwright
playwright install chromium

git clone https://github.com/meintechblog/thermomix-master.git ~/thermomix-master
cd ~/thermomix-master
python3 automation/00_setup_profile.py
# Im Browser bei cookidoo.de einloggen, Cookie-Banner akzeptieren, Fenster schließen.
# Profil persistiert in ~/thermomix-automation/profile/
```

## Workflow pro Rezept

```bash
# 1. Quellmaterial bereitlegen
mkdir -p recipes/{slug}
cp ~/eigenes-foto.jpg recipes/{slug}/hero.jpg

# 2. INGREDIENTS + STEPS in automation/01_create_recipe.py editieren
# 3. Pipeline durchlaufen:
python3 automation/01_create_recipe.py     # Recipe + Zutaten + Plain-Text Steps
python3 automation/02_upload_image.py recipes/{slug}    # Hero
python3 automation/03_add_tips.py          # Tipps (mit '— ' Prefix!)
python3 automation/04_set_times.py         # Arbeitszeit + Gesamtzeit
python3 automation/05_annotate_chips.py    # 🪄 AI-Annotate → echte Chips
# Optional:
python3 automation/06_publish.py           # nur mit EIGENEM Foto!
```

Gesamtzeit: ~2 Minuten pro Rezept.

## Die 9 nicht-offensichtlichen Qualitätsregeln (aus erstem Live-Run gelernt)

Wer einfach blind eine HelloFresh-Karte in die Step-Texte tippt, bekommt ein „besoffenes" Rezept — die AI-Annotation doppelt Bold-Chips, die Schritte lesen sich repetitiv. Diese acht Regeln sind aus dem ersten Praxis-Iterationszyklus mit Sweet-Chili-Bowl entstanden.

### 1. Per-Step Ingredient Uniqueness

Jede Zutat darf höchstens **1x pro Step** vorkommen. Die AI annotiert ALLE Vorkommen einzeln → zwei Bold-Chips zur gleichen Zutat in einem Step liest sich wie ein Bug.

**Bad**: „...unter kaltem **Wasser** spülen. **1200 g Wasser**, **1,5 TL Salz** ..."
**Good**: „...kurz abspülen. **1200 g Wasser**, **1,5 TL Salz** ..."

### 2. Keine zwei aufeinanderfolgenden Steps mit gleicher End-Phrase

Wenn Step 5 und Step 6 beide mit „mit Salz und Pfeffer abschmecken." enden, liest sich das wie Copy-Paste. **Lösung**: Steps zusammenfassen mit kollektivem Schluss.

**Bad**:
> 5. ... **Sriracha-Mayo** verrühren und mit **Salz** und **Pfeffer** abschmecken.
> 6. ... **Sweet-Chili-Dip** vermengen und ebenfalls mit **Salz** und **Pfeffer** abschmecken.

**Good** (merged in einen Step):
> 5. ... **Sriracha-Mayo** verrühren. ... **Sweet-Chili-Dip** vermengen. Beide Soßen mit **Salz** und **Pfeffer** abschmecken.

### 3. Compound-Namen die Zutaten als Substring enthalten vermeiden

„Sriracha-**Mayo**" enthält das Wort „Mayo", was die AI an „vegane Mayonnaise" matchen könnte. Im gleichen Step wäre dann „Mayonnaise" + „Mayo" beide annotiert → doppelt.

**Bad**: „50 g vegane **Mayonnaise** mit 16 g **Sriracha-Sauce** zur Sriracha-**Mayo** verrühren"
**Good**: Compound-Namen weglassen, der User weiß aus dem Rezepttitel was rauskommt. „50 g vegane Mayonnaise mit 16 g Sriracha-Sauce verrühren."

Gleiches gilt für „Sweet-Chili-**Dip**" / „Sweet-Chili-**Soße**".

### 4. Synonyme zählen als Doppelung

„Basmatireis ... Reis" oder „Buschbohnen ... Bohnen" wird von der AI als overuse erkannt.

**Bad**: „... **Reis** abgedeckt 6 Min. ziehen lassen ... **Reis** mit Gabel auflockern"
**Good**: „... abgedeckt 6 Min. ziehen lassen ... Den **Reis** mit Gabel auflockern"

### 5. Keine doppelten Zutaten mit Catch-all-Sammelposten

Wer „Salz, Pfeffer, Zucker, Öl nach Bedarf" als Sammelposten hat, **nicht zusätzlich** „1,5 TL Salz (zum Reis)" als separate Zeile listen. Sonst entstehen doppelte Salz-Chips.

### 6. Tipps brauchen '— ' Prefix als Bullet

Cookidoo rendert die Tipps **ohne** Auto-Bullets. Jede Zeile mit `— ` (em-dash + Space) starten, sonst verschwimmen alle Tipps zu einem Text-Block.

```
TIPS = (
    "— Aubergine 10 Min. vor dem Marinieren leicht salzen — ...\n"
    "— Reis VOR dem Garen ... klar abspülen — ...\n"
    ...
)
```

### 7. Quellen-Link gehört ans Ende der Tipps

Wenn das Rezept aus einer fremden Quelle stammt (HelloFresh-Karte, Buch, Webseite), den Link am Ende der Tipps-Sektion. Cookidoo hat kein eigenes „Quelle"-Feld für Eigene Rezepte.

```
"...\n"
"\n"
"Quelle: HelloFresh Wochenbox, Karte #33\n"
"https://www.hellofresh.de/recipes/sweet-chili-bowl-mit-glasierter-aubergine-thermomix-695b7cae2a2e2effad1837dd"
```

Cookidoo macht die URL klickbar im Render-View.

### 8. Step-Granularität: EINE Operation pro Step, kurz (REVIDIERT 2026-05-28)

> ⚠️ **Die alte „Median 5 Steps / 250-550 Zeichen"-Regel war falsch** und hat
> Mega-Steps produziert, durch die Jörg am Thermomix nicht durchkam (Räuchertofu #25).
> Korrektur nach Analyse der **echten per-Schritt-Segmentierung** von ~12 Cookidoo-
> Rezepten (`research/native-step-corpus.md`): native Steps sind **kurz**.

Echte Regel:
- **Ein Step = eine Operation** (ein Chip / eine Pfannen- / Ofen- / Anricht-Aktion). Nie zwei Chips.
- **40-130 Zeichen** pro Step (nativer Median ≈ 90). Hart bei ~180.
- **Step-Zahl = Anzahl Operationen**, nicht Zutatenzahl → typisch **6-10 kurze Steps**.
- Zutaten **inkrementell** zugeben; die **Maschine macht die Prep** (zerkleinern/hacken im Mixtopf).
- Manuelle Prep nur per `Währenddessen …` in einen laufenden Maschinen-Step falten.

Beleg (native „Champignonrahmsauce", 5 Steps à 50-178 Zeichen):
`Zwiebeln + Knoblauch zerkleinern` → `Öl zugeben, dünsten. Währenddessen Champignons schneiden` →
`Weißwein zugeben, reduzieren` → `Rahm + Stärke + Bouillon zugeben, mischen` → `Champignons zugeben, garen, servieren`.

Die untenstehende alte Median-Tabelle ist **obsolet** (nur als Mahnmal stehengelassen):

| Zutaten | ~~Native median Steps~~ | ~~Native Range~~ |
|---|---|---|
| 8-12 | ~~4~~ | ~~3-5~~ |
| 13-17 | ~~**5**~~ | ~~4-7~~ |
| 18-25 | ~~6~~ | ~~5-8~~ |

Beispiel-Mapping nach Rewrite (Sweet-Chili-Bowl, 17 Zutaten):

| Aktion | HF-Karte (6) | Mein Rezept v2 (5) |
|---|---|---|
| Limette + Aubergine schneiden + marinieren + Bohnen prep + Ofen heizen | 1+2 Steps | **1 Step** (merged) |
| Reis + Wasser + Dampfgaren + Aubergine in Ofen | 1 Step | 1 Step |
| In der Zwischenzeit: Chili + Frühlingszwiebel + 2 Dips + Gurkensalat | 2 Steps | **1 Step** ("In der Zwischenzeit ...") |
| Bohnen vollenden + Reis fertig | 1 Step | 1 Step |
| Anrichten | 1 Step | 1 Step |

### 9. Native Verb-Vokabular + Zutaten-Format

→ **Master-Liste**: [`skill/thermomix-master/references/native-style-rules.md`](skill/thermomix-master/references/native-style-rules.md) — vollständige Statt/Native-Tabelle, Zutaten-Format, Step-Längen-Verteilung, was native Rezepte NICHT haben.

Faustregel zur Erinnerung: `einwiegen`, `einhängen`, `aufsetzen`/`absetzen`, `mithilfe des Spatels herausnehmen`, `unterheben`, `auf X Bowls verteilen`, `... servieren`. Adjektive immer nach Komma (`1 rote Chilischote, frisch`), Verb-Teile gehören in den Step.

## Konsistenz-Audit-Schritt vor Publish

Vor dem `05_annotate_chips.py`-Run ein 30-Sekunden-Eigen-Audit machen:

```python
# Quick-Check direkt in Python:
from collections import Counter
import re

for i, step in enumerate(STEPS, 1):
    # Zutaten-Mentions im Step finden
    tokens = re.findall(r'\b(?:Wasser|Salz|Pfeffer|Öl|Reis|Aubergine|Buschbohnen|Limette|Limettenspalten|Chili|Gurke|Frühlingszwiebel|Mayonnaise|Sriracha|Sweet-Chili-Soße|Teriyakisoße|Sesamöl)\w*\b', step)
    c = Counter(tokens)
    dupes = [(w,n) for w,n in c.items() if n > 1]
    if dupes:
        print(f"⚠️ Step {i} duplicates: {dupes}")

# Consecutive endings
endings = ['abschmecken.', 'verrühren.', 'vermengen.']
for i in range(1, len(STEPS)):
    for e in endings:
        if STEPS[i-1].endswith(e) and STEPS[i].endswith(e):
            print(f"⚠️ Step {i} and {i+1} both end with '...{e}'")
```

## Meta-Felder (Arbeitszeit, Gesamtzeit, Portionen)

Die drei Tiles unter dem Rezepttitel:
- 🔪 Arbeitszeit (Messer-Icon → `prepTime`)
- 🕐 Gesamtzeit (Uhr-Icon → `totalTime`)
- 👥 X Portionen (Personen-Icon → `recipeYield`)

Klick auf eines der Tiles öffnet ein **gemeinsames Modal** mit 3 Tabs (Zubereitungszeit/Gesamtzeit/Portionsgröße). `automation/04_set_times.py` macht das automatisch — Werte oben im Script editieren:

```python
PREP_MIN = 25     # Arbeitszeit
TOTAL_MIN = 35    # Gesamtzeit
```

## Image-Upload-Spezialitäten

Der Hero-Image-Upload läuft über Cloudinary's Widget in einem **iframe**. Das Script (`02_upload_image.py`) erwartet:

1. `button.cr-manage-image__trigger` — klickt den Bild-Tile (NICHT den Dropdown-Item „Bild hochladen"!)
2. Cloudinary-iframe lokalisieren via `f.url.includes('cloudinary')`
3. `frame.locator("input[type='file']").set_input_files(path)` — Datei setzen
4. `frame.locator("button:has-text('Zuschneiden')")` — Crop bestätigen
5. Top-level `<a>Bestätigen</a>` zum Speichern

## Publishing (nur mit eigenem Foto!)

`automation/06_publish.py` macht `PATCH {workStatus: "PUBLIC", isImageOwnedByUser: true}`. Der zweite Toggle ist eine **rechtliche Selbstzusicherung** des Users. **Nur ausführen wenn das Foto wirklich von dir kommt** — sonst Copyright-Ärger.

Public-URL-Pattern:
```
https://cookidoo.de/created-recipes/public/recipes/de-DE/{recipeId}
```

Anonymous-Besucher sehen Titel + Bild + Zutaten + Geräte + Beschreibung. Die vollständigen Steps + Chips sind hinter dem Cookidoo-Login (Freemium-Modell).

## Häufige Fehler

### „Bestätigen" klickt nicht / klickt das Falsche

Zwei verschiedene Save-Trigger:
- **Global oben rechts**: `<a>Bestätigen</a>` (Anchor!) — speichert die gesamte Edit-Session
- **Pro Feld** (Tipps, Modal): `<button>Bestätigen</button>` (Button!) — speichert nur das Feld

**Reihenfolge wichtig**: erst per-Field-Button, dann global-Anchor. Sonst geht der Feld-Inhalt verloren.

### Cookie-Banner blockt alles

Immer am Anfang:
```python
try: page.locator("#onetrust-accept-btn-handler").first.click(timeout=2000)
except: pass
```

### Schritte werden auseinandergerissen

Im Step-Editor erzeugt **jedes Enter** (auch Shift+Enter) einen **neuen** Step. Soft-Newlines gibt's nicht. Titel und Body in einem Step → mit `: ` oder `. ` trennen, **niemals `\n`**.

### Annotate-API liefert weniger Chips als erwartet

Mögliche Ursachen:
- Cooking-Befehl in unbekanntem Format. Akzeptiert (aus Research):
  - `30 Sek./Stufe 4` · `3 Min./120°C/Stufe 2` · `15 Min./Varoma/Stufe 1` · `6 Min./100 °C/Linkslauf/Stufe 1`
- Stufe-Wert nicht erlaubt (Thermomix kennt 0.5, 1, 1.5, ..., 10, soft, Teig)
- Temperatur nicht in der Liste (`OFF, 37, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 98, 100, 105, 110, 115, 120, 140, 145, 150, 155, 160, Varoma`)

Workaround: TTS-Modal manuell öffnen (⚡-Icon unter dem Step) und Werte eintragen.

### Tipps werden zu einem Block

Du hast die `— ` Prefixe vergessen. Cookidoo's View rendert sonst alle Tipps zu einem Absatz ohne Bullets.

## Nächste Rezepte

Vorschläge für Folge-Rezepte (jeweils mit eigenem Foto):
- Klassische Hausmannskost (z.B. Geschnetzeltes mit Spätzle) — testet andere Cooking-Modes
- Backrezept (z.B. Brot mit Quellstück) — testet Mode-Glyphs (Teig kneten ``)
- Smoothie / Kalter Salat — kein TTS-Chip, nur Ingredient-Linking
- Suppe / Eintopf — testet längere Garzeiten / Temperaturen
