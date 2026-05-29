# NEXT — thermomix-master Session-Handoff

**Stand:** 2026-05-29, Abend · Session-Wrap nach **großem Rezept-Rework (alle 9 Rezepte neu)** + **Security-Sweep** + Doku-Konsistenz. Bei „weiter" hier weitermachen.

---

## Vorab: bin ich richtig?

- Repo-Heimat: `/Users/hulki/codex/thermomix-master/` (Mac), `/opt/thermomix-master/` (LXC 192.168.3.223), `meintechblog/thermomix-master` (GitHub, **public**)
- Mensch: **Jörg** Hofmann. Hub-Bot: **Hulki** (`agent-master`). Reply immer nur auf dem eingehenden Kanal (hier: Terminal-Session → in-session, keine outbox).
- Bei Unklarheit zum Gesamtkontext zuerst lesen: `memory/project_recipe_rebuild_status.md` + `memory/project_native_step_grammar.md`.

---

## Was heute (2026-05-29) passiert ist

### 1. Rezept-Rework — ALLE 9 Rezepte native-granular neu gebaut ✅
- Mediane von 110–314c → **85–144c**, alle live auf Cookidoo + Webapp deployed, committet & gepusht.
- Methode: **zurück zur HF-Originalquelle** (WebFetch der HF-URL), native-granular Steps, `audit-recipe.py` auf 0 Blocker, dann `99_replace_steps_helper.py` + `05_annotate_chips.py` + `03_add_tips.py`, README regen.
- **4 Mengen-Bugs gefixt** (nur via HF-Abgleich gefunden): Nasi Karotten 2→4, Sweet-Chili 1→2 Limetten + Schale, Umami Wasser 900→700 + Koriander 10→20.
- Tipps überall auf ~5 telegrafische Zeilen gekürzt (Jörgs Feedback).
- Step-JSONs/Tips liegen in `.received/rebuild/*.{steps.json,tips.txt}` (lokal, gitignored).

### 2. Regel-Verfeinerung + Doku-Konsistenz ✅
- Frische Ground-Truth: `research/native-top-recipes-2026-05-29.md` (12 echte Cookidoo-Top-Rezepte, via `automation/98_research_top_recipes.py`).
- **Kern-Korrektur:** Länge ist KEIN Hard-Cap. Maßstab = „eine AKTIVE Operation pro Step". Lang OK bei laufendem Chip + Parallelarbeit oder finalem Anricht-Step. Native 3–7 Steps, unsere Usability-Variante 6–17.
- Konsistent gezogen in: `native-style-rules.md`, `quality-checks.md` (Regel 8), `PLAYBOOK.md` (Regel 8), `SKILL.md`, `LEARNINGS.md`, `README.md` (Rezept-Tabelle + Faustregeln), `audit-recipe.py`.
- `audit-recipe.py` gehärtet: Länge nur WARN wenn unjustifiziert; **2 Chips/Step = BLOCK**; neuer `check_fused_operations` (Hand-Prep+Maschinen-Op); Parallel-Marker erkennt `Währenddessen`/`In der Zwischenzeit`/`In dieser Zeit`/`In den letzten`.

### 3. Security-Sweep (Hub-koordiniert) ✅
- Jörgs WA-Nummer war im public Repo (Working-Tree + History, in einem Hulki-Brief). → `git filter-repo` purge, force-push, verifiziert 0 PII/Secrets, Repo nach Bereinigung wieder **public**.
- `.planning/inbox/` + `.planning/archive/` jetzt **gitignored + untracked** — Peer-Briefe landen nie wieder im Repo. Getrackt in `.planning/` bleibt nur diese NEXT.md.

---

## Rezepte-Portfolio — 9 live (Cookidoo + Webapp), Stand 2026-05-29

