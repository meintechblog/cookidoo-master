# Chat-Bridge — Webapp `/chat` ↔ laufende Claude-Session

Browser-Chat-UI auf `http://192.168.3.223/chat` spricht über diesen Mac-Daemon mit der lokal laufenden `cookidoo`-Claude-Session.

Generiert vom `webapp-chat-bridge` Skill — anpassen → in dem Skill, nicht hier.

## Architektur

```
Browser (http://192.168.3.223/chat)
   │ POST /api/chat/send  {body}
   ▼
Webapp (Next.js) — SQLite chat_messages
   │
   │ GET /api/chat/inbox (polled, 2s)
   ▲
Mac-Daemon (chat_bridge.py, launchd: com.hulki.cookidoo.chatbridge)
   │
   │ POST /send-message → claude-peers broker 127.0.0.1:7899
   ▼
cookidoo peer (Claude-Session in this repo)
   │
   │ ./scripts/chat_bridge/cookidoo-chat reply "..."
   ▼
Webapp POST /api/chat/reply → SQLite + SSE
   │
   ▼
Browser EventSource /api/chat/stream → Bubble
```

## Komponenten

| Datei                                  | Rolle |
|----------------------------------------|-------|
| `chat_bridge.py`                       | launchd-Daemon: poll inbox → broker push |
| `cookidoo-chat`                    | Mini-CLI für die Session: reply / ping |
| `com.hulki.cookidoo.chatbridge.plist`              | launchd Job-Definition |
| `chat-bridge.log` / `.stdout/.stderr.log` | Logs |
| `~/.cookidoo-pending-chat/`        | JSON-Queue wenn Peer offline |

## Setup (einmalig)

1. Bridge installieren + starten:
   ```bash
   cp scripts/chat_bridge/com.hulki.cookidoo.chatbridge.plist ~/Library/LaunchAgents/
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.hulki.cookidoo.chatbridge.plist
   ```

2. CLI verfügbar machen (optional):
   ```bash
   ln -sf $(pwd)/scripts/chat_bridge/cookidoo-chat ~/.local/bin/cookidoo-chat
   ```

3. Im Browser `http://192.168.3.223/chat` öffnen — sollte „● live" zeigen sobald SSE verbunden ist.

## Bedienung

| Aktion               | Befehl |
|----------------------|--------|
| Status               | `launchctl print gui/$(id -u)/com.hulki.cookidoo.chatbridge` |
| Stoppen              | `launchctl bootout gui/$(id -u)/com.hulki.cookidoo.chatbridge` |
| Reload               | `bootout` → `cp plist` → `bootstrap` |
| Bridge-Log live      | `tail -f scripts/chat_bridge/chat-bridge.log` |
| Pending-Queue sehen  | `ls ~/.cookidoo-pending-chat/` |
| Ping                 | `cookidoo-chat ping` |
| Reply senden         | `cookidoo-chat reply "Antwort an Browser"` |

## Workflow in der Session

1. Bridge pusht eine Channel-Message `💬 [chat from=webapp ts=... id=N] <body>`.
2. Du liest sie, antwortest:
   ```bash
   ./scripts/chat_bridge/cookidoo-chat reply "Antwort"
   ```
3. Browser sieht die Antwort in ≤1.5s via SSE.

## Env-Vars

Alle optional (sensible defaults sind in plist + scripts gebacken):

| Variable                          | Default                                       |
|-----------------------------------|-----------------------------------------------|
| `COOKIDOO_CHAT_BASE`        | `http://192.168.3.223`                       |
| `COOKIDOO_REPO_PATH`        | `/Users/hulki/codex/thermomix-master`                               |
| `COOKIDOO_PEERS_BROKER`     | `http://127.0.0.1:7899`                       |
| `COOKIDOO_CHAT_POLL_S`      | `2`                                           |
| `COOKIDOO_PEER_POLL_S`      | `5`                                           |
| `COOKIDOO_QUEUE_DIR`        | `~/.cookidoo-pending-chat`                |
| `COOKIDOO_QUEUE_MAX`        | `500` (oldest dropped after that)             |
| `CHAT_BRIDGE_TOKEN`               | leer = offen; wenn gesetzt: Bearer-required für inbox+reply |
| `CHAT_DB_PATH`                    | (webapp-side) `/Users/hulki/codex/thermomix-master/state/chat.sqlite`           |
