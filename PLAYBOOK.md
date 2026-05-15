# Playbook — Rezept in 2 Minuten als native-quality Cookidoo Eigenes Rezept

End-to-End-Anleitung: vom Foto/Karte zum interaktiv-startbaren Cookidoo-Rezept inkl. Guided-Cooking-Chips.

## Voraussetzungen (einmalig)

```bash
# Playwright + Chromium
pip3 install playwright
playwright install chromium

# Repo klonen
git clone https://github.com/meintechblog/cookidoo-master.git ~/cookidoo-master
cd ~/cookidoo-master
```

Browser-Profil einrichten und manuell bei cookidoo.de einloggen:

```bash
python3 automation/00_setup_profile.py
# Im sich öffnenden Browser einloggen, Cookie-Banner akzeptieren, Fenster schließen.
# Profil wird nach ~/cookidoo-automation/profile/ persistent abgelegt.
```

## Pro Rezept — der Workflow

### 1. Quellmaterial bereitlegen

- Foto vom Rezept (HelloFresh-Karte, Buchseite, Webseite-Screenshot)
- Liste der Zutaten + Mengen
- Liste der Zubereitungsschritte als Plain-Text

Für HelloFresh-Karten reicht oft schon der Suchname — der Bild-Loader (`03_upload_image.py`) zieht das Hero-Bild via `og:image` direkt von hellofresh.de.

### 2. Rezept anlegen + Zutaten + Schritte

Edit `automation/01_create_recipe.py`:
```python
RECIPE_NAME = "Mein Rezeptname"
INGREDIENTS = ["300 g Basmatireis", "2 Auberginen", ...]
STEPS = [
    "Aubergine längs vierteln, ...",
    "1200 g Wasser, 1,5 TL Salz und 5 g Öl in den Mixtopf geben, Varoma aufsetzen und 18 Min./Varoma/Stufe 1 dampfgaren.",
    ...
]
```

**Wichtig zur Step-Granularität** (basierend auf Research nativer Rezepte):
- 1 Schritt = 1 atomare Aktion (vermeide „und dann ... und dann ...")
- Max. 1 Koch-Befehl pro Schritt
- Koch-Befehl steht im Step-Text als plain `18 Min./Varoma/Stufe 1` — die AI erkennt das in Schritt 5
- Zielgranularität: 8-15 Schritte für ein normales Hauptgericht (Vergleichswerte: Suppe 5, Bowl 5-7, Brot 5-7 mit Sektionen)

Run:
```bash
python3 automation/01_create_recipe.py
```

### 3. Bild hochladen

```bash
# Bild manuell ins ./recipes/{slug}/hero.jpg legen, dann:
python3 automation/02_upload_image.py recipes/sweet-chili-bowl
```

Cookidoo öffnet das Cloudinary-Widget-Iframe; das Script setzt die Datei via `input[type=file].set_input_files()` und klickt „Zuschneiden".

### 4. Tipps hinzufügen

```bash
python3 automation/03_add_tips.py
```

Beachten: das Tipps-Feld hat einen **eigenen** Per-Field-Save-Button (echter `<button>`, nicht der globale `<a>Bestätigen</a>`). Beide klicken sonst gehen die Tipps verloren.

### 5. 🪄 Das Goldstück — AI-Annotate für Koch-Chips

```bash
python3 automation/05_annotate_chips.py
```

Das Script:
1. Liest die aktuelle Rezept-Definition aus dem Editor (`getInstructions()` + `getIngredients()`)
2. Schickt sie per `POST /created-recipes/de-DE/annotate/steps` an Cookidoo's AI
3. Bekommt für jeden Schritt die strukturierten Tokens zurück (TEXT, INGREDIENT, TTS, MODE)
4. Wandelt sie in HTML um (Replikation des `convertInstructionToHtml`-Helpers aus dem Bundle)
5. Setzt die Token-HTML als `innerHTML` jedes Schritt-Textfeldes
6. Triggert `cr-manage-steps.save()` → PATCH speichert die Annotationen server-side
7. Im Recipe-View erscheinen die Befehle nun als `<nobr class="recipe-content__accent">`-Chips
8. Auf dem Thermomix sind sie klick-/auto-ausführbar

### 6. Final-Check

Öffne https://cookidoo.de/created-recipes/de-DE/ und such dein Rezept. Es sollte:
- ✅ Hero-Bild zeigen
- ✅ Alle Zutaten als bullet list
- ✅ Schritte mit **fett** hervorgehobenen Zutaten-Mentions
- ✅ Koch-Befehle als hervorgehobene Chips
- ✅ Tipps-Sektion
- ✅ Großen grünen **„Heute kochen"**-Button → startet Guided Cooking am Thermomix

## Optionales: Öffentlich teilen

```bash
python3 automation/06_publish.py
```

⚠️ **Wichtig**: Nur ausführen wenn du das Bild selbst gemacht hast oder die Rechte daran hast. Cookidoo verlangt eine Eigentumsbestätigung — wer Fremdbilder nutzt riskiert Copyright-Probleme.

Public-URL-Format:
```
https://cookidoo.de/created-recipes/public/recipes/de-DE/{recipeId}
```

## Troubleshooting

### „Bestätigen" klickt nicht
Es gibt zwei `Bestätigen`-Trigger:
- **Global oben rechts**: `<a class="cr-edit-tabs__confirm-button">` — speichert die ganze Edit-Session
- **Pro Feld** (z.B. Tipps): `<button>` — speichert nur das Feld

Beim Tipps-Feld den Button ZUERST klicken, dann den Anchor. Sonst verlierst du den Tipps-Inhalt.

### Schritte werden auseinandergerissen
Im Cookidoo-Step-Editor erzeugt **jedes Enter** (auch Shift+Enter) einen **neuen** Schritt. Soft-Newlines gibt's nicht. Wenn dein Step einen „Titel" haben soll, mit `: ` trennen statt `\n`.

### Cookie-Banner blockt alles
```python
try:
    page.locator("#onetrust-accept-btn-handler").first.click(timeout=2000)
except: pass
```
…sollte am Anfang jedes Scripts stehen. Persistent-Profile merken sich die Akzeptanz dauerhaft.

### AI-Annotate liefert komische Mentions („overuse" Notes)
Wenn die AI z.B. „Aubergine" in mehreren Schritten findet, markiert sie ab dem zweiten Mal mit `notes: [{type: "overuse"}]`. Das ist nur ein Hinweis im Editor, sieht im View unauffällig aus. Kein Bug.

### TTS-Chip fehlt obwohl Befehlstext im Step steht
Mögliche Ursachen:
- Befehl-Format passt nicht zum AI-Pattern. Akzeptierte Formate (aus Research):
  - `30 Sek./Stufe 4`
  - `3 Min./120°C/Stufe 2`
  - `15 Min./Varoma/Stufe 1`
  - `6 Min./100 °C/Linkslauf/Stufe 1`
- Tippfehler in der Einheit (`100C` statt `100°C`)
- Stufe-Wert nicht erlaubt (Thermomix kennt 0.5, 1, 1.5, 2, ..., 10, soft, Teig)

Workaround: TTS-Modal manuell öffnen (⚡-Icon unter dem Step) und Werte eintragen, dann normaler Save.

## Nächste Schritte

- Mehrere Rezepte parallel batchen (Loop über `recipes/*` Ordner)
- Auto-OCR aus HelloFresh-PDF → Zutaten- und Step-Listen
- Native section headers per CSS-Hack injizieren?
- Auto-Publish-Pipeline (nur wenn Bild self-shot)
