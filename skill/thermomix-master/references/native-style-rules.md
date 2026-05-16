# Native-Style Rules

Verdichtet aus Deep-Research von 12 nativen Vorwerk-Bowls/Currys/Pfannen. Diese Regeln bringen ein Plain-Text-Rezept auf das Render-Level eines originalen Vorwerk-Rezepts.

## Step-Anzahl-Tabelle (KRITISCH)

Native Vorwerk-Rezepte folgen dieser Zahl, NICHT die der HelloFresh-Karte:

| Zutaten | Native median Steps | Native Range |
|---|---|---|
| 8-12 | 4 | 3-5 |
| 13-17 | **5** | 4-7 |
| 18-25 | 6 | 5-8 |

**Trick zum Verdichten**: parallel laufende Aktionen gehören in EINEN Step, eingeleitet mit `In der Zwischenzeit ...`. HelloFresh-Karten haben oft 6-8 Steps für ein Rezept das nativ in 5 passt.

**Wann 6 statt 5 für 14-17-Zutaten-Rezepte**: wenn die Pfannen-Phase zwei sequentielle Brate-Schritte braucht (Filetstücke raus → Öl neu erhitzen → Gemüse rein). Dann ist 1 Step nicht möglich ohne Öl 2x zu mentionieren — Split lohnt sich.

## Native Verb-Vokabular

Diese Verben kennt der Thermomix-Display + Cookidoo aus Vorwerk-Rezepten:

| Statt (HF-Karte) | Native |
|---|---|
| in den Gareinsatz füllen | **einwiegen** |
| Gareinsatz reinhängen | **einhängen** |
| Varoma aufstellen | **aufsetzen** |
| Varoma abnehmen | **absetzen** |
| mit dem Spatel rausholen | **mithilfe des Spatels herausnehmen** |
| dazugeben (am Ende) | **unterheben** |
| in Schüsseln verteilen | **auf 4 Bowls/Tellern verteilen** |
| Guten Appetit! | **... servieren** (Schluss-Verb) |
| Jetzt kommt das Gemüse | **In der Zwischenzeit ...** (Lead-in für Parallel-Task) |

**Niemals**: `Guten Appetit!` als Schluss (kommt in 0 von 12 nativen Rezepten vor).

## Zutaten-Format

Native Vorwerk-Zutaten folgen diesem Schema:

- **Adjektive nach Komma**: `1 rote Chilischote, frisch` (NICHT „1 frische rote Chilischote")
- **Modifikator nach Komma**: `1 Limette, gewachst` (Verb-Teil `in 6 Spalten geschnitten` gehört in den Step!)
- **Spezifische Mengen** statt Catch-all: 
  - ✗ `Salz, Pfeffer, Zucker, Öl nach Bedarf` (HelloFresh-Style)
  - ✓ `2 TL Salz` + `25 g Öl` + `1-2 Prisen Pfeffer` + `1 Prise Zucker` (4 getrennte Zeilen)
- **Bindestrich-Soßen**: `Sriracha-Sauce`, `Sweet-Chili-Soße`, `Teriyakisoße` (kein Leerzeichen)
- **Anzahl-Wort weglassen**: `2 Karotten` statt `2 Stück Karotten`

## Step-Längen-Verteilung

Für 14-17-Zutaten-Rezepte: **250-550 Zeichen pro Step** ist die native Range.
- < 200 Zeichen: nur am Ende (z.B. "Anrichten") akzeptabel
- > 550 Zeichen: Step zu lang, in 2 splitten

## Was native Rezepte NICHT haben

- `Guten Appetit!` als Schluss-Phrase
- Doppelpunkte vor Listen (`Toppings: Reis, Bohnen, Erdnüsse`) — native nutzt Fließtext
- Hinweise in Klammern direkt in der Zutatenliste — gehören in den Step
- HelloFresh-Multiplier-Brackets `[1,5 EL | 2 EL]` — vorab auf eine Portionsgröße runterrechnen
