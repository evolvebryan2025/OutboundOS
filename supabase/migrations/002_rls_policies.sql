-- supabase/migrations/002_rls_policies.sql

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: users see only their own
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Campaigns: users see only their own
CREATE POLICY "Users manage own campaigns" ON public.campaigns
  FOR ALL USING (auth.uid() = user_id);

-- Leads: users see only their own
CREATE POLICY "Users manage own leads" ON public.leads
  FOR ALL USING (auth.uid() = user_id);

-- Sequences
CREATE POLICY "Users manage own sequences" ON public.sequences
  FOR ALL USING (auth.uid() = user_id);

-- Analytics
CREATE POLICY "Users view own analytics" ON public.campaign_analytics
  FOR ALL USING (auth.uid() = user_id);

-- Learnings
CREATE POLICY "Users manage own learnings" ON public.agent_learnings
  FOR ALL USING (auth.uid() = user_id);

-- Agent runs
CREATE POLICY "Users view own agent runs" ON public.agent_runs
  FOR ALL USING (auth.uid() = user_id);

-- Credit transactions
CREATE POLICY "Users view own transactions" ON public.credit_transactions
  FOR ALL USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC helper functions
CREATE OR REPLACE FUNCTION increment_credits(user_id UUID, amount INTEGER)
RETURNS void AS $$
  UPDATE public.profiles
  SET credits_remaining = credits_remaining + amount
  WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_credits(user_id UUID, amount INTEGER)
RETURNS void AS $$
  UPDATE public.profiles
  SET credits_remaining = GREATEST(0, credits_remaining - amount)
  WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;
