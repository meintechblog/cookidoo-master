# Handover from tzmdvfoe → ohuoyhmy (2026-05-28)

This is what I built today as the (now-archived) cookidoo-master peer.
Repo is now thermomix-master, you (`ohuoyhmy`) are the authoritative
session in that cwd. Memory dir was `mv`'d to
`~/.claude/projects/-Users-hulki-codex-thermomix-master/memory/`, so the
two `reference_*` entries below are already in your library.

## What was built today

### 1. `webapp-chat-bridge` skill (`~/.claude/skills/webapp-chat-bridge/`)
Scaffolds the browser-chat-UI + Mac launchd-daemon into any Next.js webapp.
Used to (re-)deploy this repo's chat — first as `--app cookidoo`, then
regenerated as `--app thermomix` after the rename. Memory: `[[reference_webapp_chat_bridge_skill]]`.

**v2 added today:**
- Assistant-bubble Markdown rendering (react-markdown + rehype-highlight, copy-button on code-blocks)
- Peer-Status indicator in header (3 states: online/queued/daemon-offline). Backed by `/api/chat/peer-status` endpoint + `peer_status` table; daemon heartbeats every 5s.
- Voice controls: walkie-only mic-button, smart-filter for TTS (strips code blocks/URLs), spinner with center stop-square cancels in-flight STT via AbortController.

### 2. `local-speech-service` skill (`~/.claude/skills/local-speech-service/`)
Installs a local FastAPI service on Apple Silicon with faster-whisper (`large-v3-turbo`, ~800MB) + Piper TTS (`de_DE-thorsten-medium`). Endpoints `POST /transcribe` + `POST /synthesize`, runs as `com.hulki.local-speech-service` launchd on port 8765. Memory: `[[reference_local_speech_service_skill]]`.

**Important install lessons (already in the skill):**
- `mypc-stt` is MCP-only (not HTTP) and `mypc-tts` is cloud (ElevenLabs/Deepgram/Google) — both disqualified for local-first browser use
- rhasspy/piper github release tar `piper_macos_aarch64.tar.gz` actually contains x86_64 binary (mislabeled). Fix: install `piper-tts` via pip — native arm64 wheel
- Apple Silicon needs Python 3.10+ (system `python3` is 3.9 from CommandLineTools — wouldn't decode `str | None` annotations). install.sh now hunts for brew's 3.12 first
- `espeak-ng-data` needed by Piper isn't always bundled — the pip wheel includes it
- bash `set -u` + empty array → `${EXTRA[@]}` errors out. Guard with `[[ -n "$EXTRA_VOICES" ]]`
- bash `$VAR…` (var followed by utf-8 char) parsed as part of var name → always use `${VAR}…` with braces

### 3. Webapp infrastructure
- HTTPS with self-signed cert: `/etc/ssl/{certs,private}/cookidoo-selfsigned.{crt,key}` (yes, filename still says cookidoo — left it because rename mid-cert would cause cert-trust issues on already-accepted iOS devices; can be regenerated later if it bothers you). CN=`cookidoo-master.local`, SAN=`IP:192.168.3.223,DNS:cookidoo-master.local,DNS:localhost`. Valid until 2036.
- nginx config: port 80 has `location ~ ^/api/chat/(inbox|reply|peer-status)$` proxying to `:3000` WITHOUT redirect (so the Mac daemon, which can't do self-signed certs in Python's urllib, can POST). Everything else 301 → HTTPS.
- `/speech/` location proxies to `http://192.168.3.127:8765/` — browser fetches same-origin HTTPS, no mixed-content block.
- `NEXT_PUBLIC_SPEECH_URL` etc are baked into `webapp/src/lib/speech-config.ts` (committed), NOT `.env*` (those are all gitignored in this repo, including `.env.production`). The skill writes the config file directly.

### 4. Recipe-name HF-prefix convention (from earlier today)
Phase 5 Step 1 of the thermomix-master skill: `RECIPE_NAME = "[#NN] <name> (HelloFresh)"` is now mandatory for HF sources. Phase 5 Step 3: Tipps-Block starts with `Karte #NN — <short-name>\n\n`. The `automation/99_retro_fix_hf_nr.py` tool applies both via Playwright to existing recipes (idempotent). Applied to four recipes from 2026-05-27: #33 Stroganoff, #32 Thai-Orange, #25 Pinsa, #25 Räuchertofu-Gyros.

**Subtle:** the regex `HF_NR=$(echo "$HF_TOKEN" | grep -oE 'R[0-9]+' | tr -d R)` in Phase 2.5 extracts the **release** number from the URL, not the **card position** that HelloFresh prints on the packages. They sometimes match, sometimes don't (Stroganoff was R32 in URL but Karte #33 on the box). For Jörg's "fridge box → recipe" lookup, the card position is ground truth. May want to add an interactive confirmation in Phase 2.5 or read it from a separate user-supplied field.

## Open issues you might trip over

1. **Webapp graceful-shutdown hangs ~1min** when the chat-bridge daemon (or any browser) keeps an SSE stream open. `systemctl restart thermomix-webapp` sits in `stop-sigterm` and nginx returns 502 until forced. Fix: add `TimeoutStopSec=10` to `webapp/deploy/thermomix-webapp.service`. I didn't do it because I was deep in feature work, but it's low-risk and high-value.

2. **iOS Safari TTS unlock** relies on `audioCtxRef.current` priming inside the first mic-click handler. If iOS changes their AudioContext gesture-requirement policy in a future Safari version, our autoplay may break silently again. The error is suppressed by the `NotAllowed|user gesture|autoplay` regex in `VoiceControls.tsx` `speakText` catch block.

3. **Pinsa recipe** wasn't actually a "yesterday" recipe — it's from a HF box ~3 weeks old (HF_Y26_R25_W19 = KW19, today is KW22). I retro-fixed it anyway because the `[#25]` prefix matches what's on its package; Jörg confirmed via thermomix-master that "lass auch drin, kann nicht schaden." Just FYI in case it ever looks anomalous.

4. **Old cert filename** (`cookidoo-selfsigned.crt`) on the LXC. iOS devices that already trusted it will keep trusting; renaming requires re-acceptance on every device. Leave until natural expiry (2036) or until you actually need to regenerate.

## Final state (HEAD = `a595374`)

- 4 retro-fixed Cookidoo recipes with `[#NN]` prefix + Karten-header in tips
- `automation/99_retro_fix_hf_nr.py` available for future retro-runs
- chat-bridge daemon running as `com.hulki.thermomix.chatbridge`, posting peer-status every 5s
- speech-service stable on Hulki-host (192.168.3.127:8765), Whisper model warm, Piper voice loaded
- Webapp on HTTPS, walkie-mode works end-to-end on iOS Safari
- Skill SKILL.md updated with `[#NN]` prefix convention (Phase 5 Step 1 + 3)

Have at it. Memory dir is yours now too.

— tzmdvfoe (signing off)
