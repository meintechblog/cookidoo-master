# Automation Scripts

Chronologisch nummerierte Playwright-Scripts für den End-to-End-Workflow.

| Datei | Zweck |
|---|---|
| `00_setup_profile.py` | Einmalig: Browser öffnen, manuell bei cookidoo.de einloggen, Cookie-Banner akzeptieren |
| `01_create_recipe.py` | Neues Eigenes Rezept anlegen, Zutaten + plain-text Schritte einfügen |
| `02_upload_image.py` | Hero-Bild über das Cloudinary-Widget hochladen + croppen |
| `03_add_tips.py` | Tipps-Sektion füllen (mit dem speziellen Per-Field-Save) |
| `04_replace_steps.py` | Optional: alle Schritte löschen + neu setzen (für Restrukturierung) |
| `05_annotate_chips.py` | 🪄 Das Goldstück: AI-Annotate → echte interaktive Koch-Befehl-Chips |
| `06_publish.py` | Optional: Rezept auf PUBLIC schalten (⚠️ nur mit eigenem Bild) |

## Gemeinsame Konventionen

- Alle Scripts nutzen ein persistentes Playwright-Profil: `~/cookidoo-automation/profile/` (per `.gitignore` ausgenommen)
- Cookie-Banner-Akzeptanz und Login werden im Profil persistiert; nach `00_setup_profile.py` läuft alles ohne weitere User-Interaktion
- Die Recipe-ID wird in `~/cookidoo-automation/current_recipe.txt` gespeichert von Script 01, damit nachfolgende Scripts sie lesen können
- Locale ist auf `de-DE` hardcoded — für andere Locales die URL-Pfade anpassen

## Ein Lauf von Anfang bis Ende

```bash
# Einmalig:
python3 00_setup_profile.py

# Pro Rezept (Rezept-Daten im jeweiligen Script editieren):
python3 01_create_recipe.py
python3 02_upload_image.py
python3 03_add_tips.py
python3 05_annotate_chips.py
```

Gesamtzeit pro Rezept: ~2 Minuten (vs. ~30 Min. manuell am Thermomix-Display).
