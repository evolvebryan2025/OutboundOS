export type PlanType = 'starter' | 'growth' | 'scale' | 'agency' | 'enterprise'

export type CampaignStatus =
  | 'draft'
  | 'scraping'
  | 'generating'
  | 'humanizing'
  | 'pushing'
  | 'active'
  | 'paused'
  | 'completed'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  plan: PlanType
  credits_remaining: number
  credits_monthly: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  paypal_subscription_id: string | null
  paypal_payer_id: string | null
  instantly_api_key: string | null
  stealth_gpt_api_key: string | null
  apify_api_token: string | null
  resend_api_key: string | null
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  user_id: string
  name: string
  business_type: string
  city: string
  offer: string
  pain_point: string
  outcome: string
  tone: string
  status: CampaignStatus
  instantly_campaign_id: string | null
  leads_scraped: number
  leads_verified: number
  leads_pushed: number
  humanize_enabled: boolean
  personalize_enabled: boolean
  created_at: string
  updated_at: string
}

export interface CampaignAnalytics {
  id: string
  campaign_id: string
  user_id: string
  open_rate: number | null
  reply_rate: number | null
  bounce_rate: number | null
  click_rate: number | null
  positive_reply_rate: number | null
  calls_booked: number
  emails_sent: number
  synced_at: string
}

export interface EmailSequence {
  email_number: number
  send_day: number
  subject_a: string
  subject_b: string
  body: string
  cta: string
}
