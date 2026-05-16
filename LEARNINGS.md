# Cookidoo Reverse-Engineering Learnings

Alle Erkenntnisse aus dem End-to-End-Reverse-Engineering der Cookidoo "Eigene Rezepte" / "Meine Kreationen"-Pipeline, gesammelt am 2026-05-15 beim Bau des ersten automatisierten Rezepts.

## TL;DR — die wichtigste Entdeckung

**Cookidoo hat eine undokumentierte AI-Annotate-API** unter `POST /created-recipes/de-DE/annotate/steps`. Sie nimmt einen Plain-Text-Rezept-Payload und gibt strukturierte Tokens zurück: jede „1200 g Wasser"-Mention wird zur `INGREDIENT`-Annotation, jedes „18 Min./Varoma/Stufe 1" zur `TTS`-Annotation. Wer das nutzt, bekommt für seine Eigenen Rezepte die **gleiche Guided-Cooking-Erfahrung wie bei nativen Vorwerk-Rezepten**.

Die Frontend-UI legt das hinter dem „Smarte Funktionen ✨"-Button im Schritt-Editor — pro Schritt, manuell, ein Klick gleichzeitig. Per API-Call kann man **alle Schritte in einer Anfrage** annotieren lassen.

## DOM / Custom Elements

Cookidoo's Editor ist eine Sammlung von Web Components. Die wichtigen:

| Element | Rolle |
|---|---|
| `cr-edit-tabs` | Tab-Container (Zutaten / Schritte) mit globalem Save-State |
| `cr-manage-ingredients` | Liste aller Zutaten, hat `getIngredients()` und `save()`-API |
| `cr-manage-steps` | Liste aller Schritte, hat `getInstructions()` und `save()`-API |
| `cr-step-text-field` | Einzelner Schritt-Wrapper mit Toolbar (TTS / Ingredient / Annotate) |
| `cr-text-field` | Contenteditable Textfeld (für Zutat ODER Schritt) |
| `cr-tts` | Custom Element für strukturierten Koch-Befehl (`time`, `temperature`, `speed`, `direction` Attribute) |
| `cr-ingredient` | Custom Element für strukturierte Zutaten-Referenz (`description` Attribut) |
| `cr-mode` | Custom Element für Mode-Befehle wie „Teig kneten" (`name` Attribut) |
| `cr-tts-modal` | Popover für manuelle Koch-Einstellung — hat `openAdd(trigger)` und Save via Event-Dispatch |

