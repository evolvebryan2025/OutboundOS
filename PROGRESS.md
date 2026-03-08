# Outbound OS — Build Progress

**Last updated:** 2026-03-08
**Status:** MVP complete — awaiting credentials + deployment

---

## What's Been Built

### Frontend (Next.js 14 + Tailwind + shadcn/ui)

| File | What it does |
|---|---|
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(auth)/signup/page.tsx` | Signup page |
| `src/app/(auth)/layout.tsx` | Centered auth card layout |
| `src/middleware.ts` | Route protection — redirects unauthenticated users |
| `src/app/api/auth/callback/route.ts` | Supabase OAuth callback |
| `src/app/(dashboard)/layout.tsx` | Dashboard shell with sidebar |
| `src/components/layout/Sidebar.tsx` | Nav sidebar (Campaigns, Analytics, Billing, Settings) |
| `src/app/(dashboard)/dashboard/page.tsx` | Main dashboard overview |
| `src/app/(dashboard)/dashboard/campaigns/page.tsx` | Campaign list |
| `src/app/(dashboard)/dashboard/campaigns/new/page.tsx` | New campaign form page |
| `src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx` | Campaign detail + live progress |
| `src/app/(dashboard)/dashboard/billing/page.tsx` | Stripe billing portal |
| `src/components/campaigns/CampaignForm.tsx` | Campaign creation form (business type, city, offer, pain point, outcome) |
| `src/components/campaigns/CampaignCard.tsx` | Campaign card component |
| `src/components/campaigns/CampaignProgress.tsx` | Real-time SSE progress bar |

### API Routes

| Route | What it does |
|---|---|
| `src/app/api/campaigns/route.ts` | Create campaign + trigger worker |
| `src/app/api/campaigns/[id]/progress/route.ts` | SSE stream of live pipeline status |
| `src/app/api/stripe/create-checkout/route.ts` | Create Stripe checkout session |
| `src/app/api/stripe/create-portal/route.ts` | Open Stripe billing portal |
| `src/app/api/stripe/webhook/route.ts` | Handle Stripe events (subscription created/updated/deleted) |

### Database (Supabase)

| File | What it does |
|---|---|
| `supabase/migrations/001_initial_schema.sql` | Full schema: profiles, campaigns, leads, sequences, analytics, agent_learnings, agent_runs, credit_transactions |
| `supabase/migrations/002_rls_policies.sql` | Row-level security — users only see their own data |

### Python Worker (FastAPI — runs on DigitalOcean)

| File | What it does |
|---|---|
| `worker/main.py` | FastAPI app — receives jobs from frontend, orchestrates pipeline |
| `worker/requirements.txt` | Python dependencies |
| `worker/Dockerfile` | Docker image for the worker |
| `worker/pipeline/__init__.py` | Pipeline package |
| `worker/pipeline/scraper.py` | Apify Google Maps scraper → 1,500 business listings |
| `worker/pipeline/extractor.py` | Playwright + BeautifulSoup email extraction from business websites |
| `worker/pipeline/verifier.py` | Reacher SMTP email verification (self-hosted) |
| `worker/pipeline/generator.py` | **Claude Sonnet 4.6** — generates 5-email sequence using PAS/BAB/3Ps frameworks |
| `worker/pipeline/humanizer.py` | **StealthGPT API** — humanizes each email body, graceful fallback |
| `worker/pipeline/instantly.py` | **Instantly AI REST API** — creates campaign, adds sequence, batch-adds leads (100/batch), launches |
| `worker/agent/optimizer.py` | **Claude Opus 4.6** — self-improving optimization agent with tool use |
| `worker/agent/scheduler.py` | Runs optimizer every 3 days per campaign |
| `worker/analytics/sync.py` | Syncs open/reply/bounce rates from Instantly AI → Supabase |

### Deployment Config

| File | What it does |
|---|---|
| `netlify.toml` | Netlify build config |
| `deploy/docker-compose.yml` | Reacher + worker containers |
| `deploy/outbound-os-worker.service` | systemd service for FastAPI worker |
| `deploy/outbound-os-scheduler.service` | systemd service for Claude Opus scheduler |
| `deploy/README.md` | Full step-by-step deployment guide |

---

## The 7-Step Pipeline (Fully Wired)

```
1. Scrape       → Apify Google Maps → 1,500 businesses
2. Extract      → Playwright crawls websites for emails
3. Verify       → Reacher SMTP check → ~1,000 valid emails
4. Generate     → Claude Sonnet 4.6 → 5-email sequence (PAS framework)
5. Humanize     → StealthGPT → removes AI patterns
6. Push         → Instantly AI → campaign created + leads added + launched
7. Optimize     → Claude Opus → runs every 3 days, rewrites underperformers
```

---

## What's NOT Built Yet

- [ ] Analytics dashboard UI (`src/app/(dashboard)/dashboard/analytics/page.tsx`)
- [ ] Per-lead Claude Haiku personalization (Phase 2)
- [ ] All 5 Stripe pricing tiers wired end-to-end (Growth tier is active; others need Stripe price IDs)
- [ ] White-label / Agency sub-accounts (Phase 3)
- [ ] Client onboarding flow (Phase 3)

---

## Git Log Summary

```
feat: initialize Outbound OS Next.js project
feat: add Supabase schema and client utilities
feat: add Supabase auth with protected routes
feat: add dashboard layout with sidebar navigation
feat: add Stripe billing with subscriptions and top-up packs
feat: add campaign creation form and API route
feat: add SSE real-time progress streaming for campaigns
feat: add Python FastAPI worker with pipeline orchestration
feat: add Apify Google Maps scraper
feat: add website email extractor with concurrent crawling
feat: add Reacher email verification pipeline
feat: add Claude Sonnet sequence generator using PAS framework
feat: add StealthGPT email humanizer
feat: add Instantly AI campaign creation and lead push
feat: add Claude Opus self-improving optimization agent with tool use
feat: production deployment configuration for Netlify + DigitalOcean
```
