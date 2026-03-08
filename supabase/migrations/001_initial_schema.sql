-- supabase/migrations/001_initial_schema.sql

-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','growth','scale','agency','enterprise')),
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  credits_monthly INTEGER NOT NULL DEFAULT 15000,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  instantly_api_key TEXT,
  stealth_gpt_api_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE public.campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  city TEXT NOT NULL,
  offer TEXT NOT NULL,
  pain_point TEXT NOT NULL,
  outcome TEXT NOT NULL,
  tone TEXT DEFAULT 'professional',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scraping','generating','humanizing','pushing','active','paused','completed')),
  instantly_campaign_id TEXT,
  leads_scraped INTEGER DEFAULT 0,
  leads_verified INTEGER DEFAULT 0,
  leads_pushed INTEGER DEFAULT 0,
  humanize_enabled BOOLEAN DEFAULT true,
  personalize_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads
CREATE TABLE public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  city TEXT,
  niche TEXT,
  verified BOOLEAN DEFAULT false,
  personalized_line TEXT,
  pushed_to_instantly BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Sequences
CREATE TABLE public.sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emails JSONB NOT NULL DEFAULT '[]',
  -- emails: [{subject_a, subject_b, body, send_day, cta}]
  humanized_emails JSONB,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics (synced from Instantly AI)
CREATE TABLE public.campaign_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  open_rate DECIMAL(5,2),
  reply_rate DECIMAL(5,2),
  bounce_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  positive_reply_rate DECIMAL(5,2),
  calls_booked INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Agent Learnings (the knowledge base that grows over time)
CREATE TABLE public.agent_learnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  niche TEXT,
  city TEXT,
  insight TEXT NOT NULL,
  impact_score DECIMAL(3,2), -- 0.0 to 1.0
  source_campaign_id UUID REFERENCES public.campaigns(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Runs Log
CREATE TABLE public.agent_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL, -- 'rewrite_email', 'store_learning', 'analyze'
  details JSONB,
  tokens_used INTEGER,
  cost_usd DECIMAL(8,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Transactions
CREATE TABLE public.credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL, -- positive = add, negative = deduct
  reason TEXT NOT NULL, -- 'subscription', 'topup', 'campaign_use'
  campaign_id UUID REFERENCES public.campaigns(id),
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
