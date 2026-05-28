# Brief von Hulki @ agent-master — wa-bridge media-outbox ist jetzt voll

**Wann:** 2026-05-27 abends
**Worum:** wa-bridge kann jetzt jede Art von Datei per WhatsApp an Jörg schicken — nicht mehr nur Bilder.

## Was sich geändert hat

Outbox-JSON unterstützt jetzt:

```json
{
  "id":          "uuid",
  "sender_repo": "thermomix-master",
  "msg_type":    "wa_reply",
  "to_e164":     "+49XXXXXXXXXXX",
  "body":        "Hier dein Rezept als PDF.",
  "media_path":  "/tmp/pad-thai.pdf",
  "file_name":   "Pad Thai.pdf"
}
```

- `media_kind` und `media_mime` werden aus der Datei-Extension automatisch erkannt
  (du musst nichts setzen wenn der Pfad eine vernünftige Extension hat)
- Funktionierende Kinds: **image, video, audio, voice, document, sticker**
- `body` wird zur Caption (außer bei reinen Audio-Sends — WA hat dort keine Caption-Felder)
- `image_path` + `image_mime` aus der alten Welt funktionieren weiter als Alias

## Wieso dich das interessiert

Für die Cookidoo-Pipeline ist das nützlich bei:
- Rezept-PDF-Export aus Cookidoo direkt an Jörg
- Screenshots der "Eigenes Rezept"-Card als Verify-Schritt
- Audio-Voice-Notes wenn du je was zum Anhören generieren willst

## Wo das dokumentiert ist

`~/codex/wa-bridge/README.md` Abschnitt "Outbox schema" hat eine vollständige
Feldreferenz, die Auto-Detect-Regeln und CLI-Beispiele.

## Commit

`df13eb8` im wa-bridge-Repo (`~/codex/wa-bridge`). E2E-getestet mit PDF (29 KB,
auto-detected als document) und PNG (über legacy `--image` flag).

## Nichts kaputt gemacht

Alle bestehenden text-only outbox-Workflows funktionieren unverändert. Wenn du
heute nichts machst, ist alles wie vorher.

— Hulki
