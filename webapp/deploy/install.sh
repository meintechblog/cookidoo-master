#!/bin/bash
# Idempotent deploy script for the thermomix-master webapp.
# Run on the LXC as root. Pulls latest from GitHub, builds, restarts services.
#
# First-time setup:
#   curl -fsSL https://raw.githubusercontent.com/meintechblog/cookidoo-master/main/webapp/deploy/install.sh | bash
#
# Subsequent updates:
#   /opt/cookidoo-master/webapp/deploy/install.sh

set -euo pipefail

REPO_URL="https://github.com/meintechblog/cookidoo-master.git"
REPO_DIR="/opt/cookidoo-master"
STATE_DIR="/var/lib/thermomix-master"
APP_USER="root"

echo "==> thermomix-master install/update"

# 1. Clone or pull
if [ -d "$REPO_DIR/.git" ]; then
  echo "==> updating existing clone"
  git -C "$REPO_DIR" fetch --quiet
  LOCAL=$(git -C "$REPO_DIR" rev-parse HEAD)
  REMOTE=$(git -C "$REPO_DIR" rev-parse @{u})
  if [ "$LOCAL" = "$REMOTE" ]; then
    echo "    already up-to-date ($LOCAL)"
    SKIP_BUILD=1
  else
    git -C "$REPO_DIR" pull --ff-only --quiet
    SKIP_BUILD=0
  fi
else
  echo "==> cloning fresh"
  git clone --depth 1 "$REPO_URL" "$REPO_DIR"
  SKIP_BUILD=0
fi

# 2. State dir + python venv for pipeline scripts
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

# 3. Python deps for the skill scripts (extract/audit/verify)
if [ ! -d "$REPO_DIR/.venv" ]; then
  echo "==> creating Python venv"
  python3 -m venv "$REPO_DIR/.venv"
  "$REPO_DIR/.venv/bin/pip" install --quiet --upgrade pip
  "$REPO_DIR/.venv/bin/pip" install --quiet playwright pillow
  "$REPO_DIR/.venv/bin/playwright" install --with-deps chromium >/dev/null 2>&1 || true
fi

# 4. Node deps + build
# Rebuild whenever the on-disk build is older than the most recent source change,
# even if git rev-parse claims "already up-to-date" (operator may have pre-pulled).
cd "$REPO_DIR/webapp"
NEEDS_BUILD=0
if [ "${SKIP_BUILD:-0}" = "0" ]; then NEEDS_BUILD=1; fi
if [ ! -d "$REPO_DIR/webapp/.next" ]; then NEEDS_BUILD=1; fi
if [ -d "$REPO_DIR/webapp/.next" ] && [ -n "$(find "$REPO_DIR/webapp/src" "$REPO_DIR/webapp/package.json" -newer "$REPO_DIR/webapp/.next" 2>/dev/null | head -1)" ]; then
  echo "==> source newer than .next/, will rebuild"
  NEEDS_BUILD=1
fi
if [ "$NEEDS_BUILD" = "1" ]; then
  echo "==> npm install"
  npm install --no-audit --no-fund --silent
  echo "==> npm build"
  rm -rf .next
  npm run build
fi

# 5. systemd units
install -m 0644 "$REPO_DIR/webapp/deploy/thermomix-webapp.service" /etc/systemd/system/thermomix-webapp.service
install -m 0644 "$REPO_DIR/webapp/deploy/thermomix-worker.service" /etc/systemd/system/thermomix-worker.service
install -m 0644 "$REPO_DIR/webapp/deploy/thermomix-autoupdate.service" /etc/systemd/system/thermomix-autoupdate.service
install -m 0644 "$REPO_DIR/webapp/deploy/thermomix-autoupdate.timer" /etc/systemd/system/thermomix-autoupdate.timer
install -m 0644 "$REPO_DIR/webapp/deploy/thermomix-chat.service" /etc/systemd/system/thermomix-chat.service
systemctl daemon-reload

# 6. nginx reverse-proxy on port 80
install -m 0644 "$REPO_DIR/webapp/deploy/nginx.conf" /etc/nginx/sites-available/thermomix
ln -sf /etc/nginx/sites-available/thermomix /etc/nginx/sites-enabled/thermomix
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx || systemctl restart nginx

# 7. Enable + restart services
systemctl enable --now thermomix-webapp.service
systemctl enable --now thermomix-worker.service
systemctl enable --now thermomix-autoupdate.timer
systemctl restart thermomix-webapp.service
systemctl restart thermomix-worker.service

# Chat service is optional — only starts if /usr/local/bin/ttyd + /usr/bin/claude both present
if [ -x /usr/local/bin/ttyd ] && [ -x /usr/bin/claude ]; then
  systemctl enable --now thermomix-chat.service
  systemctl restart thermomix-chat.service
  echo "==> chat service enabled (/chat in webapp)"
else
  echo "==> chat service skipped (install ttyd + claude first)"
fi

# 8. Health check
sleep 3
if curl -fsS http://127.0.0.1/ -o /dev/null; then
  echo "==> ✓ webapp responding on http://$(hostname -I | awk '{print $1}')/"
else
  echo "==> ⚠ webapp not responding yet — check 'journalctl -u thermomix-webapp -n 30'"
fi
echo "==> done."