So sieht das `cr-tts-modal` aus (Tab „Manuell" mit Min/Sek-Inputs, Temperatur-Dropdown, Stufe-Dropdown, grüner Save-Haken oben rechts):

![cr-tts-modal Popover](docs/assets/tts-popover.png)

Den Weg via UI-Klick auf den grünen Haken zu emulieren ist unzuverlässig (Trusted-Event-Check schlägt fehl). Stattdessen direkt das `annotation-modal-save`-Event dispatchen — oder besser die `annotate/steps`-API nutzen (siehe unten).

### Wichtige Selektoren (Cheat-Sheet)

```python
# Zutat-Eingabefelder:
"cr-manage-ingredients cr-text-field[contenteditable='true']"

# Schritt-Eingabefelder:
"cr-manage-steps cr-text-field[contenteditable='true']"

# Kebab-Menü pro Zeile (für „Löschen"):
"cr-manage-steps button.cr-manage-list__menu-button"

# Bild-Upload-Tile (auf Meta-Edit-Seite):
"button.cr-manage-image__trigger"

# Globaler Save-Button:
"a:has-text('Bestätigen')"  # ist ein <a>, NICHT <button>!

# Per-Field-Save (Tipps-Feld):
"button:has-text('Bestätigen')"  # IST ein <button>
```

## Die `annotate/steps` API — das Goldstück

**Endpoint**: `POST /created-recipes/de-DE/annotate/steps`
(Pfad aus `cr-edit-tabs[annotate-api-url]`-Attribut auslesen)

**Request:**
```json
{
  "recipe": {
    "recipeId": "01KRNNR72NTN1C0PTD67PA8W7D",
    "instructions": [
      {"type": "STEP", "text": "1200 g Wasser, 1,5 TL Salz und 5 g Öl in den Mixtopf geben, Varoma aufsetzen und 18 Min./Varoma/Stufe 1 dampfgaren."}
    ],
    "ingredients": [
      {"type": "INGREDIENT", "text": "300 g Basmatireis"},
      {"type": "INGREDIENT", "text": "1200 g Wasser"}
    ]
  },
  "options": {"stepIndexes": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
}
```

**Response** (gekürzt):
```json
{
  "recipeContent": {
    "instructions": [
      [
        {"type": "INGREDIENT", "text": "1200 g Wasser", "settings": {"description": "1200 g Wasser"}},
        {"type": "TEXT", "text": ", "},
        {"type": "INGREDIENT", "text": "1,5 TL Salz", "settings": {"description": "1,5 TL Salz"}},
        {"type": "TEXT", "text": " und 5 g Öl in den Mixtopf geben, Varoma aufsetzen und "},
        {"type": "TTS", "text": "18 Min./Varoma/Stufe 1", "settings": {"time": 1080, "time-unit": "s", "temperature": "varoma", "speed": "1"}},
        {"type": "TEXT", "text": " dampfgaren."}
      ]
    ]
  }
}
```

**Token-Typen die zurückkommen:**
- `TEXT`: nackter Text-Run
- `INGREDIENT`: erkannte Zutaten-Mention → settings.description (full ingredient line) + optional `notes` (z.B. "overuse" wenn mehrfach genannt)
- `TTS`: erkannter Koch-Befehl → settings = {time, time-unit, temperature, [temperature-unit], speed, [direction]}
- `MODE`: erkannter Modus (Teig kneten / Pürieren / Anbraten / Dampfgaren / Warm halten / Reis kochen) → settings.name
- `MISSED_INGREDIENT`: Zutat in der Liste, die aber im Schritt nicht erwähnt wird → wird mit Warn-Glyph `` als unsichtbares Tag eingefügt

**Persistenz**: Nach dem Annotate muss man die Antwort in HTML umwandeln (Template aus `convertInstructionToHtml` im Bundle) und in die `cr-text-field.innerHTML` einsetzen, dann `cr-manage-steps.save()` aufrufen. Der Save-Call PATCHt `/created-recipes/de-DE/{id}` mit `instructions: [{type:"STEP", text, annotations: [{type, data, position}]}]` — die `annotations` sind das, was server-side persistent gespeichert wird.

### Token → HTML (replizieren von `convertInstructionToHtml`)

```js
const tokenToHtml = (t) => {
  const settings = t.settings ? Object.keys(t.settings).map(k => `${k}="${t.settings[k]}"`).join(' ') : '';
  if (t.type === 'TEXT') return t.text;
  if (t.type === 'MISSED_INGREDIENT') return ` <cr-ingredient missing ${settings}></cr-ingredient>`;
  return `<cr-${t.type.toLowerCase()} ${settings}>${t.text}</cr-${t.type.toLowerCase()}>`;
};
```

## Die `cr-tts` Custom Element Datenstruktur

Aus dem Bundle (class `N`):

```js
get speed()       // attribute "speed",        z.B. "1", "2.5", "soft"
get direction()   // attribute "direction",    "CW" (Normal) | "CCW" (Linkslauf, default null wenn CW)
get time()        // attribute "time" (parsed as int, seconds)
get temperature() // attribute "temperature" + "temperature-unit",
                  //   z.B. {value: "Varoma", unit: "C"} oder {value: "100", unit: "C"} oder null wenn "OFF"

getAnnotation() {  // wird vom Save serialisiert
  return {
    type: "TTS",
    data: {
      speed: this.speed,
      direction: this.direction,
      time: this.time,
      temperature: this.temperature
    }
  }
}
```

**Beispiel-Chip:**
```html
<cr-tts time="1080" time-unit="s" temperature="varoma" speed="1">18 Min./Varoma/Stufe 1</cr-tts>
<cr-tts time="360" temperature="100" temperature-unit="C" speed="1" direction="CCW">6 Min./100°C/Linkslauf/Stufe 1</cr-tts>
```

## Konsistenz / Redundanz beim Step-Text — die nicht-offensichtlichen Fallen

Beim Schreiben der Plain-Text-Steps, die später durch `annotate/steps` zu Chips werden, gibt es ein paar Gotchas, die das gerenderte Rezept „besoffen" aussehen lassen wenn man sie ignoriert:

### Regel: jede Zutat höchstens 1x pro Step

Die AI annotiert ALLE Vorkommen einer Zutat im Step-Text, jedes mit eigenem Chip. Zwei Chips zur gleichen Zutat im gleichen Step ist visuelle Redundanz. Beispiele:

**Bad** (Step 4):
```
... Reis in den Gareinsatz geben und unter kaltem WASSER spülen.
... 1200 g WASSER, 1,5 TL Salz und 5 g Öl in den Mixtopf ...
```
→ 2x „Wasser" als Chip nebeneinander, sieht doppelt-bezahlt aus.

**Good**:
```
... Reis in den Gareinsatz geben, kurz abspülen.
... 1200 g Wasser, 1,5 TL Salz und 5 g Öl in den Mixtopf ...
```
→ 1x „1200 g Wasser" als Chip, sauber.

### Regel: Compound-Namen die andere Zutaten als Substring enthalten vermeiden

Die AI matcht via Substring. „Sriracha-Mayo" ist kein eigener Zutaten-Eintrag, aber enthält „Sriracha" — das matched die Sriracha-Sauce-Zutat zweimal wenn beide im gleichen Step auftauchen.

**Bad**:
```
50 g vegane Mayonnaise mit 16 g Sriracha-Sauce zur Sriracha-Mayo verrühren ...
```
→ „Sriracha-Sauce" + „Sriracha-Mayo" beide annotiert.

**Good**: einfach den Compound-Namen weglassen, der User weiß aus dem Rezepttitel wie das Ergebnis heißt.
```
50 g vegane Mayonnaise mit 16 g Sriracha-Sauce und 2 Limettenspalten verrühren ...
```

Gleiches gilt für „Sweet-Chili-Dip" (würde mit „Sweet-Chili-Soße" doppeln). Workaround in der Folgeverwendung: „2 EL des Dips aus Schritt 6" — „Dip" alleine matcht keine Zutat.

