# Outbound OS — Deployment Guide

## Architecture

```
Netlify (Next.js frontend)
    ├── Supabase (Postgres DB + Auth)
    └── Railway (FastAPI worker + Reacher)
```

## 1. Railway (worker — auto-deploy from GitHub)

### Initial setup (one time)

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your OutboundOS repository
4. Railway auto-detects the Dockerfile in `worker/`

### Environment variables

Set these in Railway → your service → Variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `WORKER_SECRET` | same random string as Netlify |
| `APIFY_API_TOKEN` | your Apify token |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `FRONTEND_URL` | `https://outboundos.com` |

### Reacher (email verifier)

Add as a second service in the same Railway project:
1. Click "New Service" → "Docker Image"
2. Image: `reacherhq/backend:latest`
3. Railway assigns an internal URL — update worker config to use it

### Auto-deploy

Push to `main` → Railway rebuilds automatically. No SSH needed.

### Logs

Click your service in Railway dashboard → "Logs" tab.

## 2. Netlify (frontend)

Same as before. Update `WORKER_URL` in Netlify env vars to your Railway service URL:
`https://your-worker.up.railway.app`

## 3. Costs

| Service | Monthly cost |
|---|---|
| Netlify | $0 (free tier) |
| Supabase | $0 (free tier) |
| Railway (worker) | ~$5-20 |
| Railway (Reacher) | ~$5 |
| **Total** | **~$10-25/mo** |
