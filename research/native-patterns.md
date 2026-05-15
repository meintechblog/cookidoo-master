# Native Recipe Patterns Research

Wir haben 5 echte Vorwerk-Rezepte aus Cookidoo analysiert um zu verstehen, wie die Profis strukturieren. Vollständige Daten in `native-recipes-research.json`.

## Sample

| Query | Rezept | Yield | Prep | Total | Ing. | Sect. | Steps | Cook-Commands |
|---|---|---|---|---|---|---|---|---|
| Brot | Schweizer Bauernbrot | 16 Scheiben | 35 Min. | 7 Std. | 9 | 4 | 5 | 4 |
| Kuchen schnell | Schneller Apfel-Kastenkuchen | 12 Scheiben | 10 Min. | 1 Std. 30 | 10 | 0 | 5 | 6 |
| Smoothie | Smoothie | 4 Gläser | 5 Min. | 5 Min. | 3 | 0 | 1 | 9 |
| Suppe Kürbis | Kürbiscremesuppe | 6 Portionen | 15 Min. | 30 Min. | 14 | 0 | 5 | 8 |
| Bowl asiatisch | Bowl mit schwarzem Reis, Hühnerfleisch und Pilzen | 4 Portionen | 15 Min. | 40 Min. | 14 | 0 | 5 | 6 |

## Erkenntnisse

### Schritt-Granularität ist VIEL gröber als bei HelloFresh

Vorwerk-Rezepte komprimieren oft 2-4 Aktionen in einen Schritt — vermutlich um die Schritt-Liste am kleinen Thermomix-Display nicht zu lang zu machen. HelloFresh-Karten haben dagegen typisch 6 Schritte. Anpassung:

- Bei **kleinen Rezepten** (Smoothie, einfacher Salat): 1-3 Schritte
- Bei **mittleren Hauptgerichten** (Suppen, Bowls): 4-7 Schritte
- Bei **komplexen Rezepten** (Brot mit Vorteig, Mehrkomponentengerichten): 5-9 Schritte, gegebenenfalls mit Sektionen

### Sektionen (`<h5>`) nur bei Multi-Phase-Rezepten

Nur 1 von 5 Sample-Rezepten (Brot) nutzt Sektionsüberschriften wie "Quellstück" / "Hauptteig". Standard ist flache Schritt-Liste.

⚠️ **Wichtig**: Im Eigene-Rezepte-Editor lassen sich Sektionen **gar nicht** anlegen. Das ist Vorwerk-exklusiv.

### Cooking-Command-Formate

Aus den 30+ extrahierten `<nobr>`-Tags lassen sich diese kanonischen Patterns ableiten:

| Pattern | Beispiel | Wann |
|---|---|---|
| `N Sek./Stufe X` | `5 Sek./Stufe 5` | Pulse-Aktionen (Schneiden, kurzes Pürieren) |
| `N Min./Stufe X` | `1 Min./Stufe 4` | Längere Kalt-Aktionen |
| `N Min./TTemp/Stufe X` | `3 Min./120°C/Stufe 2` | Standard heißes Garen/Anbraten |
| `N Min./Varoma/Stufe X` | `10 Min./Varoma/Stufe 2` | Dampfgaren mit Varoma |
| `N Min./TTemp/Linkslauf/Stufe X` | `6 Min./100 °C/Linkslauf/Stufe 1` | Schonendes Garen (Bohnen, Reis-Risotto) |
| `Mode-Icon/N Min.` | `Teig /2 Min.` | Mode-basierte Aktionen (Kneten/Pürieren etc.) |
| `Mode-Icon/N Sek.` | `Pürieren /30 Sek.` | Mode-basierte Pulse |

### Stufen-Werte

Sample zeigt: `0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 5.5, 6, 7, 8, 9, 10`. Plus Spezial-Werte: `Soft`, `Turbo`, `Teig`. Aus dem JS-Bundle: Stufen kommen in 0.5er-Schritten von 0.5 bis 10.

### Temperatur-Werte (°C)

Aus dem Popover-Markup: `OFF, 37, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 98, 100, 105, 110, 115, 120, 140, 145, 150, 155, 160, Varoma`. Dazwischen liegende Werte (z.B. 130°C) sind **nicht** auswählbar.

### Mode-Glyphs (Unicode Private Use Area)

| Glyph | Mode | Verwendung |
|---|---|---|
| `` | Teig kneten | Brot, Pasta-Teig |
| `` | Dampfgaren | Varoma-Operationen |
| `` | Pürieren (Power) | Aktiv-Pürieren mit Stufe |
| `` | Reis kochen | Reis-Modus |
| `` | Wiegen / Skala | Wasser erhitzen, Mengen |
| `` | Erwärmen / Warm halten | Warmhalten |
| `` | Pürieren (Soft) | Smoothies, kalter Püriermodus |
| `` | Anbraten / Browning | Anbraten-Modus |
| `` `` | Direction-Glyphs | „normal" / Linkslauf-Pfeile |
| `` | Missing-Ingredient-Icon | wenn Zutat aus Liste im Step fehlt |

## Empfehlungen für Custom-Rezepte

1. **Nicht-Mode TTS bevorzugen** (`N Min./Temp/Stufe X`) — eindeutig parsebar, keine Glyphs nötig
2. **Eine Aktion pro Step** ist OK, aber 2-3 zusammenfassen geht auch — HelloFresh-Granularität ist OK, Vorwerk-Granularität noch OK-er
3. **Zutaten-Mengen** wörtlich aus der Zutaten-Liste in den Step übernehmen → die Annotate-API matcht das per Substring (`1200 g Wasser` in beiden = perfektes Match)
4. **Standard-Vokabular** für Bewegungen verwenden: „dünsten", „dampfgaren", „kochen", „pürieren", „glasieren" — diese Verben sind ohnehin idiomatic
5. **Vermeide**: Sektionen (gehen nicht), Bilder pro Schritt (gehen nicht), Verlinkungen zu anderen Rezepten (gehen nicht)
