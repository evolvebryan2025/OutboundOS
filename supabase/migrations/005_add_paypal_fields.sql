-- Add PayPal fields to profiles (keep Stripe fields for future re-enablement)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_payer_id TEXT;

-- Add PayPal payment reference to credit_transactions
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
