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

## Locale-Awareness

Alle Pfade hier sind `de-DE`. Andere Locales (`en-US`, `fr-FR`, etc.) haben die gleiche Struktur, nur die URL-Segmente und die Texte sind anders. Die TTS-Glyphs (`` kneten, `` steaming, `` weighing, `` blend, `` direction) sind locale-unabhängig.
