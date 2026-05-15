# Cookidoo Master

**Beliebige Rezepte (HelloFresh-Karte, Kochbuch, Foto) als _native-quality_ Cookidoo-„Eigene Rezepte" anlegen — inkl. interaktiver Koch-Befehle, die der Thermomix auto-ausführt.**

## Warum

Wenn du am Thermomix ein Rezept aus einer HelloFresh-Box, aus einem Buch oder von einer Webseite kochen willst, musst du normalerweise alles manuell am Display eintippen — Zutaten, Schritte, jeden einzelnen Wert (`18 Min./Varoma/Stufe 1`). Das ist nervig und fehleranfällig.

Cookidoo hat zwar das Feature „Eigene Rezepte / Meine Kreationen", aber:
- Die UI erlaubt nur reines Text-Tippen → keine interaktiven Koch-Befehle
- Wer den schicken **Guided-Cooking**-Modus haben will (Thermomix dreht den Mixer automatisch auf 18 Min./Varoma/Stufe 1), muss durch ein verstecktes Multi-Tab-Popover navigieren und für jeden Befehl 5-7 Klicks machen
- Das Sharing/Backup von eigenen Rezepten ist schwach dokumentiert

Dieses Repo löst das. Es enthält:

1. **Playwright-Skripte**, die per Browser-Automation aus einem HelloFresh-Foto ein voll-strukturiertes Cookidoo-Eigenes-Rezept anlegen — inklusive **interaktiver Koch-Befehl-Chips** (`<nobr class="recipe-content__accent">18 Min./Varoma/Stufe 1</nobr>`) und Zutaten-Verknüpfungen.
2. **Das `/created-recipes/de-DE/annotate/steps` Reverse-Engineering**: Cookidoo hat eine versteckte AI-Annotate-API, die Plain-Text-Schritte nimmt und automatisch alle Koch-Befehle und Zutaten-Mentions als strukturierte Annotationen zurückgibt. Niemand spricht öffentlich darüber. Dieses Repo zeigt wie's funktioniert.
3. **Playbook** für die End-to-End-Pipeline: PDF/Karte → Cookidoo-Rezept mit Bild, Tipps, Koch-Befehlen, in ~2 Minuten.
4. **Native-Recipe-Research** — Strukturanalyse von 5 echten Vorwerk-Rezepten (Brot, Kuchen, Smoothie, Suppe, Bowl), um zu verstehen welche Granularität, welche Befehlsformate, welche Mode-Glyphs üblich sind.

## Status

🎉 **Voll funktional.** Erstes durchgepipte Rezept: [Sweet-Chili-Bowl mit glasierter Aubergine](recipes/sweet-chili-bowl/) — alle 13 Schritte, alle Koch-Befehle als interaktive Chips, alle Zutaten verlinkt.

![Step 5 mit interaktivem Koch-Befehl-Chip](docs/assets/zoom-step5-with-chips.png)

> _Native-Qualität auf den ersten Blick: `1200 g Wasser`, `1,5 TL Salz` und **`18 Min./Varoma/Stufe 1`** als hervorgehobene, am Thermomix klickbare Chips._

## Quick Start

```bash
# Voraussetzungen
brew install python3
pip3 install playwright
playwright install chromium

# Persistent Browser-Profil mit Cookidoo-Login einrichten
python3 automation/01_create_recipe.py    # legt leeres Rezept an, du loggst dich manuell ein (einmalig)

# Dann pro neuem Rezept:
python3 automation/02_native_style_steps.py     # Zutaten + native-style Schritte
python3 automation/03_upload_image.py           # Bild hochladen
python3 automation/04_add_tips.py               # Tipps-Sektion
python3 automation/05_annotate_chips.py         # 🪄 AI-Annotate → echte Koch-Befehl-Chips
```

Details: siehe [PLAYBOOK.md](PLAYBOOK.md).

## Repo Layout

```
cookidoo-master/
├── README.md             ← du bist hier
├── PLAYBOOK.md           ← Schritt-für-Schritt-Anleitung pro neuem Rezept
├── LEARNINGS.md          ← Alle Reverse-Engineering-Findings (APIs, DOM, Edge Cases)
├── automation/           ← Working Playwright-Scripts (chronologisch nummeriert)
├── research/             ← Native-Recipe-Patterns, JS-Bundle, Researchdaten
├── recipes/              ← Pro Rezept: Quellfoto, Markdown, Cookidoo-Link
│   └── sweet-chili-bowl/
└── docs/assets/          ← Screenshots fürs README
```

## Lizenz & Disclaimer

- Code: MIT
- **Rezeptbilder & -inhalte**: Original-Copyright bei HelloFresh / dem jeweiligen Rechteinhaber. Dieses Repo zeigt nur den technischen Workflow. Wer ein Rezept via diesem Toolset auf Cookidoo veröffentlichen will, muss eigene Rechte am Bild haben oder ein eigenes Foto verwenden.
- Cookidoo / Thermomix sind Marken der Vorwerk International AG & Co. KmG. Dieses Projekt ist **nicht** mit Vorwerk verbunden und nicht offiziell unterstützt.
- Die `/created-recipes/de-DE/annotate/steps` API ist undokumentiert und kann sich jederzeit ändern. Use at your own risk.

## Mitmachen

Issues und PRs willkommen. Besonders gefragt: weitere Rezepte (Foto + Cookidoo-Link in `recipes/`), Erweiterungen für andere Lokale (en-US, fr-FR), Edge-Cases im Annotate-API.
