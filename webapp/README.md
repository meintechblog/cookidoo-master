# thermomix-master webapp

> 🟢 **Live**: http://192.168.3.223/ (LXC 141 auf proxi)
> · `/chat` für embedded Claude Code
> · `/pinned` für die URL-Queue
> · `/r/<slug>/edit` für Markdown + Hero-Upload



HelloFresh-styled Browser für unsere Cookidoo-Rezepte, läuft als LXC auf Proxmox unter Port 80.

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (LAN)                                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ http://192.168.3.223
              ┌───────▼──────┐
              │  nginx :80   │  reverse proxy
              └───────┬──────┘
                      │
              ┌───────▼─────────┐    ┌──────────────────┐
              │  Next.js :3000  │◄──►│  SQLite (state)  │
              │  (App Router)   │    │  pinned_urls,    │
              │                 │    │  pipeline_runs   │
              └───────┬─────────┘    └──────────────────┘
                      │ reads
              ┌───────▼─────────┐
              │  recipes/<slug>/ (git-tracked)
              │  ├── README.md   ← source of truth
              │  └── hero.jpg    ← user-uploaded
              └─────────────────┘

              ┌─────────────────┐
              │  worker.js      │  polls SQLite every 60s
              │  → runs skill   │  for queued pinned URLs
              │    scripts      │  → extracts HF data
              │                 │  → flags for LLM pickup
              └─────────────────┘

              ┌─────────────────┐
              │  autoupdate     │  systemd timer, every 10min
              │  .timer         │  → git pull + rebuild
              └─────────────────┘
```

## Routes

| Path | Purpose |
|---|---|
| `/` | Recipe grid + Pin-URL form (sortiert nach HF-Karten-Nr) |
| `/r/[slug]` | Recipe detail (Zutaten, Zubereitung, Tipps, Warum) |
| `/r/[slug]/edit` | Markdown editor — direct write to `recipes/<slug>/README.md` |
| `/pinned` | Queue of pinned URLs + processing status |
| `/settings` | Cookidoo account + auto-update info |
| `/api/recipes` | GET — JSON list of all recipes |
| `/api/recipes/[slug]` | PUT — update markdown |
| `/api/recipes/[slug]/hero` | GET — serve hero.jpg/png |
| `/api/pinned` | GET — list queue, POST — pin a new URL |

## Deploy on a fresh LXC

```bash
# On the Proxmox host:
pct create 141 /var/lib/vz/template/cache/debian-13-standard_13.1-2_amd64.tar.zst \
  --hostname thermomix-master --cores 4 --memory 4096 --swap 1024 \
  --rootfs data:32 --net0 name=eth0,bridge=vmbr0,ip=dhcp,type=veth \
  --features nesting=1,keyctl=1 --unprivileged 1 --onboot 1 --start 1

# Then on the LXC:
apt update && apt install -y curl git nginx python3 python3-pip python3-venv build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Bootstrap (also handles future updates):
curl -fsSL https://raw.githubusercontent.com/meintechblog/thermomix-master/main/webapp/deploy/install.sh | bash
```

After that the webapp is on port 80 of the LXC's IP. The autoupdate timer pulls from `main` every 10 min.

## Cookidoo login

The Playwright profile lives at `~/cookidoo-automation/profile/` on the LXC. Copy from your dev machine once:

```bash
# From local Mac → LXC:
rsync -az ~/cookidoo-automation/profile/ root@<lxc-ip>:/root/cookidoo-automation/profile/
```

After that, all pipeline scripts (`01_create_recipe.py` through `06_publish.py`) work inside the LXC.

## Local dev

```bash
cd webapp
npm install
npm run dev  # http://localhost:3000
```

The dev server reads from `../recipes/` (the repo's recipes dir) and stores DB state in `../.state/`.