| Rezept | Slug | Steps | Cookidoo-ID |
|---|---|---|---|
| Umami-Pilz-Stir-Fry #18 | `umami-pilz-stir-fry-mit-rosenkohl` | 12 | `01KRQ3TEB572NJEE7GB4FDRFG5` |
| Pinsa #25 | `frische-sauerteig-pinsa-mit-aubergine` | 10 | `01KRQ44JTZ8ETRE7N6PBB4Q0Q8` |
| Räuchertofu #25 | `raeuchertofu-gyros-art-mit-kartoffelsalat-und-zaziki` | 13 | `01KSMJK60SXV36SCX77T7N5ZV6` |
| Thai-Orange #32 | `vegane-filetstuecke-thai-orange` | 9 | `01KSMKBJ3XW0C5K5NYYVMVFZXC` |
| Sweet-Chili-Bowl #33 | `sweet-chili-bowl` | 15 | `01KRNNR72NTN1C0PTD67PA8W7D` |
| Stroganoff #33 | `veganes-portobello-champignon-stroganoff` | 11 | `01KSMWEF8YNKG04Z4TTE9E72EA` |
| Nasi Goreng #64 | `nasi-goreng` | 14 | `01KRQ1JCX58H8QGDSBB47XVP5B` |
| Ingwer-Süßkartoffel #66 | `ingwer-suesskartoffel-eintopf-mit-tofu` | 9 | `01KRQ4A91QAT7SEKVZ5WK31JGW` |
| Veganer Hackbraten (Eigenkreation) | `veganer-hackbraten-…` | 17 | `01KRRA70F256JS1FJH8SHY4G6D` |

---

## Offen / mögliche nächste Schritte (nichts kritisches)

1. **Jörg-Review der neuen Rezepte** — er wollte 2–3 in Webapp/Cookidoo gegenchecken. Falls bei einem was auffällt: Step-JSON in `.received/rebuild/` anpassen → `audit-recipe.py` → live nachziehen (Pipeline siehe `memory/project_recipe_rebuild_status.md`).
2. **`.planning/NEXT.md` aus public Repo nehmen?** — enthält LAN-IP 192.168.3.223 + interne Pfade (laut Hub nicht-kritisch). Offen, ob Jörg `.planning/` ganz aus public will. (Frage steht.)
3. **Neues HelloFresh-Rezept eintragen** — Pipeline ready: `/thermomix-master <hellofresh-url>`.
4. Alt-Quirks (low-risk): iOS-TTS-brittle (passt erst wenn Safari-Bug auftritt). Siehe `memory/project_thermomix_open_quirks.md`. — **Quirk #1 (webapp TimeoutStopSec) erledigt 2026-05-29, Commit `01b07ef`, live = 10s.**

---

## Pipeline zum Rebuild/Neubau eines Rezepts (getestet 2026-05-29)

1. HF-Quelle ziehen (WebFetch der HF-URL aus dem README) — Mengen verifizieren, NICHT nur README umschreiben.
2. `.received/rebuild/<slug>.steps.json` schreiben (`{"ingredients":[…],"steps":[…]}`), native-granular.
3. `python3 skill/thermomix-master/scripts/audit-recipe.py <file>` → 0 Blocker.
4. `echo "<COOKIDOO_ID>" > ~/thermomix-automation/current_recipe.txt`
5. `python3 automation/99_replace_steps_helper.py <file>` → `05_annotate_chips.py` → `03_add_tips.py <tips.txt>`
6. README updaten (Zubereitung + Zutaten + Tipps + Warum-Block; Webapp liest README als Source of Truth).
7. commit + push + `ssh root@192.168.3.223 'systemctl start thermomix-autoupdate.service'`.

---

## Memory-Index (für schnellen Zugriff)

- `project_recipe_rebuild_status.md` — Rebuild-Stand (ALLE 9 fertig) + Pipeline + Gotchas. ERSTER Anlaufpunkt.
- `project_native_step_grammar.md` — die Step-Regel (inkl. 29.5.-Längen-Korrektur).
- `feedback_recipe_step_usability.md` — Jörgs Usability-Kernfeedback.
- `project_recipe_scaling_fraction_trap.md` — Bruchteil-Falle beim Skalieren.
- `project_thermomix_open_quirks.md` — 4 bewusste Low-Risk-Quirks.
- `project_rename_migration_2026-05-28.md` — cookidoo→thermomix-Migration.
- `project_hf_card_number_vs_url_r.md` — R-Zahl ≠ Karten-Position.

---

## Nichts mehr zu tun?

Alles grün: 9 Rezepte neu+live, Repo sauber+public, Doku konsistent, Memory aktuell.
`set_summary(...)` + `list_peers` + warten. Sonst: einen „Offen"-Punkt oben aufgreifen.
