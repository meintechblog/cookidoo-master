#!/usr/bin/env bash
# ChatGPT-Restyle Pipeline mit Polling, Background-Mode, Verify-Loop, Hub-Push.
#
# Usage:
#   chatgpt-restyle.sh \
#     --target /path/to/hf-original.jpg \
#     --slug   vegane-filetstuecke-thai-orange \
#     --nr     32 \
#     --repo   /Users/hulki/codex/cookidoo-master \
#     [--hf-url <url>] [--no-hub-push] [--background]
#
# Output (sequential mode): writes restyled JPEG to .received/hf<NR>/restyled-final.jpg
#                          + copy at recipes/<slug>/hero.jpg
# Output (background mode): same, but exits immediately with PID in stderr;
#                          caller polls .received/hf<NR>/.done sentinel.

set -euo pipefail

TARGET=""
SLUG=""
NR=""
REPO=""
HF_URL=""
HUB_PUSH=1
BACKGROUND=0
CARD_MODE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)      TARGET="$2"; shift 2 ;;
    --slug)        SLUG="$2"; shift 2 ;;
    --nr)          NR="$2"; shift 2 ;;
    --repo)        REPO="$2"; shift 2 ;;
    --hf-url)      HF_URL="$2"; shift 2 ;;
    --no-hub-push) HUB_PUSH=0; shift ;;
    --background)  BACKGROUND=1; shift ;;
    --card-mode)   CARD_MODE=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ -z "$TARGET" || -z "$SLUG" || -z "$NR" || -z "$REPO" ]] && {
  echo "Missing required arg(s)" >&2
  exit 2
}

RECEIVED="$REPO/.received/hf$NR"
STYLE_DIR="$REPO/style-references"
RECIPE_DIR="$REPO/recipes/$SLUG"
LOG="$RECEIVED/restyle.log"
DONE="$RECEIVED/.done"

mkdir -p "$RECEIVED" "$RECIPE_DIR"
rm -f "$DONE"

# When backgrounded, re-exec self in disowned subshell so caller can return.
if [[ "$BACKGROUND" -eq 1 ]]; then
  nohup bash "$0" \
    --target "$TARGET" \
    --slug "$SLUG" \
    --nr "$NR" \
    --repo "$REPO" \
    ${HF_URL:+--hf-url "$HF_URL"} \
    $([ "$HUB_PUSH" -eq 0 ] && echo "--no-hub-push") \
    $([ "$CARD_MODE" -eq 1 ] && echo "--card-mode") \
    > "$LOG" 2>&1 &
  BG_PID=$!
  echo "$BG_PID" > "$RECEIVED/.pid"
  echo "Restyle dispatched in background (pid=$BG_PID, log=$LOG)" >&2
  exit 0
fi

# ─── from here: foreground execution ───────────────────────────────────────

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

# Save HF original into .received/
cp "$TARGET" "$RECEIVED/original.jpg"
log "saved HF original → $RECEIVED/original.jpg"

# Confirm prerequisites
command -v cliclick >/dev/null || { log "ERROR cliclick missing — brew install cliclick"; exit 3; }
osascript -e 'tell application "ChatGPT" to get name' >/dev/null 2>&1 || {
  log "ERROR ChatGPT.app not installed/running"; exit 3
}

# ─── 1. open new chat ───────────────────────────────────────────────────────
log "opening new ChatGPT chat"
osascript <<'EOF' >/dev/null
tell application "ChatGPT" to activate
delay 0.4
tell application "System Events"
  tell process "ChatGPT"
    set frontmost to true
    delay 0.2
    click button 2 of toolbar 1 of window 1
    delay 1.0
  end tell
end tell
EOF

# ─── 2. focus message input ─────────────────────────────────────────────────
osascript <<'EOF' >/dev/null
tell application "System Events"
  tell process "ChatGPT"
    set inputArea to UI element 1 of scroll area 3 of group 2 of splitter group 1 of group 1 of window 1
    click inputArea
    delay 0.5
  end tell
