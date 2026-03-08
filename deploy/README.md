# Outbound OS — Deployment Guide

## Architecture overview

```
Netlify  (Next.js frontend)
    │
    ├── Supabase  (Postgres DB + Auth)
    │
    └── DigitalOcean 4 GB Droplet  (FastAPI worker + Reacher)
            ├── uvicorn  (port 8000)  — pipeline API
            ├── Reacher  (port 8080, Docker)  — email verification
            └── scheduler.py  — Claude Opus optimizer (runs every 3 days)
```

---

## 1. Netlify (frontend)

### First deploy

```bash
# From the project root
npm install -g netlify-cli
netlify login
netlify init          # follow prompts, link to your Netlify site
netlify deploy --prod
```

### Environment variables

Set all values from `.env.local` in **Netlify → Site Settings → Environment Variables**:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server only) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `WORKER_URL` | `http://<DO-droplet-IP>:8000` |
| `WORKER_SECRET` | Shared secret for worker auth |
| `UPSTASH_REDIS_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_TOKEN` | Upstash Redis token |
| `RESEND_API_KEY` | Resend transactional email key |
| `NEXT_PUBLIC_APP_URL` | `https://outboundos.com` |

### Continuous deployment

Push to `main` → Netlify rebuilds automatically.

---

## 2. DigitalOcean droplet (worker)

### Provision the droplet

- Image: Ubuntu 22.04 LTS
- Size: 4 GB RAM / 2 vCPUs ($24/mo)
- Region: closest to your users (e.g. NYC1)
- Enable: SSH key authentication

### Initial server setup

```bash
# SSH into the droplet
ssh root@<your-droplet-ip>

# Create a non-root user
adduser outbound
usermod -aG sudo outbound
rsync --archive --chown=outbound:outbound ~/.ssh /home/outbound

# Switch to the new user
su - outbound
```

### Install system dependencies

```bash
sudo apt update && sudo apt upgrade -y

# Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip git curl

# Docker (for Reacher)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker outbound
newgrp docker   # apply group without logout

# Docker Compose plugin
sudo apt install -y docker-compose-plugin
```

### Deploy the code

```bash
cd /home/outbound
git clone https://github.com/<your-org>/outbound-os.git
cd outbound-os/worker

# Create virtual environment and install dependencies
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
playwright install-deps chromium
```

### Configure environment

```bash
cp .env.example .env
nano .env   # fill in all values
```

Required `.env` values for the worker:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WORKER_SECRET=your-secret-token           # must match Netlify WORKER_SECRET
APIFY_API_TOKEN=your-apify-token
ANTHROPIC_API_KEY=your-anthropic-key
OPTIMIZATION_INTERVAL_DAYS=3             # optional, default 3
SCHEDULER_POLL_SECONDS=3600              # optional, default 3600 (1 hour)
```

### Start Reacher (email verifier)

```bash
cd /home/outbound/outbound-os
docker compose -f deploy/docker-compose.yml up -d

# Verify it's running
curl http://localhost:8080/v0/check_email
```

### Install and start systemd services

```bash
# FastAPI worker
sudo cp /home/outbound/outbound-os/deploy/outbound-os-worker.service /etc/systemd/system/

# Claude Opus scheduler
sudo cp /home/outbound/outbound-os/deploy/outbound-os-scheduler.service /etc/systemd/system/

sudo systemctl daemon-reload

sudo systemctl enable outbound-os-worker outbound-os-scheduler
sudo systemctl start outbound-os-worker outbound-os-scheduler

# Verify both are running
sudo systemctl status outbound-os-worker
sudo systemctl status outbound-os-scheduler
```

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 8000   # FastAPI worker (Netlify → worker)
sudo ufw enable
```

> **Note:** Port 8080 (Reacher) should NOT be exposed publicly — it's only
> used internally by the worker on `localhost:8080`.

---

## 3. Supabase migrations

Run these SQL files in order in the Supabase SQL Editor:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

---

## 4. Verify the full stack

```bash
# 1. Worker health
curl http://<droplet-ip>:8000/docs

# 2. Reacher health
curl http://localhost:8080/v0/check_email   # on the droplet

# 3. Analytics sync (from local machine, replace values)
curl -X POST http://<droplet-ip>:8000/analytics/sync \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: your-secret-token" \
  -d '{"user_id": "your-user-uuid"}'

# 4. Trigger a test optimization run for one campaign
cd /home/outbound/outbound-os/worker
source .venv/bin/activate
python -m agent.scheduler --campaign <campaign-uuid>
```

---

## 5. Updates / redeployment

```bash
# On the droplet
cd /home/outbound/outbound-os
git pull

cd worker
source .venv/bin/activate
pip install -r requirements.txt   # only needed if requirements changed

sudo systemctl restart outbound-os-worker outbound-os-scheduler
```

---

## 6. Monitoring logs

```bash
# FastAPI worker logs
sudo journalctl -u outbound-os-worker -f

# Claude Optimizer scheduler logs
sudo journalctl -u outbound-os-scheduler -f

# Reacher logs
docker compose -f /home/outbound/outbound-os/deploy/docker-compose.yml logs -f reacher
```

---

## 7. Costs (reference)

| Service | Monthly cost |
|---|---|
| Netlify (already paid) | $0 |
| Supabase Pro (already paid) | $0 |
| Apify (already paid) | $0 |
| DigitalOcean 4 GB droplet | $24 |
| Upstash Redis | $10 |
| **New infrastructure total** | **$34/mo** |
