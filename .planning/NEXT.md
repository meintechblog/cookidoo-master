# NEXT — thermomix-master Session-Handoff

**Stand:** 2026-05-27, 19:30 lokal · Session-Wrap nach 2 Rezepten + Skill v3 + Webapp-Chat + Mobile-Refit + Skill-Extraction. Bei „weiter" hier weitermachen.

---

## Naming-Konvention (wichtig zum Reinkommen)

- **Jörg** = der Mensch (Jörg Hofmann)
- **Hulki** = der Hub-Bot (`agent-master` Session, peer-id wechselnd) UND der macOS-Account-Username (`/Users/hulki/`). Macht WA-Routing.
- **KEIN dritter Name** — falls „Heikki" auftaucht, ist das ein voice-to-text-Slip und meint Hulki.

Mehr: `~/.claude/projects/-Users-hulki-codex-thermomix-master/memory/user_name.md`.

---

## Was läuft / Status der Bausteine

### Rezepte-Portfolio — 9 Stück live auf Cookidoo + Webapp

| # | Rezept                                                         | Slug                                                    | HF-#  | Commit  |
|---|---------------------------------------------------------------|---------------------------------------------------------|-------|---------|
| 1 | Frische Sauerteig-Pinsa mit Aubergine                          | `frische-sauerteig-pinsa-mit-aubergine`                 | #25   | älter   |
| 2 | Ingwer-Süßkartoffel-Eintopf mit Tofu                           | `ingwer-suesskartoffel-eintopf-mit-tofu`                | #66   | älter   |
| 3 | Nasi Goreng                                                    | `nasi-goreng`                                           | #64   | älter   |
| 4 | Räuchertofu Gyros-Art mit Kartoffelsalat und Zaziki            | `raeuchertofu-gyros-art-...`                            | — (HF_Y24_R33_W02) | 968a110 |
| 5 | Sweet Chili Bowl                                               | `sweet-chili-bowl`                                      | #33   | älter   |
| 6 | Umami-Pilz-Stir-Fry mit Rosenkohl                              | `umami-pilz-stir-fry-mit-rosenkohl`                     | #18   | älter   |
| 7 | Vegane Filetstücke in thailändischer Orangensoße               | `vegane-filetstuecke-thai-orange`                       | #32   | 0a447e7 |
| 8 | Veganer Hackbraten mit Semmelknödeln                           | `veganer-hackbraten-...`                                | Eigenkreation | älter |
| 9 | Veganes Portobello-Champignon-Stroganoff auf Fusilli           | `veganes-portobello-champignon-stroganoff`              | #33   | d39de40 |

Alle Cookidoo-public + Webapp-sichtbar unter `http://192.168.3.223/r/<slug>`. HF #33 doppelt belegt (Sweet Chili Bowl + Portobello-Stroganoff) — siehe `memory/reference_hellofresh_card_numbers.md`, R-Codes wiederholen sich jährlich.

### Webapp 192.168.3.223 — alle Features live

- **Rezept-Kollektion** mit Suchfeld (diacritic-tolerant) + Sort-Dropdown (Neuste/Älteste/HF-Nr ↑↓/Titel A–Z)
- **HF-Badge** rendert Karten-Nummer aus README-Quelle-Zeile (Regex `#(\d+)`)
- **Recipe-Detail-Page** `/r/<slug>` mit Hero + Kennzahlen + Zutaten + Zubereitung + Tipps + 3 Live-Screenshots
- **`/chat` als natives Bubble-UI** (commit 06ea517 + 6df7462) — siehe nächster Abschnitt
- **`/pinned` + `/settings`** — bereits vor dieser Session

LXC-Autoupdate-Timer alle 10 Min., manuell triggerbar via `ssh root@192.168.3.223 'systemctl start thermomix-autoupdate.service'`.

### Chat-Bridge — End-to-End live, brand neu

`/chat` ist jetzt ein echtes Browser-Chat-UI (statt ttyd-iframe). Bubble-Stream + SSE + Pulsar-Typing-Indicator.