### Regel: Synonyme wie „Basmatireis" / „Reis" oder „Buschbohnen" / „Bohnen" — auch 1x pro Step

Die AI behandelt sie als overuse-Match. Lieber EIN Wort konsistent verwenden, oder den zweiten Vorfall durch Pronomen / Referenzphrase ersetzen.

**Bad**: „Gareinsatz herausnehmen und Reis 6 Min. ruhen lassen. ... Den Reis mit Gabel auflockern."
**Good**: „Gareinsatz herausnehmen und abgedeckt 6 Min. ruhen lassen. ... Den Reis mit Gabel auflockern."

### Regel: keine zwei aufeinanderfolgenden Steps enden gleich

Wenn zwei aufeinanderfolgende Steps beide mit „mit Salz und Pfeffer abschmecken." enden (oder anderen identischen Schluss-Phrasen wie „verrühren.", „abschmecken."), liest sich das wie eine Doppelung. **Lösung**: die beiden Steps zu einem zusammenfassen mit kollektivem Schluss: „... Beide Soßen mit Salz und Pfeffer abschmecken.".

Quick self-check script:
```python
for i in range(1, len(instructions)):
    for ending in ['abschmecken.', 'verrühren.', 'vermengen.']:
        if instructions[i-1].endswith(ending) and instructions[i].endswith(ending):
            print(f"⚠️ Step {i} and {i+1} both end with '...{ending}'")
```

### Regel: keine doppelten Zutatenlisten-Einträge mit Catch-all-Sammelposten

Wer „Salz, Pfeffer, Zucker, Öl nach Bedarf" als Catch-all-Zeile in der Zutatenliste hat, sollte NICHT zusätzlich „1,5 TL Salz (zum Reis)" als separate Zeile listen. Die AI kann beide matchen → mehrfache Salz-Chips für die gleiche Salz-Erwähnung. Lösung: spezifische Salz-Mengen nur inline im Step, Catch-all-Zeile reicht als Zutat.

## Meta-Felder (Arbeitszeit, Gesamtzeit, Portionen)

Auf der Meta-Edit-Seite (`/edit` ohne `/ingredients-and-preparation-steps`) sind drei Tiles unter dem Rezepttitel:
- 🔪 Arbeitszeit hinzufügen (PT…M / `prepTime`)
- 🕐 Gesamtzeit hinzufügen (PT…M / `totalTime`)
- 👥 X Portionen (yield)

Jeder Tile ist ein `<div class="cr-recipe-settings-tiles__item">`. **Klick öffnet ein Modal mit drei Tabs** (Zubereitungszeit / Gesamtzeit / Portionsgröße). Jeder Tab hat 2 visible `input[type=number]` für Stunden + Minuten (bzw. Portionszahl).

- Tab-Button: `button:has-text('Gesamtzeit')` / `'Zubereitungszeit'` / `'Portionsgröße'`
- Speichern: `button:has-text('Bestätigen')` im Modal-Footer (Button, kein Anchor)

Werte werden im Recipe-JSON als ISO-8601-Duration gespeichert: `prepTime: "PT25M"`, `totalTime: "PT35M"`.

## Tipps-Feld Rendering

`textarea[name='hints']`. Cookidoo rendert die Tipps in der View als **fortlaufenden Text-Block** ohne automatische Bullets. Wer Tipps als Liste haben will, muss **jede Zeile mit `— ` (em-dash + space) prefixen** — sonst verschwimmen alle Tipps zu einem Absatz.

