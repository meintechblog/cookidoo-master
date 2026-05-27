# HelloFresh „Karten-Nummer" extrahieren

HelloFresh hat keine prominente Karten-Nummer auf den Rezept-Seiten. Sie steckt im **Image-Dateinamen** des Hauptbildes.

## Pattern

`HF_Y<YY>_R<NN>_W<NN>_DE_R<NNNN>-<NN>_Main...`

| Token | Bedeutung |
|---|---|
| `Y<YY>` | Year (Y26 = 2026) |
| `R<NN>` | „Rezept-Index" innerhalb des Jahres — das ist Jörg's „Karte #N" |
| `W<NN>` | Kalenderwoche der Box |
| `DE` | Land |
| `R<NNNN>-<NN>` | HF-interne Master-Recipe-ID + Variante |

Beispiele:
- `HF_Y26_R25_W19_DE_R4474-18_Main_QC_high` → Y2026, **R25**, KW19 → „Karte #25"
- `HF_Y24_R33_W02_DE_R4872-1_Mainlow` → Y2024, **R33**, KW02 → „Karte #33"

## Extraktor

```bash
# Bei einer HF-URL die Image-URL über WebFetch oder direktem Fetch ziehen:
curl -s "<hf-recipe-url>" | grep -oE 'HF_Y[0-9]+_R[0-9]+_W[0-9]+' | head -1
# Output: HF_Y26_R25_W19  →  R25 ist die Karten-Nr
```

Oder via WebFetch mit Prompt: `"Return the main hero image URL and extract the Y/R/W tokens from the filename pattern HF_Y..R..W.."`.

## Verwendung im Recipe-README

Eintrag in der „Quelle"-Zeile:

```
| **Quelle** | HelloFresh Wochenbox, Karte #<R> (HF_Y<YY>_R<NN>_W<NN>, vegan) |
```

Die `extractCardNumber`-Regex der Webapp matched `#(\d+)`. Year/Week in Klammern hilft bei Duplikaten — siehe **Wichtig** unten.

## ⚠️ Karten-Nummern wiederholen sich jährlich

R25 in Y24 ≠ R25 in Y26. Bei Konflikten in der Sammlung (zwei Rezepte mit #25):
- Y+W als Disambiguator drinlassen
- Oder die ältere Karte ohne #-Nummer notieren wenn nicht eindeutig verifizierbar