```
Browser → POST /api/chat/send → SQLite chat_messages
                                       │ GET /api/chat/inbox (polled)
                                       ▼
                              Mac-Daemon chat_bridge.py (launchd, KeepAlive)
                                       │ broker /send-message
                                       ▼
                              thermomix-master peer (= ich, diese Session)
                                       │ ./scripts/chat_bridge/cookidoo-chat reply "..."
                                       ▼
                              POST /api/chat/reply → SSE
                                       │
                                       ▼
                              Browser EventSource /api/chat/stream → Bubble
```

Files (alle hardlinked oder im Repo):
- `webapp/src/lib/db.ts` — `chat_messages`-Tabelle + helpers
- `webapp/src/app/api/chat/{send,inbox,reply,stream}/route.ts` — 4 API-Endpoints
- `webapp/src/components/ChatRoom.tsx` — Client-Component mit SSE + Typing-Indicator
- `webapp/src/app/chat/page.tsx` — Server-Component, lädt Backlog aus DB
- `scripts/chat_bridge/` — Mac-Daemon + CLI + launchd-plist + README

Bridge-Daemon ist installiert und läuft: `launchctl print gui/$(id -u)/com.hulki.cookidoo.chatbridge`. Logs unter `scripts/chat_bridge/chat-bridge.{log,stdout.log,stderr.log}` (gitignored). Test-Reply: `./scripts/chat_bridge/cookidoo-chat reply "..."`.

### Skill thermomix-master — v3 End-to-End-Autopilot

`~/.claude/skills/thermomix-master/` (hardlinked mit `<repo>/skill/thermomix-master/`):
- **SKILL.md** — Phase 1–8 mit paralleler Pipeline (Restyle background-task parallel zu Tips/Times/Chips)
- **`references/hero-image-pipeline.md`** — Pfad A/B/C (eigenes Foto / AI-Restyle / kein Bild), verweist seit 28a8ae1 auf den neuen chatgpt-image-restyle Skill
- **`references/hellofresh-card-numbers.md`** — `HF_Y..R..W..`-Pattern aus image_url
- **`references/native-style-rules.md`**, **`chip-syntax.md`**, **`quality-checks.md`** — bestehend
- **`scripts/chatgpt-restyle.sh`** — DEPRECATED (legacy wrapper, replaced by ~/.claude/skills/chatgpt-image-restyle/scripts/restyle.sh)
- **`scripts/extract-hellofresh.py`**, **`audit-recipe.py`**, **`verify-image-match.py`**, **`_slugify.py`** — bestehend
- **`style-references/`** im Repo (3 kuratierte hero.jpg als Few-Shot-Anker)

Skill nimmt: HF-URL ODER Karten-Foto (`--image`) ODER plain-text (`--text`).
Skill outputt: Cookidoo public + Webapp live + AI-Hero + Commit + Push + LXC-Trigger.

Funktionierender End-to-End-Test heute mit HF #33 (Stroganoff) — alle Erkenntnisse in Memory + Skill eingebaut.

### Neuer User-Skill chatgpt-image-restyle (2026-05-27, commit 28a8ae1)

Extrahiert aus thermomix-master als reusable, repo-agnostischer Skill:

**`~/.claude/skills/chatgpt-image-restyle/`** (User-global, alle Sessions haben Zugriff)
- **SKILL.md** — vollständige Doku mit Args + Beispielen
- **`scripts/restyle.sh`** — generische Few-Shot-Pipeline (Style-Refs als CLI-Arg)
- **`references/applescript-paths.md`** — ChatGPT.app UI-Tree-Pfade
- **`references/prompt-recipes.md`** — Default/Card-Mode/Retry Prompts + Bias-Mitigation
- **`references/failure-modes.md`** — bekannte Fehler + Fixes

Args: `--target`, `--style-refs <dir>`, `--output`, `--background`, `--diet`, `--main-subjects`, `--preserve`, `--verify-url`, `--notify "<cmd>"`, `--source-mode photo|recipe-card|menu-shot`.

Anrufende Skills: thermomix-master (cookidoo). Andere können folgen.

Hulki ist gebeten, das Skill in der Webapp unter neuem `/skills`-Tab zu listen + Doku zu schreiben + Cross-Repo standardisieren.

### Webapp Mobile-Responsive (2026-05-27, commit 5e6a47b)

