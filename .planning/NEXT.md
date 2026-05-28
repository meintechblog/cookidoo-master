# NEXT — thermomix-master Session-Handoff

**Stand:** 2026-05-28, Nachmittag · Session-Wrap nach **Repo-Merge `cookidoo-master` → `thermomix-master`** + Post-Migration-Audit + Cleanup. Bei „weiter" hier weitermachen.

---

## Vorab: bin ich richtig?

- Repo-Heimat: `/Users/hulki/codex/thermomix-master/` (Mac), `/opt/thermomix-master/` (LXC 192.168.3.223), `meintechblog/thermomix-master` (GitHub)
- Mensch: **Jörg** Hofmann. Hub-Bot: **Hulki** (`agent-master`). Andere Repos haben eigene Peers — siehe globales `~/.claude/CLAUDE.md`.
- Wenn du nicht weißt was heute war: lies zuerst `memory/project_rename_migration_2026-05-28.md` — komplette Übersicht aller Änderungen.

---

## Was alles läuft (Stand 2026-05-28)

### Cookidoo-Pipeline (Mac)
- Skill `thermomix-master` (`~/.claude/skills/thermomix-master/` → Symlink ins Repo)
- Playwright-Profil: `~/thermomix-automation/profile/` mit eingeloggter Cookidoo-Session
- State-File: `~/thermomix-automation/current_recipe.txt`
- Pipeline-Scripts: `automation/01_create_recipe.py` bis `06_publish.py`, plus `99_retro_fix_hf_nr.py`
- Test 2026-05-28: Playwright-Login funktioniert nach mv ✓

### Webapp (LXC `192.168.3.223`)
- 4 systemd-units active: `thermomix-{chat,webapp,worker}.service` + `thermomix-autoupdate.timer`
- Webroot: `/opt/thermomix-master/`, deploy-Script `webapp/deploy/install.sh` (idempotent, ruft sich selbst via Auto-Update-Timer)
- HTTPS-Reverse-Proxy via nginx (Self-Signed-Cert `cookidoo-selfsigned.crt` bleibt absichtlich, CN=`cookidoo-master.local`)
- `/speech/` proxied auf `192.168.3.127:8765` (local-speech-service auf Hulki-Host)
- 9 Rezepte sichtbar, davon 8 HF-sourced mit `[#NN]`-Titel-Prefix + `hfCardNumber`-Badge

### Chat-Bridge
- Daemon: `com.hulki.thermomix.chatbridge` (launchd auf Mac)
- Reply-CLI: `./scripts/chat_bridge/thermomix-chat reply "..."`
- Queue-Dir: `~/.thermomix-pending-chat/`
- ENV-Prefix: `THERMOMIX_*` (alle Konstanten)

### Peer-Identity
- Ich (peer-id wechselt pro Session) bin der einzige authoritative thermomix-master-Peer
- Hulki (`agent-master-hub`) routet WA-Cookidoo/Thermomix-Anfragen zu mir
- Cross-Repo-Anfragen via `list_peers` + `send_message`

---

## Rezepte-Portfolio — 9 live auf Cookidoo + Webapp

| # | Rezept | Slug | Karte |
|---|---|---|---|
| 1 | Umami-Pilz-Stir-Fry mit Rosenkohl | `umami-pilz-stir-fry-mit-rosenkohl` | #18 |
| 2 | Frische Sauerteig-Pinsa mit Aubergine | `frische-sauerteig-pinsa-mit-aubergine` | #25 (KW19/Y26) |
| 3 | Räuchertofu Gyros-Art mit Kartoffelsalat und Zaziki | `raeuchertofu-gyros-art-mit-kartoffelsalat-und-zaziki` | #25 (KW02/Y24) |
| 4 | Vegane Filetstücke in thailändischer Orangensoße | `vegane-filetstuecke-thai-orange` | #32 |
| 5 | Sweet-Chili-Bowl mit glasierter Aubergine | `sweet-chili-bowl` | #33 (Y26) |
| 6 | Veganes Portobello-Champignon-Stroganoff | `veganes-portobello-champignon-stroganoff` | #33 (Y25) |
| 7 | Nasi Goreng mit veganen Filetstücken | `nasi-goreng` | #64 |
| 8 | Ingwer-Süßkartoffel-Eintopf mit Tofu | `ingwer-suesskartoffel-eintopf-mit-tofu` | #66 |
| 9 | Veganer Hackbraten mit Semmelknödeln (Eigenkreation) | `veganer-hackbraten-…` | — |

Doppelte `#25` und `#33` sind kein Bug — Wochenbox-Position rotiert pro Woche. Siehe `memory/project_hf_card_number_vs_url_r.md`.

---

## Was als „weiter" anliegen könnte (nichts kritisches!)

Keine HIGH-Findings mehr offen. Restliche Quirks aus dem Handover-Brief (alle low-risk, bewusst aufgeschoben):

1. **`thermomix-webapp.service` TimeoutStopSec=10** — quick fix gegen 502-Restart-Fenster bei SSE-Streams. Low-risk, 5min Arbeit. Siehe `memory/project_thermomix_open_quirks.md` Punkt 1.
2. **Neues HelloFresh-Rezept eintragen** — Pipeline ist ready. Skill-Aufruf: `/thermomix-master <hellofresh-url>` oder `--text` / `--image`.
3. **Self-Signed-Cert renewal** — gültig bis 2036, kein Druck.
4. **iOS-TTS-Brittle** — passt vermutlich erst, wenn Safari-Bug auftritt.

Bei neuen Cookidoo-Recipes greift die Skill jetzt automatisch:
- Titel mit `[#NN] <Name> (HelloFresh)`
- Erste Zeile im Tipps-Block: `Karte #NN — <Name>`
- Recipe-README mit H1 `# [#NN] <Name>`
- Quelle-Zeile mit `Karte #NN (HF_Y..R..W..)`
- HF-Badge in der Webapp rendert automatisch

---

## Memory-Index (für schnellen Zugriff)

- `project_rename_migration_2026-05-28.md` — heute, der Master-Recap der Migration
- `project_thermomix_open_quirks.md` — 4 bewusste Quirks
- `project_hf_card_number_vs_url_r.md` — R-Zahl ≠ Karten-Position

---

## Nichts mehr zu tun?

Wenn alles grün ist und du auf neuen Input wartest:
- `set_summary("thermomix-master: idle, Stand <HEAD>, alle Audit-Findings durch")`
- `list_peers` + warten

Sonst: kick dich rein in einen der „weiter könnte"-Punkte oben.
