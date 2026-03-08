# Outbound OS — Credentials & Setup Guide

Fill in every value below before deploying. Nothing will work until these are set.

---

## 1. Supabase

**Where to get these:** https://supabase.com → your project → Settings → API

| Variable | Where to put it | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Netlify | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` + Netlify | anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` + Netlify + worker `.env` | service_role key (keep secret) |

**After adding credentials — run the database migrations:**
1. Go to Supabase Dashboard → SQL Editor
2. Paste and run `supabase/migrations/001_initial_schema.sql`
3. Paste and run `supabase/migrations/002_rls_policies.sql`

---

## 2. Stripe

**Where to get these:** https://dashboard.stripe.com → Developers → API keys

| Variable | Where to put it | Value |
|---|---|---|
| `STRIPE_SECRET_KEY` | `.env.local` + Netlify | `sk_live_...` (or `sk_test_...` for testing) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `.env.local` + Netlify | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `.env.local` + Netlify | `whsec_...` (from webhook endpoint below) |

**Create the webhook endpoint:**
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://outboundos.com/api/stripe/webhook`
3. Events to listen for: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`
4. Copy the signing secret → paste as `STRIPE_WEBHOOK_SECRET`

**Create pricing products in Stripe and paste the Price IDs:**

| Variable | Plan | Price |
|---|---|---|
| `STRIPE_PRICE_STARTER` | Starter | $147/mo |
| `STRIPE_PRICE_GROWTH` | Growth | $247/mo |
| `STRIPE_PRICE_SCALE` | Scale | $497/mo |
| `STRIPE_PRICE_AGENCY` | Agency | $997/mo |
| `STRIPE_PRICE_TOPUP_5K` | Top-up 5k leads | $29 one-time |
| `STRIPE_PRICE_TOPUP_15K` | Top-up 15k leads | $79 one-time |
| `STRIPE_PRICE_TOPUP_30K` | Top-up 30k leads | $139 one-time |
| `STRIPE_PRICE_TOPUP_100K` | Top-up 100k leads | $399 one-time |

---

## 3. Anthropic (Claude)

**Where to get this:** https://console.anthropic.com → API Keys

| Variable | Where to put it | Value |
|---|---|---|
| `ANTHROPIC_API_KEY` | worker `.env` | `sk-ant-...` |

Used for:
- Claude Sonnet 4.6 → sequence generation (~$0.01/sequence)
- Claude Opus 4.6 → optimization agent (~$0.031/run)

---

## 4. Apify

**Where to get this:** https://console.apify.com → Settings → Integrations → API token

| Variable | Where to put it | Value |
|---|---|---|
| `APIFY_API_TOKEN` | worker `.env` | your Apify token |

Used for: Google Maps scraping (Actor: `compass/crawler-google-places`)

---

## 5. StealthGPT

**Where to get this:** https://stealthgpt.ai → Dashboard → API

| Variable | Where to put it | Value |
|---|---|---|
| Per-campaign setting | Stored in Supabase `profiles.stealth_gpt_api_key` | User's own StealthGPT API key |

> Each client enters their own StealthGPT key in their account Settings page inside Outbound OS.
> You (Bryan) enter yours there too as Client #1.

---

## 6. Instantly AI

**Where to get this:** Instantly AI dashboard → Settings → API

| Variable | Where to put it | Value |
|---|---|---|
| Per-campaign setting | Stored in Supabase `profiles.instantly_api_key` | User's own Instantly API key |

> Same as StealthGPT — each client connects their own Instantly account in Settings.
> Minimum Instantly plan required: **Hypergrowth ($97/mo)**

---

## 7. Upstash Redis

**Where to get this:** https://console.upstash.com → your Redis database → REST API

| Variable | Where to put it | Value |
|---|---|---|
| `UPSTASH_REDIS_URL` | `.env.local` + Netlify | `https://...upstash.io` |
| `UPSTASH_REDIS_TOKEN` | `.env.local` + Netlify | your REST token |

---

## 8. Resend (transactional email)

**Where to get this:** https://resend.com → API Keys

| Variable | Where to put it | Value |
|---|---|---|
| `RESEND_API_KEY` | `.env.local` + Netlify | `re_...` |

---

## 9. Worker Secret (internal auth)

Generate any random string — this authenticates calls from the frontend to the worker.

```bash
# Generate a secure secret (run this once)
openssl rand -hex 32
```

| Variable | Where to put it | Value |
|---|---|---|
| `WORKER_SECRET` | `.env.local` + worker `.env` | same random string in both places |

---

## 10. Worker (Local Development)

For now, the Python worker runs locally on your machine. No cloud server needed.

### Start the worker

```bash
cd outbound-os/worker
python -m venv .venv
source .venv/bin/activate      # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run the FastAPI worker
uvicorn worker.main:app --reload --port 8000
```

### Start Reacher (email verifier)

```bash
# Requires Docker Desktop running
docker run -d -p 8080:8080 reacherhq/backend:latest
```

Your `.env.local` is already set to `WORKER_URL=http://localhost:8000`.

### When you're ready to go to production

Move to a cloud server (Oracle Cloud Free Tier recommended, or DigitalOcean $24/mo). See `deploy/README.md` for full instructions. Update `WORKER_URL` to your server's IP.

---

## 11. Quick Checklist

### For local development

- [ ] Supabase migrations ran (001 + 002)
- [ ] Supabase auth email templates configured (Dashboard → Auth → Email Templates)
- [ ] Docker Desktop installed and running
- [ ] `docker run -d -p 8080:8080 reacherhq/backend:latest` started
- [ ] `uvicorn worker.main:app --reload --port 8000` started
- [ ] Worker `.env` filled in (copy from `worker/.env.example`)

### For production launch

- [ ] Stripe products + prices created and Price IDs in `.env.local`
- [ ] Stripe webhook endpoint created and `STRIPE_WEBHOOK_SECRET` set
- [ ] Cloud server provisioned and worker deployed (see `deploy/README.md`)
- [ ] Netlify environment variables set (mirror everything from `.env.local`)
- [ ] Your Instantly AI API key entered in Outbound OS Settings
- [ ] Your StealthGPT API key entered in Outbound OS Settings
- [ ] Sending domains warmed up in Instantly (minimum 3 weeks)
