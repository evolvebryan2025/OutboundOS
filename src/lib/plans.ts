export const PLANS = {
  starter: {
    name: 'Starter',
    price: 147,
    credits: 15000,
    paypalPlanId: process.env.PAYPAL_PLAN_STARTER!,
    features: ['15,000 leads/mo', '2 campaigns', 'Basic sequences'],
  },
  growth: {
    name: 'Growth',
    price: 247,
    credits: 30000,
    paypalPlanId: process.env.PAYPAL_PLAN_GROWTH!,
    features: ['30,000 leads/mo', '5 campaigns', 'AI agent', 'StealthGPT', 'Per-lead personalization'],
  },
  scale: {
    name: 'Scale',
    price: 497,
    credits: 90000,
    paypalPlanId: process.env.PAYPAL_PLAN_SCALE!,
    features: ['90,000 leads/mo', 'Unlimited campaigns', 'Daily AI optimization', '5 sub-accounts'],
  },
  agency: {
    name: 'Agency',
    price: 997,
    credits: 300000,
    paypalPlanId: process.env.PAYPAL_PLAN_AGENCY!,
    features: ['300,000 leads/mo', 'Unlimited sub-accounts', 'White-label', 'API access'],
  },
} as const

export type PlanKey = keyof typeof PLANS

export const TOPUP_PACKS = [
  { leads: 5000, price: 29 },
  { leads: 15000, price: 79 },
  { leads: 30000, price: 139 },
  { leads: 100000, price: 399 },
]