end tell
EOF

# ─── 3. paste 3 style references + target ───────────────────────────────────
paste_img() {
  local p="$1"
  osascript -e "set the clipboard to (read POSIX file \"$p\" as JPEG picture)" >/dev/null
  sleep 0.3
  osascript -e 'tell application "System Events" to tell process "ChatGPT" to keystroke "v" using {command down}' >/dev/null
  sleep 2.0
}

for f in "$STYLE_DIR"/*.jpg; do
  log "pasting style reference $(basename "$f")"
  paste_img "$f"
done
log "pasting target $(basename "$TARGET")"
paste_img "$TARGET"

# ─── 4. type prompt + send ──────────────────────────────────────────────────
if [[ "$CARD_MODE" -eq 1 ]]; then
  PROMPT="Die ersten drei Bilder sind unser visueller Stil für die Thermomix-App (warmes Licht, professionelle Food-Fotografie, blauer Tellerrand-Akzent, Top-Down-Perspektive). Das vierte Bild ist eine abfotografierte HelloFresh-Rezeptkarte mit einem Foto des fertigen Gerichts darauf. Bitte generiere mir ein neues Bild im Stil der ersten drei, das genau das Gericht zeigt, das auf der Karte abgebildet ist — ignoriere das Karten-Layout, den Text und den Karten-Hintergrund."
  RETRY_PROMPT="Bitte nochmal — fokussiere nur auf das Gericht, das auf der fotografierten Rezeptkarte zu sehen ist. Stil und Komposition wie in den ersten drei Bildern (blauer Teller, Top-Down, warmes Licht)."
else
  PROMPT="Die ersten drei Bilder sind unser visueller Stil für die Thermomix-App (warmes Licht, professionelle Food-Fotografie, blauer Tellerrand-Akzent, Top-Down-Perspektive). Bitte style mir das vierte Bild im gleichen Stil um — wichtig: Komposition und Hauptzutaten exakt wie im Original, nur Stil/Beleuchtung/Tellerwahl anpassen."
  RETRY_PROMPT="Bitte nochmal — halte die Komposition und Anordnung der Hauptzutaten exakt wie im 4. Quell-Bild. Nur Stil, Licht, Teller (blauer Rand), Hintergrund anpassen."
fi

send_prompt() {
  local p="$1"
  osascript <<APPLE >/dev/null
tell application "System Events"
  tell process "ChatGPT"
    keystroke "$(echo "$p" | sed 's/"/\\"/g')"
    delay 0.6
    key code 36
  end tell
end tell
APPLE
}

log "sending prompt"
send_prompt "$PROMPT"

# ─── 5. poll for completion ─────────────────────────────────────────────────
poll_until_done() {
  local max=$1   # seconds
  local elapsed=0
  while (( elapsed < max )); do
    # Heuristic: if no "Bild wird erstellt" AXStaticText is visible AND there's
    # an image button > 400px tall in the main pane → generation done.
    local state
    state=$(osascript <<'EOF' 2>/dev/null
try
  tell application "System Events"
    tell process "ChatGPT"
      set mainG to group 2 of splitter group 1 of group 1 of window 1
      set imgArea to scroll area 1 of mainG
      -- check for "Bild wird erstellt" anywhere in main scroll area
      set generating to false
      try
        repeat with t in (static texts of imgArea)
          if (value of t as text) contains "Bild wird erstellt" or (value of t as text) contains "Generating image" then
            set generating to true
            exit repeat
          end if
        end repeat
      end try
      if generating then
        return "generating"
      end if
      -- look for an image-button with height > 400 (= rendered AI image)
      try
        set lst to list 1 of UI element 1 of imgArea
        repeat with grp in (groups of lst)
          repeat with btn in (buttons of grp)
            try
              set sz to size of btn
              if (item 2 of sz) > 400 then
                return "done"
              end if
            end try
          end repeat
        end repeat
      end try
      return "waiting"
    end tell
  end tell
on error
  return "error"
end try
EOF
)
    case "$state" in
      done) return 0 ;;
      generating|waiting) ;;
      *) ;;
    esac
    sleep 3
    elapsed=$((elapsed + 3))
  done
  return 1
}

log "polling for completion (max 120s)"
if poll_until_done 120; then
  log "image generation done after ${elapsed:-?}s"
else
  log "WARN polling timed out — proceeding anyway"
fi

# ─── 6. right-click image + copy ────────────────────────────────────────────
# Compute image center from AX tree
read -r CX CY <<<"$(osascript <<'EOF' 2>/dev/null
try
  tell application "System Events"
    tell process "ChatGPT"
      set mainG to group 2 of splitter group 1 of group 1 of window 1
      set lst to list 1 of UI element 1 of scroll area 1 of mainG
      set foundBtn to missing value
      repeat with grp in (groups of lst)
        repeat with btn in (buttons of grp)
          try
            set sz to size of btn
            if (item 2 of sz) > 400 then
              set foundBtn to btn
            end if
          end try
        end repeat
      end repeat
      if foundBtn is missing value then return "0 0"
      set p to position of foundBtn
      set s to size of foundBtn
      return ((item 1 of p) + (item 1 of s) div 2) & " " & ((item 2 of p) + (item 2 of s) div 2)
    end tell
  end tell
on error
  return "0 0"
end try
EOF
)"
[[ "$CX" == "0" ]] && { log "ERROR could not locate image button"; exit 4; }
log "right-clicking image center at ($CX, $CY)"
osascript -e 'tell application "ChatGPT" to activate' >/dev/null
sleep 0.3
cliclick rc:$CX,$CY
sleep 0.5
osascript -e 'tell application "System Events" to key code 125' >/dev/null  # Down
sleep 0.2
osascript -e 'tell application "System Events" to key code 36' >/dev/null   # Return
sleep 1.2

# ─── 7. extract clipboard PNG ───────────────────────────────────────────────
osascript <<APPLE >/dev/null
set imgData to the clipboard as «class PNGf»
set fd to open for access POSIX file "$RECEIVED/restyled-fullres.png" with write permission
set eof of fd to 0
write imgData to fd
close access fd
APPLE

if [[ ! -s "$RECEIVED/restyled-fullres.png" ]]; then
  log "ERROR no image in clipboard"; exit 5
fi
log "extracted clipboard PNG → restyled-fullres.png"

# ─── 8. convert to JPEG q92 + copy to recipe ───────────────────────────────
sips -s format jpeg -s formatOptions 92 \
  "$RECEIVED/restyled-fullres.png" \
  --out "$RECEIVED/restyled-final.jpg" >/dev/null
cp "$RECEIVED/restyled-final.jpg" "$RECIPE_DIR/hero.jpg"
log "JPEG q92 ready at $RECIPE_DIR/hero.jpg"

# ─── 9. auto-verify against HF original ────────────────────────────────────
if [[ -n "$HF_URL" ]]; then
  log "verifying composition match against HF URL"
  SCRIPT_DIR="$(dirname "$0")"
  if "$SCRIPT_DIR/verify-image-match.py" \
       --user-image "$RECIPE_DIR/hero.jpg" \
       --hf-url "$HF_URL" >> "$LOG" 2>&1; then
    log "verify PASS"
  else
    rc=$?
    log "verify exit=$rc — trying ONE retry with stronger prompt"
    # one retry: same chat, additional message with retry prompt
    osascript <<'EOF' >/dev/null
tell application "System Events"
  tell process "ChatGPT"
    set inputArea to UI element 1 of scroll area 3 of group 2 of splitter group 1 of group 1 of window 1
    click inputArea
    delay 0.4
  end tell
end tell
EOF
    send_prompt "$RETRY_PROMPT"
    poll_until_done 120 || log "WARN retry polling timed out"
    # re-extract from the new latest image
    read -r CX CY <<<"$(osascript <<'EOF' 2>/dev/null
try
  tell application "System Events"
    tell process "ChatGPT"
      set mainG to group 2 of splitter group 1 of group 1 of window 1
      set lst to list 1 of UI element 1 of scroll area 1 of mainG
      set foundBtn to missing value
      repeat with grp in (groups of lst)
        repeat with btn in (buttons of grp)
          try
            set sz to size of btn
            if (item 2 of sz) > 400 then set foundBtn to btn
          end try
        end repeat
      end repeat
      if foundBtn is missing value then return "0 0"
      set p to position of foundBtn
      set s to size of foundBtn
      return ((item 1 of p) + (item 1 of s) div 2) & " " & ((item 2 of p) + (item 2 of s) div 2)
    end tell
  end tell
on error
  return "0 0"
end try
EOF
)"
    [[ "$CX" != "0" ]] && {
      cliclick rc:$CX,$CY
      sleep 0.5
      osascript -e 'tell application "System Events" to key code 125' >/dev/null
      sleep 0.2
      osascript -e 'tell application "System Events" to key code 36' >/dev/null
      sleep 1.2
      osascript <<APPLE >/dev/null
set imgData to the clipboard as «class PNGf»
set fd to open for access POSIX file "$RECEIVED/restyled-fullres.png" with write permission
set eof of fd to 0
write imgData to fd
close access fd
APPLE
      sips -s format jpeg -s formatOptions 92 \
        "$RECEIVED/restyled-fullres.png" \
        --out "$RECEIVED/restyled-final.jpg" >/dev/null
      cp "$RECEIVED/restyled-final.jpg" "$RECIPE_DIR/hero.jpg"
      log "retry image saved"
    }
  fi
fi

# ─── 10. notes.md ──────────────────────────────────────────────────────────
cat > "$RECEIVED/notes.md" <<EOF
# HF #$NR — $SLUG

- **Slug:** $SLUG
- **HelloFresh Original:** ${HF_URL:-N/A}
- **Restyle-Datum:** $(date '+%Y-%m-%d %H:%M')

## Files
- original.jpg — HF-Hauptbild (Source)
- restyled-fullres.png — ChatGPT image-1 Full-Resolution
- restyled-final.jpg — q92 JPEG → recipes/$SLUG/hero.jpg

## Style-Referenzen
$(ls "$STYLE_DIR"/*.jpg 2>/dev/null | sed 's|^|- |')

## Pipeline-Log
Siehe restyle.log
EOF

# ─── 11. hub-push via claude-peers broker (best-effort) ────────────────────
if [[ "$HUB_PUSH" -eq 1 ]]; then
  # Find allgemein-Hub peer in broker's list (cwd ends in /codex/allgemein)
  HUB_ID=$(curl -s --max-time 2 -X POST http://127.0.0.1:7899/list-peers \
            -H 'Content-Type: application/json' \
            -d '{"scope":"machine","from_id":"cli"}' 2>/dev/null | \
    python3 -c "import sys,json; print(next((p['id'] for p in json.load(sys.stdin) if str(p.get('cwd','')).endswith('/codex/allgemein')), ''))" 2>/dev/null || true)
  if [[ -n "$HUB_ID" ]]; then
    log "hub-pushing 'restyle done' to peer $HUB_ID"
    curl -s --max-time 3 -X POST http://127.0.0.1:7899/send-message \
      -H 'Content-Type: application/json' \
      -d "{\"from_id\":\"chatgpt-restyle\",\"to_id\":\"$HUB_ID\",\"text\":\"Restyle für HF #$NR fertig — schau optisch drüber: $RECIPE_DIR/hero.jpg\"}" >/dev/null || true
  else
    log "hub-push skipped (allgemein-Hub peer not online)"
  fi
fi

# ─── done sentinel ──────────────────────────────────────────────────────────
touch "$DONE"
log "DONE — sentinel touched at $DONE"