Was NICHT funktioniert:
- `•` (bullet) Prefix — rendert als nacktes Bullet ohne Hanging-Indent
- `- ` (ASCII-Dash) — wird kosmetisch fade
- Leerzeilen zwischen Tipps — werden vom Renderer auf einfachen Linebreak normalisiert

Was gut funktioniert:
- `— ` (em-dash + space) — visuell sauber, signalisiert „Liste"

**Per-field Save**: NACHDEM man die Tipps geändert hat, erscheint ein **`<button>Bestätigen</button>`** direkt am Textarea. Den klicken **bevor** man den globalen `<a>Bestätigen</a>` oben klickt — sonst geht der Tipps-Inhalt verloren.

## UI-Drift — Stand 2026-05-16

Cookidoo updatet die Frontend-UI regelmäßig. Bisher gesehene Drifts:

| Datum | Was | Workaround |
|---|---|---|
| 2026-05-16 | „Rezept erstellen" ist jetzt im Floating-Action-Button (FAB) bottom-right (`cr-floating-button#floating-button`), nicht mehr als Top-Level-Button | Erst `cr-floating-button#floating-button` clicken → dann `button#create-button`. Der FAB hat auch einen `button#import-button` (neuer Import-Workflow, noch nicht reverse-engineered) |

Bei Pipeline-Brüchen lohnt sich immer: `page.evaluate(...)` mit einem Filter auf sichtbare Buttons/Anchors um den neuen Trigger zu finden. Beispiel in `/tmp/cookidoo/inspect_create_button.py` (CI-style DOM-Audit).

## Was NICHT geht (Hard Limits)

- **Direkt-Injection von `<nobr>`-Tags** in user-content wird serverseitig gestrippt. Nur Vorwerk-published Recipes dürfen `<nobr>` als persistenten Format-Tag. User-created Recipes nutzen `<cr-tts>` etc. (die im View dann als `<nobr class="recipe-content__accent">` gerendert werden).
- **Section Headers** (`<h5>Vorbereitung</h5>`, `<h5>Hauptteig</h5>` etc.) werden im Eigene-Rezepte-Editor **nicht** unterstützt. Native-Recipes haben sie via `recipe-content__inner-title`. Workaround: Schritte logisch gruppieren ohne Header.
- **TTS-Modal-Save via UI** ist schwer programmatisch zu triggern. Der grüne Haken klickt nichts ins Step-Text, wenn er via Playwright-Click ausgelöst wird (sieht aus als ob Trusted-Event-Check fehlschlägt). Workaround: Dispatch `annotation-modal-save` direkt → triggert den richtigen Listener-Pfad. Oder besser: die `annotate/steps`-API nutzen (siehe oben).

## Wichtige Bundle-Strings (für künftige Recherche)

JS-Bundle: `https://patternlib-all.prod.external.eu-tm-prod.vorwerk-digital.com/pl-customer-recipes-X.Y.Z-....js` (URL ändert sich mit jedem Release — aus `<script src=>` der Edit-Seite ziehen).

Key Functions (Suchstrings):
- `onTtsButtonClick` — Wenn der TTS-Button geklickt wird (öffnet Popover korrekt mit Cursor-Position)
- `openAdd` — `cr-tts-modal`-Methode zum Öffnen im Add-Modus
- `annotation-modal-save` — CustomEvent das den Chip einfügt
- `createElement(t,r)` — der eigentliche Chip-Insert
- `getAnnotations(t)` — extrahiert {type, data, position} aus den childNodes (für Save-Payload)
- `getInstruction(t)` — pro Schritt: {type, text, annotations, missedUsages}
- `getInstructions()` — liefert das Array für die Save-Anfrage
- `convertInstructionToHtml(e)` — wandelt Annotate-Response-Tokens in HTML zurück
- `handleAnnotateStepSuccess(e,t,r)` — Editor's Verarbeitung der Annotate-Antwort

## API-Endpoints (alle authentifiziert via Cookie/Session)

| Methode | URL | Zweck |
|---|---|---|
| `GET` | `/created-recipes/de-DE/{id}` | Rezept abrufen (`Accept: application/json`) |
| `PATCH` | `/created-recipes/de-DE/{id}` | Felder updaten: `image`, `instructions`, `ingredients`, `workStatus`, `hints`, etc. |
| `POST` | `/created-recipes/de-DE/annotate/steps` | AI-Annotate (das Goldstück) |
| `POST` | `/created-recipes/de-DE/` | Neues Rezept anlegen (Body: `{name}`) |
| `DELETE` | `/created-recipes/de-DE/{id}` | Rezept löschen |