- **`SiteHeader.tsx`** — Hamburger-Menu auf Mobile, Desktop-Layout ab `md:`
- **`PinSection.tsx`** — HelloFresh-Pin-Hero standardmäßig collapsed, Tap öffnet
- **layout.tsx** — `viewport`-Export für iOS Safari, `px-4 sm:px-6` Edge-Padding

---

## Memory-Index (für Quick-Reload)

Pfad: `~/.claude/projects/-Users-hulki-codex-thermomix-master/memory/MEMORY.md`

| File                                       | Was steht drin |
|--------------------------------------------|----------------|
| `user_name.md`                             | Jörg = Person, Hulki = Hub-Bot + macOS-Account, kein dritter Name |
| `feedback_autonomous.md`                   | Multi-Step Workflows autonom durchziehen, keine Mid-Way-Bestätigung |
| `reference_received_images.md`             | HF-Bilder + AI-Restyles in `.received/hf<NR>/`, gitignored |
| `reference_hellofresh_card_numbers.md`     | HF-Karten-Nr aus image_url-Pattern `HF_Y..R..W..` |
| `feedback_restyle_prompt_lessons.md`       | Vegan-Bias bei Fleisch-Gerichten + Garnitur-Erhalt beim Retry |
| `reference_hub_agent_master.md`            | WA-Routing seit 2026-05-27 via agent-master (Hulki), nicht mehr allgemein |

---

## Offene Aufgaben (für „weiter")

### Wartend auf Hulki (Cross-Repo)

- [ ] **WA-Outbound-Media-Standard** — wa-bridge-Outbox-Schema soll um `media_path`-Feld erweitert werden, damit ich beim Status-Push das AI-Hero-Bild mitschicken kann. Hulki ist dran, sobald er den agent-master-spawn/stop-Bug fertig hat. Sobald sein Schema steht, brauch ich ~5 Min für das Einbauen im chatgpt-restyle.sh Hub-Push-Block.

### Anschluss-Ideen (nicht zugewiesen)

- [ ] **ttyd-Service auf LXC abschalten** — der alte `thermomix-chat.service` läuft noch im Hintergrund, wird aber von der neuen `/chat`-Seite nicht mehr aufgerufen. Disabled werden kann er ohne Webapp-Bruch.
- [ ] **Image-Display in Chat-Bubbles** — wenn die Chat-Bridge irgendwann Bilder durchreichen soll (nicht WA, sondern Browser), wäre ein optionales `image_path` im Reply-Schema nett. Spielt zusammen mit dem WA-Standard.
- [ ] **HF-Cards-Disambiguator-UI** — bei Doppel-`#`-Sortierung könnte die Webapp den Y+W-Token in der Card-Anzeige zeigen.

---

## Tools/Voraussetzungen die installiert sind

- `cliclick` — `brew install cliclick`, für synthetisches Right-Click in ChatGPT.app
- ChatGPT.app eingeloggt mit Bedienungshilfen-Permission für osascript-UI-Scripting
- Playwright (in webapp + via skill) für Cookidoo-Automation und Screenshots
- launchd-Daemon `com.hulki.cookidoo.chatbridge` aktiv (KeepAlive)
- SSH-Zugang `root@192.168.3.223` für LXC-Autoupdate-Trigger
- `~/cookidoo-automation/profile/` — eingeloggte Cookidoo-Playwright-Session
- claude-peers-MCP läuft im Repo (`claudepeers`-Alias)

---

## Wie „weiter" funktioniert nach /clear

1. Diese NEXT.md lesen (du machst das automatisch in Session-Start)
2. Memory-Index `~/.claude/projects/-Users-hulki-codex-thermomix-master/memory/MEMORY.md` lesen (lädt automatisch)
3. Wenn ChatGPT-Restyle-Operation ansteht: `cliclick` da, ChatGPT.app eingeloggt — direkt loslegen
4. Wenn neues Rezept reinkommt (HF-URL oder Karten-Foto via WA-Pipeline): Skill `thermomix-master` aufrufen
5. Wenn Browser-Chat-Message reinkommt: kommt automatisch als Channel-Push (`💬 [chat from=webapp …]`), antworten via `./scripts/chat_bridge/cookidoo-chat reply "…"`
6. Bei Cross-Repo-Fragen: Hulki (Peer `hgy5crsk` oder aktuell-online im cwd `/Users/hulki/codex/agent-master`)
