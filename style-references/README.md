# Style References

Diese drei Bilder werden vom **thermomix-master**-Skill als Few-Shot-Style-Anker für AI-Hero-Restyles benutzt (`@~/.claude/skills/thermomix-master/references/hero-image-pipeline.md`, Pfad B).

Manuell kuratiert für maximalen Stil-Konsens:

- Top-Down-Perspektive
- Tiefer Teller mit blauem Rand
- Warmes Licht / dunkler Hintergrund
- Garnitur in Naturfarben (Kräuter, Sesam, Nüsse)
- Bowl-Komposition (Reis-Basis + Hauptbestandteil + Topping)

Beim Hinzufügen eines neuen Rezepts pickt der Skill **immer dieselben drei** Bilder hier — nicht zufällige aus `recipes/`. Das macht jeden Restyle deterministisch und schützt den Stil davor zu driften wenn neue Rezepte mit anderem Look dazukommen.

## Wenn du den Stil ändern willst

Drei andere Bilder hier reinkopieren (Dateinamen `01-*.jpg`, `02-*.jpg`, `03-*.jpg` — der Skill nimmt einfach alle `*.jpg` per glob, sortiert nach Dateiname).

## Aktueller Set

1. `01-sweet-chili-bowl.jpg` — Sweet Chili Bowl mit Linsen + Erdnüssen
2. `02-nasi-goreng.jpg` — Nasi Goreng mit Spiegelei + Frühlingszwiebel
3. `03-ingwer-curry.jpg` — Ingwer-Süßkartoffel-Eintopf mit Tofu