## Sharing / Public

Rezepte sind standardmäßig `workStatus: "PRIVATE"`. Sharing-URL-Pattern:
```
https://cookidoo.de/created-recipes/public/recipes/de-DE/{recipeId}
```

Erst nach `PATCH {workStatus: "PUBLIC", isImageOwnedByUser: true}` erreichbar — und der `isImageOwnedByUser`-Toggle ist eine rechtliche Selbstzusicherung des Users. Wer ein fremdes Bild hochlädt und auf PUBLIC schaltet, riskiert Copyright-Ärger.

Native Sharing-Buttons (Facebook/Twitter/WhatsApp/Pinterest/Mail) bauen die URL bereits aus diesem Pattern, sind also nutzbar sobald PUBLIC.

## Cookie-Banner

`#onetrust-accept-btn-handler` muss bei jedem fresh-launch des Profils einmal geklickt werden, sonst overlay-blockt OneTrust alle anderen Klicks. Persistent-Profile akzeptieren das einmal und merken's.

## Native-Style Step-Granularität (Deep-Research 12 Vorwerk-Rezepte)

Nach dem ersten 8-Step-Rezept Deep-Research auf 12 native Vorwerk-Bowls/Currys/Pfannen-Rezepte (gesammelt via Search-API + URL-Scraping, persisted in `/tmp/cookidoo/deep/research.json`) ergab folgendes Muster:

### Step-Anzahl ≠ Zutaten-Anzahl

| Zutaten | Native median Steps | Native Range |
|---|---|---|
| 8-12 | 4 | 3-5 |
| 13-17 | **5** | 4-7 |
| 18-25 | 6 | 5-8 |

Mein erstes Rezept hatte 14 Zutaten und **8 Steps** — die native Median-Erwartung wären **5 Steps** gewesen. Native Rezepte gruppieren Vorbereitungsphasen aggressiver in einen einzigen „Vorbereitung"-Step und bündeln parallele Tasks in einen „In der Zwischenzeit ..."-Step.

### Native Verb-Vokabular

Native Vorwerk-Steps sind **kompakter** und nutzen technische Verben, die der Thermomix-Display kennt:
- `einwiegen` (in den Gareinsatz/Mixtopf) — nicht „einfüllen"
- `einhängen` (Gareinsatz) — nicht „einsetzen"
- `aufsetzen` / `absetzen` (Varoma) — nicht „aufstellen / abnehmen"
- `mithilfe des Spatels herausnehmen` — nicht nur „herausnehmen"
- `unterheben` (Sesamöl etc.) — nicht „dazugeben"
- `auf X Bowls/Tellern verteilen` — nicht „in Schüsseln anrichten"
- `... servieren` als Schluss-Verb — nicht „Guten Appetit!"
- `In der Zwischenzeit ...` als Lead-in für Parallel-Schritte

### Native Zutaten-Format

- **Adjektive nach Komma**: `1 rote Chilischote, frisch` (nicht „1 frische rote Chilischote")
- **Modifikator nach Komma**: `1 Limette, gewachst` (nicht „1 Limette (gewachst), in 6 Spalten geschnitten" — der Verb-Teil gehört in den Step!)
- **Spezifische Mengen** statt Catch-all: `2 TL Salz`, `25 g Öl`, `1-2 Prisen Pfeffer`, `1 Prise Zucker` (statt „Salz, Pfeffer, Zucker, Öl nach Bedarf")
- **Bindestrich-Soßen**: `Sriracha-Sauce`, `Sweet-Chili-Soße`, `Teriyakisoße`

### Step-Längen-Verteilung

Native Steps für 14-17-Zutaten-Rezepte haben **250-550 Zeichen pro Step**. Mein 5-Step-Rewrite landete bei 253, 308, 314, 425, 536 Zeichen — passt zur nativen Verteilung. Kürzere Steps (< 200 Zeichen) sind selten und meist nur „Anrichten"-Schluss.

### Was native Rezepte NICHT haben

- `Guten Appetit!` — wird in 0 von 12 native Rezepten gefunden
- Doppelpunkte vor Listen („Toppings: Reis, Bohnen ...") — native nutzt Fließtext
- Hinweise in Klammern direkt in der Zutatenliste — native packt sie in den Step

## Locale-Awareness

Alle Pfade hier sind `de-DE`. Andere Locales (`en-US`, `fr-FR`, etc.) haben die gleiche Struktur, nur die URL-Segmente und die Texte sind anders. Die TTS-Glyphs (`` kneten, `` steaming, `` weighing, `` blend, `` direction) sind locale-unabhängig.
