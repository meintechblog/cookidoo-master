# Quality Checks — die 9 nicht-offensichtlichen Regeln

Wer einfach blind eine Karte in die Steps tippt, bekommt ein „besoffenes" Rezept — die AI annotiert Bold-Chips doppelt, Steps lesen sich repetitiv. Diese 9 Regeln aus dem ersten Praxis-Iterationszyklus sind die Differenz zwischen „naja okay" und „native-quality".

## 1. Per-Step Ingredient Uniqueness

Jede Zutat darf höchstens **1x pro Step** vorkommen. Die AI annotiert ALLE Vorkommen einzeln → zwei Bold-Chips zur gleichen Zutat in einem Step liest sich wie ein Bug.

```
✗ "...unter kaltem Wasser spülen. 1200 g Wasser, 1,5 TL Salz ..."
✓ "...kurz abspülen. 1200 g Wasser, 1,5 TL Salz ..."
```

## 2. Keine zwei aufeinanderfolgenden Steps mit gleicher End-Phrase

Wenn Step 5 und Step 6 beide mit „mit Salz und Pfeffer abschmecken." enden, liest sich das wie Copy-Paste. **Lösung**: Steps zusammenfassen mit kollektivem Schluss.

```
✗ Step 5: ... Sriracha-Mayo verrühren und mit Salz und Pfeffer abschmecken.
  Step 6: ... Sweet-Chili-Dip vermengen und ebenfalls mit Salz und Pfeffer abschmecken.

✓ Step 5: ... Sriracha-Mayo verrühren. ... Sweet-Chili-Dip vermengen. Beide Soßen mit Salz und Pfeffer abschmecken.
```

## 3. Compound-Namen die Zutaten als Substring enthalten vermeiden

„Sriracha-**Mayo**" enthält „Mayo", was die AI an „vegane Mayonnaise" matchen könnte. Im gleichen Step wäre dann „Mayonnaise" + „Mayo" beide annotiert → doppelt.

```
✗ 50 g vegane Mayonnaise mit 16 g Sriracha-Sauce zur Sriracha-Mayo verrühren
✓ 50 g vegane Mayonnaise mit 16 g Sriracha-Sauce verrühren
```

## 4. Synonyme zählen als Doppelung

„Basmatireis ... Reis" oder „Buschbohnen ... Bohnen" wird als overuse erkannt.

```
✗ ... Reis abgedeckt 6 Min. ziehen lassen ... Reis mit Gabel auflockern
✓ ... abgedeckt 6 Min. ziehen lassen ... Den Reis mit Gabel auflockern
```

## 5. Keine doppelten Zutaten mit Catch-all-Sammelposten

```
✗ Zutaten: ... "1,5 TL Salz (zum Reis)", "Salz, Pfeffer, Zucker, Öl nach Bedarf"
✓ Zutaten: ... "2 TL Salz", "25 g Öl", "1-2 Prisen Pfeffer", "1 Prise Zucker"
```

## 6. Tipps brauchen `— ` Prefix als Bullet

Cookidoo rendert die Tipps OHNE Auto-Bullets. Jede Zeile mit `— ` (em-dash + Space) starten, sonst verschwimmen alle Tipps zu einem Text-Block.

## 7. Quellen-Link gehört ans Ende der Tipps

Wenn das Rezept aus einer fremden Quelle stammt, den Link am Ende der Tipps-Sektion. Cookidoo hat kein eigenes „Quelle"-Feld für Eigene Rezepte. Idiom:

```
Original-Karte (HelloFresh):
https://www.hellofresh.de/recipes/...

Toolkit (Open Source):
https://github.com/meintechblog/thermomix-master
```

## 8. Step-Granularität nach Native-Median (siehe native-style-rules.md)

| Zutaten | Median | Range |
|---|---|---|
| 8-12 | 4 | 3-5 |
| 13-17 | **5** | 4-7 |
| 18-25 | 6 | 5-8 |

## 9. Native Verb-Vokabular + Zutaten-Format

Adjektive nach Komma, spezifische Mengen statt Catch-all, native Thermomix-Verben (`einwiegen`, `einhängen`, `aufsetzen`, `dampfgaren`, `mithilfe des Spatels`, `unterheben`, `auf X Bowls verteilen`, `... servieren`).

## Automatischer Pre-Push-Check

Vor dem `05_annotate_chips.py`-Run das Audit-Script laufen lassen:

```bash
~/.claude/skills/thermomix-master/scripts/audit-recipe.py recipe.json
```

Es prüft alle 9 Regeln und liefert exit 1 bei BLOCK-Findings.

## Post-Annotate-Verifikation

Nach 05_annotate_chips.py manuell prüfen:

```python
# Erwartet >= 2 TTS-Chips:
TTS chips (nobr.recipe-content__accent): 2
  - 18 Min./Varoma/Stufe 1
  - 10 Sek./Stufe 6
```

Wenn 0 oder weniger als erwartet: Chip-Syntax in den Steps prüfen (`references/chip-syntax.md`).
