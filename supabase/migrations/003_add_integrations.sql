-- supabase/migrations/003_add_integrations.sql
-- Add per-user integration credentials to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apify_api_token TEXT,
  ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT; -- already exists but ADD IF NOT EXISTS is safe

-- Note: instantly_api_key and stealth_gpt_api_key already exist from migration 001
