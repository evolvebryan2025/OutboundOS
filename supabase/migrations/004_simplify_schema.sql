-- supabase/migrations/004_simplify_schema.sql
-- Adds fields for: onboarding, BYOL, error handling, email review, sender selection

-- 1. Onboarding flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- 2. Campaign: new statuses, error fields, lead source, sending accounts
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft','scraping','generating','humanizing','review','pushing','active','paused','completed','failed'));

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS failed_at_step TEXT,
  ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'scraper' CHECK (lead_source IN ('scraper','uploaded')),
  ADD COLUMN IF NOT EXISTS sending_accounts JSONB DEFAULT '[]';

-- 3. Make pain_point and outcome nullable (AI generates them now)
ALTER TABLE public.campaigns
  ALTER COLUMN pain_point DROP NOT NULL,
  ALTER COLUMN outcome DROP NOT NULL;
