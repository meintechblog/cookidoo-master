# Chat-Bridge — Webapp `/chat` ↔ laufende Claude-Session

Browser-Chat-UI auf `http://192.168.3.223/chat` (statt ttyd-Terminal-iframe) spricht über diesen Mac-Daemon mit der lokal laufenden `cookidoo-master`-Claude-Session.

## Architektur

```
Browser (192.168.3.223/chat)
   │ POST /api/chat/send  {body}
   ▼
Webapp (LXC, Next.js) — SQLite chat_messages
   │
   │ GET /api/chat/inbox (polled)
   ▲
Mac-Daemon (chat_bridge.py, launchd)
   │
   │ POST /send-message → claude-peers broker 127.0.0.1:7899
   ▼
cookidoo-master peer (Claude-Session in this repo)
   │
   │ ./scripts/chat_bridge/cookidoo-chat reply "..."
   ▼
Webapp POST /api/chat/reply → SQLite + SSE
   │
   ▼
Browser EventSource /api/chat/stream → Bubble
```

## Komponenten

| Datei                                       | Rolle |
|---------------------------------------------|-------|
| `chat_bridge.py`                            | launchd-Daemon: poll inbox → broker push |
| `cookidoo-chat`                             | Mini-CLI für die Session: `cookidoo-chat reply "..."` |
| `com.hulki.cookidoo.chatbridge.plist`       | launchd Job-Definition |
| `chat-bridge.log` / `.stdout.log` / `.stderr.log` | Logs |
| `~/.cookidoo-pending-chat/`                 | JSON-Queue wenn Peer offline |

## Setup

1. Bridge installieren + starten:
   ```bash
   cp scripts/chat_bridge/com.hulki.cookidoo.chatbridge.plist ~/Library/LaunchAgents/
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.hulki.cookidoo.chatbridge.plist
   ```

2. CLI-Symlink (optional):
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
3. Browser sieht die Antwort in 1.5s via SSE.

## Env-Vars

| Variable                | Default                                       |
|-------------------------|-----------------------------------------------|
| `COOKIDOO_CHAT_BASE`    | `http://192.168.3.223`                        |
| `CHAT_BRIDGE_TOKEN`     | leer (offen) — wenn gesetzt, Bearer-required auf inbox+reply |
| `COOKIDOO_REPO_PATH`    | `/Users/hulki/codex/cookidoo-master`          |
| `COOKIDOO_PEERS_BROKER` | `http://127.0.0.1:7899`                       |
| `COOKIDOO_CHAT_POLL_S`  | `2`                                           |
| `COOKIDOO_PEER_POLL_S`  | `5`                                           |
